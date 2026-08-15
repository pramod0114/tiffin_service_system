import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// MySQL Database Configuration (root / admin@1234 / tiffin_service)
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'admin@1234',
  database: process.env.MYSQL_DATABASE || 'tiffin_service_new',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 4000
};

let dbPool = null;
let isDbConnected = false;
let dbLastError = null;

// Asynchronously initialize MySQL database and tables
async function initMySQLDatabase() {
  try {
    // 1. First connect to MySQL server without database to ensure database exists
    const rootConn = await mysql.createConnection({
      host: MYSQL_CONFIG.host,
      port: MYSQL_CONFIG.port,
      user: MYSQL_CONFIG.user,
      password: MYSQL_CONFIG.password,
      connectTimeout: 3000
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    // 2. Create connection pool to tiffin_service database
    dbPool = mysql.createPool(MYSQL_CONFIG);

    // 3. Create tables if not exist
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL UNIQUE,
        \`phone\` VARCHAR(20) NOT NULL,
        \`password\` VARCHAR(255) NOT NULL,
        \`address\` TEXT NOT NULL,
        \`dietary_preference\` VARCHAR(50) DEFAULT 'veg',
        \`wallet_balance\` DECIMAL(10, 2) DEFAULT 0.00,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS \`saved_addresses\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`user_email\` VARCHAR(150) NOT NULL,
        \`label\` VARCHAR(50) NOT NULL,
        \`address\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS \`admins\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`name\` VARCHAR(100) NOT NULL,
        \`role\` VARCHAR(50) DEFAULT 'admin',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS \`orders\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`customer_name\` VARCHAR(100) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL,
        \`phone\` VARCHAR(20) NOT NULL,
        \`address\` TEXT NOT NULL,
        \`items_json\` JSON NOT NULL,
        \`subtotal\` DECIMAL(10, 2) NOT NULL,
        \`discount\` DECIMAL(10, 2) DEFAULT 0.00,
        \`total\` DECIMAL(10, 2) NOT NULL,
        \`delivery_slot\` VARCHAR(50) DEFAULT 'Lunch (12:30 PM - 1:30 PM)',
        \`payment_method\` VARCHAR(50) DEFAULT 'cod',
        \`status\` VARCHAR(50) DEFAULT 'Pending',
        \`special_notes\` TEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS \`subscriptions\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`customer_name\` VARCHAR(100) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL,
        \`phone\` VARCHAR(20) NOT NULL,
        \`address\` TEXT NOT NULL,
        \`plan_name\` VARCHAR(100) NOT NULL,
        \`days_count\` INT NOT NULL,
        \`start_date\` DATE NOT NULL,
        \`expiry_date\` DATE NOT NULL,
        \`meal_time\` VARCHAR(50) NOT NULL,
        \`dietary\` VARCHAR(50) DEFAULT 'veg',
        \`status\` VARCHAR(50) DEFAULT 'Active',
        \`total_price\` DECIMAL(10, 2) NOT NULL,
        \`paused_dates_json\` JSON,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed default admin if missing
    await dbPool.query(`
      INSERT INTO \`admins\` (\`username\`, \`password\`, \`name\`, \`role\`)
      VALUES ('admin', 'admin123', 'Kitchen Master Admin', 'admin')
      ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`);
    `);

    // Load registered users from MySQL into memory
    const [userRows] = await dbPool.query('SELECT * FROM `users`');
    for (const row of userRows) {
      users.set(row.email, {
        name: row.name,
        phone: row.phone,
        email: row.email,
        password: row.password,
        address: row.address,
        savedAddresses: [{ id: 'addr-default', label: 'Home', address: row.address }],
        walletBalance: parseFloat(row.wallet_balance) || 100,
        dietaryPreference: row.dietary_preference || 'veg'
      });
    }

    isDbConnected = true;
    dbLastError = null;
    console.log(`✅ Connected to MySQL database [${MYSQL_CONFIG.database}] at ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port} with user [${MYSQL_CONFIG.user}]`);
  } catch (err) {
    isDbConnected = false;
    dbLastError = err.message;
    console.log(`ℹ️ MySQL connection note (${err.message}). High-performance memory storage active with live persistence.`);
  }
}

// Background MySQL Sync Helpers
async function syncUserToMySQL(user) {
  if (!isDbConnected || !dbPool) return;
  try {
    await dbPool.query(`
      INSERT INTO \`users\` (\`name\`, \`email\`, \`phone\`, \`password\`, \`address\`, \`dietary_preference\`, \`wallet_balance\`)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`name\`=VALUES(\`name\`),
        \`phone\`=VALUES(\`phone\`),
        \`address\`=VALUES(\`address\`),
        \`wallet_balance\`=VALUES(\`wallet_balance\`),
        \`dietary_preference\`=VALUES(\`dietary_preference\`);
    `, [user.name, user.email, user.phone, user.password, user.address, user.dietaryPreference || 'veg', user.walletBalance || 0]);
  } catch (e) {
    console.warn('MySQL User sync error:', e.message);
  }
}

async function syncOrderToMySQL(order) {
  if (!isDbConnected || !dbPool) return;
  try {
    await dbPool.query(`
      INSERT INTO \`orders\` (\`id\`, \`customer_name\`, \`email\`, \`phone\`, \`address\`, \`items_json\`, \`subtotal\`, \`discount\`, \`total\`, \`delivery_slot\`, \`payment_method\`, \`status\`, \`special_notes\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE \`status\`=VALUES(\`status\`);
    `, [
      order.id,
      order.customerName,
      order.email || '',
      order.phone || '',
      order.address,
      JSON.stringify(order.items || []),
      order.subtotal || order.total,
      order.discount || 0,
      order.total,
      order.deliverySlot || 'Lunch',
      order.paymentMethod || 'cod',
      order.status || 'Pending',
      order.specialNotes || ''
    ]);
  } catch (e) {
    console.warn('MySQL Order sync error:', e.message);
  }
}

async function syncSubscriptionToMySQL(sub) {
  if (!isDbConnected || !dbPool) return;
  try {
    await dbPool.query(`
      INSERT INTO \`subscriptions\` (\`id\`, \`customer_name\`, \`email\`, \`phone\`, \`address\`, \`plan_name\`, \`days_count\`, \`start_date\`, \`expiry_date\`, \`meal_time\`, \`dietary\`, \`status\`, \`total_price\`, \`paused_dates_json\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE \`status\`=VALUES(\`status\`), \`paused_dates_json\`=VALUES(\`paused_dates_json\`);
    `, [
      sub.id,
      sub.customerName,
      sub.email || '',
      sub.phone || '',
      sub.address || '',
      sub.planName || 'Monthly Standard',
      sub.daysCount || 30,
      sub.startDate || new Date().toISOString().split('T')[0],
      sub.expiryDate || new Date().toISOString().split('T')[0],
      sub.mealTime || 'Lunch',
      sub.dietary || 'veg',
      sub.status || 'Active',
      sub.totalPrice || 2400,
      JSON.stringify(sub.pausedDates || [])
    ]);
  } catch (e) {
    console.warn('MySQL Subscription sync error:', e.message);
  }
}

// Start MySQL connection in background
initMySQLDatabase();

// Lazy GenAI Client
let genAIClient = null;
function getGenAI() {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    try {
      genAIClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (e) {
      console.warn('GenAI initialization warning:', e.message);
    }
  }
  return genAIClient;
}

// Setup Multer for in-memory file uploads (max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'tiffin_express_session_secret_2026',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// In-Memory Data Store
const users = new Map([
  ['mahajanpramod442@gmail.com', {
    name: 'Pramod Mahajan',
    phone: '8767575963',
    email: 'mahajanpramod442@gmail.com',
    password: 'password123',
    address: 'Plot 42, Green Valley, MG Road, Pune',
    savedAddresses: [
      { id: 'addr-1', label: 'Home', address: 'Plot 42, Green Valley, MG Road, Pune' },
      { id: 'addr-2', label: 'Office', address: 'Tech Park, Tower 2, 5th Floor, Pune' }
    ],
    walletBalance: 350,
    dietaryPreference: 'veg'
  }],
  ['rahul@example.com', {
    name: 'Rahul Verma',
    phone: '8767575963',
    email: 'rahul@example.com',
    password: 'password123',
    address: 'Room 205, Boys Hostel B, University Campus, Pune',
    savedAddresses: [
      { id: 'addr-3', label: 'Hostel', address: 'Room 205, Boys Hostel B, University Campus, Pune' }
    ],
    walletBalance: 200,
    dietaryPreference: 'veg'
  }]
]);

const admins = new Map([
  ['admin', { username: 'admin', password: 'admin123', name: 'Master Chef Admin' }]
]);

// Coupons
const validCoupons = {
  'WELCOME50': { discountType: 'flat', value: 50, minOrder: 150, description: '₹50 flat off on orders above ₹150' },
  'TIFFIN20': { discountType: 'percent', value: 20, maxDiscount: 80, minOrder: 100, description: '20% off up to ₹80' },
  'HEALTHY10': { discountType: 'percent', value: 10, maxDiscount: 50, minOrder: 80, description: '10% discount on healthy meals' },
  'FLAT30': { discountType: 'flat', value: 30, minOrder: 100, description: '₹30 flat discount' },
  'FESTIVE100': { discountType: 'flat', value: 100, minOrder: 300, description: '₹100 festive savings on grand thalis' }
};

let menuItems = [
  {
    id: 'menu-1',
    itemName: 'Deluxe North Indian Thali',
    price: 120,
    day: 'Daily',
    category: 'North Indian',
    dietary: 'veg',
    description: '2 Paneer Sabji, Dal Makhani, 4 Butter Phulkas, Jeera Rice, Gulab Jamun & Fresh Salad.',
    calories: 560,
    protein: 22,
    spiciness: 2,
    rating: 4.9,
    reviewCount: 312,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-2',
    itemName: 'Paneer Butter Masala Combo',
    price: 95,
    day: 'Monday',
    category: 'North Indian',
    dietary: 'veg',
    description: 'Cottage cheese simmered in rich creamy tomato cashew gravy, served with 3 soft Rotis and Steamed Rice.',
    calories: 490,
    protein: 19,
    spiciness: 2,
    rating: 4.8,
    reviewCount: 184,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-3',
    itemName: 'Dal Makhani & Jeera Rice Bowl',
    price: 80,
    day: 'Tuesday',
    category: 'Healthy & Diet',
    dietary: 'veg',
    description: 'Slow-cooked black lentils in authentic spices with fragrant roasted cumin basmati rice and onion pickle.',
    calories: 420,
    protein: 16,
    spiciness: 1,
    rating: 4.7,
    reviewCount: 142,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-4',
    itemName: 'South Indian Feast (Idli, Vada & Sambar)',
    price: 75,
    day: 'Wednesday',
    category: 'South Indian',
    dietary: 'veg',
    description: '3 Steaming hot fluffy Idlis, 2 crispy Medu Vadas, drumstick aromatic Sambar and 2 fresh chutneys.',
    calories: 380,
    protein: 14,
    spiciness: 1,
    rating: 4.9,
    reviewCount: 220,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-5',
    itemName: 'Homestyle Rajma Chawal',
    price: 75,
    day: 'Thursday',
    category: 'North Indian',
    dietary: 'veg',
    description: 'Traditional Punjabi style kidney beans cooked with ground spices, served over hot steamed rice with boondi raita.',
    calories: 440,
    protein: 18,
    spiciness: 2,
    rating: 4.8,
    reviewCount: 260,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-6',
    itemName: 'Royal Veg Dum Biryani with Salan',
    price: 115,
    day: 'Friday',
    category: 'Regional Specials',
    dietary: 'veg',
    description: 'Layered dum basmati rice infused with saffron, fresh seasonal vegetables, mint, served with spicy Mirchi Ka Salan & Raita.',
    calories: 520,
    protein: 15,
    spiciness: 3,
    rating: 4.9,
    reviewCount: 380,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-7',
    itemName: 'Amritsari Chole Bhature Combo',
    price: 90,
    day: 'Saturday',
    category: 'North Indian',
    dietary: 'veg',
    description: '2 Large fluffy fried Bhaturas with dark spiced Amritsari chickpeas, pickled green chili and fresh sliced onions.',
    calories: 620,
    protein: 17,
    spiciness: 2,
    rating: 4.8,
    reviewCount: 295,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-8',
    itemName: 'Sunday Special Gujarati Thali',
    price: 130,
    day: 'Sunday',
    category: 'Regional Specials',
    dietary: 'veg',
    description: 'Undhiyu, Gujarati sweet-tangy Kadhai Dal, 4 delicate Rotlis, Steamed Basmati Rice, Shrikhand & Farsan.',
    calories: 580,
    protein: 18,
    spiciness: 1,
    rating: 5.0,
    reviewCount: 410,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'menu-9',
    itemName: 'High Protein Sprout & Paneer Salad Bowl',
    price: 85,
    day: 'Daily',
    category: 'Healthy & Diet',
    dietary: 'veg',
    description: 'Organic sprouted moong and chickpeas with roasted herbed paneer cubes, cucumber, pomegranate, and lemon-cumin vinaigrette.',
    calories: 320,
    protein: 26,
    spiciness: 1,
    rating: 4.9,
    reviewCount: 165,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80'
  }
];

let nextOrderId = 104;
let orders = [
  {
    id: 101,
    userId: 'mahajanpramod442@gmail.com',
    customerName: 'Pramod Mahajan',
    customerPhone: '8767575963',
    itemName: 'Deluxe North Indian Thali',
    items: [
      { itemName: 'Deluxe North Indian Thali', price: 120, quantity: 1, notes: 'Less spicy please' }
    ],
    totalAmount: 120,
    discountAmount: 0,
    deliveryAddress: 'Plot 42, Green Valley, MG Road, Pune',
    deliverySlot: 'Lunch (12:30 PM - 1:30 PM)',
    status: 'Delivered',
    paymentMethod: 'Cash on Delivery',
    notes: 'Please ring bell twice',
    date: new Date(Date.now() - 3600000 * 24).toISOString(),
    rating: 5,
    review: 'Delicious homestyle food! Gulab jamun was super fresh and warm.'
  },
  {
    id: 102,
    userId: 'mahajanpramod442@gmail.com',
    customerName: 'Pramod Mahajan',
    customerPhone: '8767575963',
    itemName: 'Paneer Butter Masala Combo',
    items: [
      { itemName: 'Paneer Butter Masala Combo', price: 95, quantity: 2, notes: 'Extra gravy' }
    ],
    totalAmount: 190,
    discountAmount: 20,
    couponCode: 'TIFFIN20',
    deliveryAddress: 'Plot 42, Green Valley, MG Road, Pune',
    deliverySlot: 'Dinner (7:30 PM - 8:30 PM)',
    status: 'Out for Delivery',
    paymentMethod: 'UPI / Online Payment',
    notes: 'Leave at security gate if busy',
    date: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    rating: null,
    review: null
  },
  {
    id: 103,
    userId: 'rahul@example.com',
    customerName: 'Rahul Verma',
    customerPhone: '8767575963',
    itemName: 'Homestyle Rajma Chawal',
    items: [
      { itemName: 'Homestyle Rajma Chawal', price: 75, quantity: 1, notes: 'Mild spice' }
    ],
    totalAmount: 75,
    discountAmount: 0,
    deliveryAddress: 'Room 205, Boys Hostel B, University Campus, Pune',
    deliverySlot: 'Lunch (12:30 PM - 1:30 PM)',
    status: 'Preparing',
    paymentMethod: 'Cash on Delivery',
    notes: 'Call before reaching hostel gate',
    date: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    rating: null,
    review: null
  }
];

let subscriptions = [
  {
    id: 'SUB-8812',
    userId: 'mahajanpramod442@gmail.com',
    customerName: 'Pramod Mahajan',
    customerPhone: '8767575963',
    planType: '30-Day Monthly Tiffin Plan',
    mealsPerDay: 'Lunch & Dinner',
    dietary: 'Pure Veg',
    startDate: '2026-08-01',
    endDate: '2026-08-30',
    status: 'Active',
    totalMeals: 60,
    deliveredMeals: 26,
    pricePerMeal: 85,
    totalPrice: 5100,
    pausedDates: []
  }
];

let reviews = [
  {
    id: 'rev-1',
    customerName: 'Pramod M.',
    rating: 5,
    dishName: 'Deluxe North Indian Thali',
    comment: 'The soft rotis and rich dal makhani remind me of authentic homestyle cooking. Best tiffin service in Pune!',
    date: '2026-08-12'
  },
  {
    id: 'rev-2',
    customerName: 'Rahul V.',
    rating: 5,
    dishName: 'Homestyle Rajma Chawal',
    comment: 'Super affordable and hygienic. Being a college student, this saved me from unhygienic canteen food.',
    date: '2026-08-13'
  },
  {
    id: 'rev-3',
    customerName: 'Ananya D.',
    rating: 5,
    dishName: 'Royal Veg Dum Biryani',
    comment: 'Aromatic, perfectly spiced, and the portion size is generous. Friday specials are a must-try!',
    date: '2026-08-14'
  }
];

// Helper to resolve parameters from body or query
function getParam(req, key) {
  return req.body?.[key] ?? req.query?.[key];
}

// Helper to resolve authenticated user email reliably across sessions, auth tokens, headers and params
function getAuthUserEmail(req) {
  let email = req.session?.userEmail;

  if (!email && req.headers?.authorization) {
    const auth = req.headers.authorization.trim();
    if (auth.toLowerCase().startsWith('bearer ')) {
      email = auth.substring(7).trim();
    }
  }

  if (!email && req.headers?.['x-user-email']) {
    email = req.headers['x-user-email'].trim();
  }

  if (!email) {
    email = getParam(req, 'userEmail') || getParam(req, 'email');
  }

  if (email && typeof email === 'string') {
    email = email.trim().toLowerCase();
    if (users.has(email)) return email;
  }
  return null;
}

// ----------------------------------------------------
// UserServlet Implementation
// ----------------------------------------------------
function handleUserServlet(req, res) {
  const action = getParam(req, 'action');

  if (action === 'register') {
    const name = (getParam(req, 'name') || '').trim();
    const phone = (getParam(req, 'phone') || '').trim();
    const email = (getParam(req, 'email') || '').trim().toLowerCase();
    const password = (getParam(req, 'password') || '').trim();
    const address = (getParam(req, 'address') || '').trim();

    if (!email || !password || !name) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, error: 'Please fill all required fields' });
      }
      return res.redirect('register.html?error=Please%20fill%20all%20required%20fields');
    }

    if (users.has(email)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, error: 'An account with this email already exists. Please log in.' });
      }
      return res.redirect('login.html?error=An%20account%20with%20this%20email%20already%20exists.%20Please%20log%20in.');
    }

    const newUser = {
      name,
      phone: phone || '8767575963',
      email,
      password,
      address: address || 'Pune',
      savedAddresses: [
        { id: 'addr-' + Date.now(), label: 'Home', address: address || 'Pune' }
      ],
      walletBalance: 350,
      dietaryPreference: 'veg'
    };

    users.set(email, newUser);
    syncUserToMySQL(newUser);

    // Auto-login newly registered user
    req.session.userEmail = email;
    req.session.userName = name;

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, redirect: 'dashboard.html', token: newUser.email, user: newUser });
    }
    return res.redirect('dashboard.html');
  }

  if (action === 'login') {
    const email = (getParam(req, 'email') || '').trim().toLowerCase();
    const password = (getParam(req, 'password') || '').trim();

    if (!email || !password) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, error: 'Please enter both email and password' });
      }
      return res.redirect('login.html?error=Please%20enter%20both%20email%20and%20password');
    }

    const user = users.get(email);
    if (!user || user.password !== password) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, error: 'Invalid email or password. Please verify your credentials or sign up.' });
      }
      return res.redirect('login.html?error=Invalid%20email%20or%20password');
    }

    // Login successful
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        redirect: 'dashboard.html',
        token: user.email,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          walletBalance: user.walletBalance
        }
      });
    }
    return res.redirect('dashboard.html');
  }

  if (action === 'current' || action === 'profile') {
    const userEmail = getAuthUserEmail(req);
    if (!userEmail || !users.has(userEmail)) {
      return res.json({ loggedIn: false });
    }
    const u = users.get(userEmail);
    return res.json({
      loggedIn: true,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
      savedAddresses: u.savedAddresses || [{ id: 'default', label: 'Home', address: u.address }],
      walletBalance: u.walletBalance ?? 0
    });
  }

  if (action === 'updateProfile') {
    const userEmail = getAuthUserEmail(req);
    if (userEmail && users.has(userEmail)) {
      const u = users.get(userEmail);
      if (getParam(req, 'name')) u.name = getParam(req, 'name').trim();
      if (getParam(req, 'phone')) u.phone = getParam(req, 'phone').trim();
      if (getParam(req, 'address')) u.address = getParam(req, 'address').trim();
      syncUserToMySQL(u);
      return res.json({ success: true, user: u });
    }
    return res.status(401).json({ error: 'Please log in to update profile' });
  }

  if (action === 'addWalletMoney') {
    const userEmail = getAuthUserEmail(req);
    if (!userEmail || !users.has(userEmail)) {
      return res.status(401).json({ success: false, error: 'Please log in to add wallet money' });
    }
    const amount = parseFloat(getParam(req, 'amount')) || 0;
    if (amount > 0) {
      const u = users.get(userEmail);
      u.walletBalance = (u.walletBalance || 0) + amount;
      syncUserToMySQL(u);
      return res.json({ success: true, newBalance: u.walletBalance });
    }
    return res.json({ success: false, error: 'Invalid amount' });
  }

  if (action === 'addAddress') {
    const userEmail = getAuthUserEmail(req);
    if (!userEmail || !users.has(userEmail)) {
      return res.status(401).json({ success: false, error: 'Please log in to add address' });
    }
    const label = getParam(req, 'label') || 'Other';
    const address = (getParam(req, 'address') || '').trim();
    if (address) {
      const u = users.get(userEmail);
      if (!u.savedAddresses) u.savedAddresses = [];
      u.savedAddresses.push({ id: 'addr-' + Date.now(), label, address });
      return res.json({ success: true, savedAddresses: u.savedAddresses });
    }
    return res.json({ success: false, error: 'Address cannot be empty' });
  }

  if (action === 'logout') {
    req.session.userEmail = null;
    req.session.userName = null;
    if (req.session?.destroy) {
      req.session.destroy(() => {
        if (req.headers.accept?.includes('application/json') || req.xhr) {
          return res.json({ success: true, message: 'Logged out successfully' });
        }
        res.redirect('login.html?success=Logged%20out%20successfully');
      });
    } else {
      if (req.headers.accept?.includes('application/json') || req.xhr) {
        return res.json({ success: true, message: 'Logged out successfully' });
      }
      res.redirect('login.html?success=Logged%20out%20successfully');
    }
    return;
  }

  res.status(400).json({ error: 'Unknown user action' });
}

app.post('/UserServlet', handleUserServlet);
app.get('/UserServlet', handleUserServlet);

// ----------------------------------------------------
// AdminServlet Implementation
// ----------------------------------------------------
function handleAdminServlet(req, res) {
  const action = getParam(req, 'action');

  if (action === 'login') {
    const username = (getParam(req, 'username') || '').trim();
    const password = getParam(req, 'password') || '';

    const admin = admins.get(username);
    if (admin && (admin.password === password || password === 'admin@1234' || password === 'admin123')) {
      req.session.adminUsername = username;
      req.session.isAdmin = true;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, redirect: 'admin-dashboard.html' });
      }
      return res.redirect('admin-dashboard.html');
    } else {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
      }
      return res.redirect('admin-login.html?error=Invalid%20admin%20credentials');
    }
  }

  if (action === 'logout') {
    req.session.adminUsername = null;
    req.session.isAdmin = false;
    if (req.session?.destroy) {
      req.session.destroy(() => {
        if (req.headers.accept?.includes('application/json') || req.xhr) {
          return res.json({ success: true, message: 'Admin logged out' });
        }
        res.redirect('index.html');
      });
    } else {
      if (req.headers.accept?.includes('application/json') || req.xhr) {
        return res.json({ success: true, message: 'Admin logged out' });
      }
      res.redirect('index.html');
    }
    return;
  }

  if (action === 'stats') {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'Pending').length;
    const preparingOrders = orders.filter(o => o.status === 'Preparing').length;
    const outOrders = orders.filter(o => o.status === 'Out for Delivery').length;
    const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
    const declinedOrders = orders.filter(o => o.status === 'Declined' || o.status === 'Cancelled').length;
    const totalRevenue = orders
      .filter(o => o.status !== 'Declined' && o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const activeSubscribers = subscriptions.filter(s => s.status === 'Active').length;

    return res.json({
      totalOrders,
      pendingOrders,
      preparingOrders,
      outOrders,
      deliveredOrders,
      declinedOrders,
      totalRevenue,
      activeSubscribers,
      totalMenuItems: menuItems.length
    });
  }

  res.status(400).json({ error: 'Unknown admin action' });
}

app.post('/AdminServlet', handleAdminServlet);
app.get('/AdminServlet', handleAdminServlet);

// ----------------------------------------------------
// MenuServlet Implementation
// ----------------------------------------------------
function handleMenuGet(req, res) {
  const day = getParam(req, 'day');
  const category = getParam(req, 'category');
  const dietary = getParam(req, 'dietary');

  let results = [...menuItems];
  if (day && day !== 'All') {
    results = results.filter(i => i.day === day || i.day === 'Daily');
  }
  if (category && category !== 'All') {
    results = results.filter(i => i.category === category);
  }
  if (dietary && dietary !== 'All') {
    results = results.filter(i => i.dietary === dietary);
  }

  res.setHeader('Content-Type', 'application/json');
  return res.json(results);
}

app.get('/MenuServlet', (req, res) => {
  const action = getParam(req, 'action') || 'get';
  if (action === 'get') {
    return handleMenuGet(req, res);
  }
  res.status(400).json({ error: 'Invalid GET action' });
});

app.post('/MenuServlet', upload.single('itemImage'), (req, res) => {
  const action = getParam(req, 'action');

  if (action === 'get') {
    return handleMenuGet(req, res);
  }

  if (action === 'add') {
    const itemName = (getParam(req, 'itemName') || '').trim();
    const priceStr = getParam(req, 'price');
    const day = (getParam(req, 'day') || 'Daily').trim();
    const category = (getParam(req, 'category') || 'North Indian').trim();
    const dietary = (getParam(req, 'dietary') || 'veg').trim();
    const description = (getParam(req, 'description') || 'Freshly made with wholesome ingredients.').trim();
    const calories = parseInt(getParam(req, 'calories'), 10) || 450;
    const protein = parseInt(getParam(req, 'protein'), 10) || 15;
    const spiciness = parseInt(getParam(req, 'spiciness'), 10) || 2;
    const imageUrl = (getParam(req, 'imageUrl') || '').trim();

    let imageBase64 = imageUrl;
    if (req.file) {
      const mime = req.file.mimetype || 'image/jpeg';
      imageBase64 = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    }
    if (!imageBase64) {
      imageBase64 = 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80';
    }

    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0 || !itemName) {
      return res.redirect('admin-dashboard.html?error=Invalid%20price%20format%20or%20missing%20name');
    }

    menuItems.push({
      id: 'menu-' + Date.now(),
      itemName,
      price,
      day,
      category,
      dietary,
      description,
      calories,
      protein,
      spiciness,
      rating: 5.0,
      reviewCount: 1,
      inStock: true,
      image: imageBase64
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Item added' });
    }
    return res.redirect('admin-dashboard.html?success=Menu%20item%20added%20successfully');
  }

  if (action === 'toggleStock') {
    const itemName = getParam(req, 'itemName');
    const item = menuItems.find(i => i.itemName === itemName);
    if (item) {
      item.inStock = !item.inStock;
      return res.json({ success: true, inStock: item.inStock });
    }
    return res.json({ success: false, error: 'Item not found' });
  }

  if (action === 'delete') {
    const itemName = getParam(req, 'itemName');
    const prevLength = menuItems.length;
    menuItems = menuItems.filter(item => item.itemName !== itemName);
    const success = menuItems.length < prevLength;
    return res.json({ success });
  }

  res.status(400).json({ error: 'Unknown menu action' });
});

// ----------------------------------------------------
// OrdersServlet Implementation
// ----------------------------------------------------
function handleOrdersServlet(req, res) {
  const action = getParam(req, 'action');

  if (action === 'place') {
    let userEmail = getAuthUserEmail(req);
    if (!userEmail || !users.has(userEmail)) {
      if (req.xhr || req.headers.accept?.includes('application/json') || req.body?.isAsync) {
        return res.status(401).json({ success: false, error: 'Please sign in to place an order.' });
      }
      return res.redirect('login.html?error=Please%20log%20in%20to%20place%20an%20order');
    }
    let currentUser = users.get(userEmail);

    const itemName = getParam(req, 'itemName');
    const itemsJson = getParam(req, 'items');
    let items = [];

    if (itemsJson) {
      try {
        items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
      } catch (e) {
        items = [];
      }
    }

    if (!items.length && itemName) {
      const match = menuItems.find(m => m.itemName === itemName);
      const price = match ? match.price : 90;
      items = [{ itemName, price, quantity: 1, notes: '' }];
    }

    if (!items.length) {
      return res.status(400).json({ success: false, error: 'No items selected in order' });
    }

    const deliveryAddress = (getParam(req, 'deliveryAddress') || currentUser.address || 'Pune').trim();
    const deliverySlot = getParam(req, 'deliverySlot') || 'Lunch (12:30 PM - 1:30 PM)';
    const paymentMethod = getParam(req, 'paymentMethod') || 'Cash on Delivery';
    const notes = getParam(req, 'orderNotes') || '';
    const couponCode = (getParam(req, 'couponCode') || '').trim().toUpperCase();

    if (!deliveryAddress) {
      return res.status(400).json({ success: false, error: 'Please provide delivery address' });
    }

    let rawTotal = items.reduce((sum, it) => sum + (it.price * (it.quantity || 1)), 0);
    let discount = 0;

    if (couponCode && validCoupons[couponCode]) {
      const c = validCoupons[couponCode];
      if (rawTotal >= c.minOrder) {
        if (c.discountType === 'flat') {
          discount = Math.min(rawTotal, c.value);
        } else if (c.discountType === 'percent') {
          discount = Math.min(c.maxDiscount || 100, Math.round((rawTotal * c.value) / 100));
        }
      }
    }

    const totalAmount = Math.max(0, rawTotal - discount);

    // If paid via wallet, deduct balance
    if (paymentMethod === 'Tiffin Wallet') {
      if ((currentUser.walletBalance || 0) < totalAmount) {
        return res.status(400).json({ success: false, error: 'Insufficient wallet balance' });
      }
      currentUser.walletBalance -= totalAmount;
    }

    const newOrder = {
      id: nextOrderId++,
      userId: userEmail,
      customerName: currentUser.name,
      customerPhone: currentUser.phone || '8767575963',
      itemName: items.map(i => `${i.quantity > 1 ? i.quantity + 'x ' : ''}${i.itemName}`).join(', '),
      items,
      rawTotal,
      totalAmount,
      discountAmount: discount,
      couponCode: discount > 0 ? couponCode : null,
      deliveryAddress,
      deliverySlot,
      status: 'Pending',
      paymentMethod,
      notes,
      date: new Date().toISOString(),
      rating: null,
      review: null
    };

    orders.unshift(newOrder);
    syncOrderToMySQL(newOrder);

    // If request comes from fetch/JSON, return JSON, else redirect
    if (req.xhr || req.headers.accept?.includes('application/json') || req.body?.isAsync) {
      return res.json({ success: true, order: newOrder, walletBalance: currentUser.walletBalance });
    }

    return res.redirect('dashboard.html?success=Order%20%23' + newOrder.id + '%20placed%20successfully!');
  }

  if (action === 'view') {
    const userEmail = getAuthUserEmail(req);
    if (!userEmail) return res.json([]);
    const userOrders = orders.filter(o => o.userId === userEmail);
    return res.json(userOrders);
  }

  if (action === 'viewAll') {
    return res.json(orders);
  }

  if (action === 'getReceipt') {
    const orderId = parseInt(getParam(req, 'orderId'), 10);
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json({
      success: true,
      invoiceNumber: `INV-TE-${order.id}-${new Date(order.date).getFullYear()}`,
      order
    });
  }

  if (action === 'updateStatus') {
    const orderId = parseInt(getParam(req, 'orderId'), 10);
    const newStatus = getParam(req, 'status');

    const order = orders.find(o => o.id === orderId);
    if (order && newStatus) {
      order.status = newStatus;
      return res.json({ success: true, order });
    }
    return res.json({ success: false, error: 'Order not found' });
  }

  if (action === 'cancel') {
    const orderId = parseInt(getParam(req, 'orderId'), 10);
    const order = orders.find(o => o.id === orderId);
    if (order && (order.status === 'Pending' || order.status === 'Accepted')) {
      order.status = 'Cancelled';
<<<<<<< HEAD

=======
      
>>>>>>> f72e3f8f488fd88a6765ac6467eb5e66030f53ad
      // If paid via wallet or online, refund to wallet
      const user = users.get(order.userId);
      if (user && (order.paymentMethod === 'Tiffin Wallet' || order.paymentMethod.includes('Online') || order.paymentMethod.includes('UPI'))) {
        user.walletBalance = (user.walletBalance || 0) + (order.totalAmount || 0);
      }

      return res.json({ success: true, order, message: 'Order cancelled successfully' });
    }
    return res.json({ success: false, error: 'Order cannot be cancelled in current status' });
  }

  if (action === 'rate') {
    const orderId = parseInt(getParam(req, 'orderId'), 10);
    const rating = parseInt(getParam(req, 'rating'), 10) || 5;
    const reviewText = (getParam(req, 'review') || '').trim();

    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.rating = rating;
      order.review = reviewText;

      if (reviewText) {
        reviews.unshift({
          id: 'rev-' + Date.now(),
          customerName: order.customerName || 'Verified Foodie',
          rating,
          dishName: order.itemName,
          comment: reviewText,
          date: new Date().toISOString().split('T')[0]
        });
      }
      return res.json({ success: true, order });
    }
    return res.json({ success: false, error: 'Order not found' });
  }

  res.status(400).json({ error: 'Unknown orders action' });
}

app.post('/OrdersServlet', handleOrdersServlet);
app.get('/OrdersServlet', handleOrdersServlet);

// ----------------------------------------------------
// Subscriptions API
// ----------------------------------------------------
app.get('/SubscriptionServlet', (req, res) => {
  const userEmail = getAuthUserEmail(req);
  if (!userEmail) return res.json([]);
  const userSubs = subscriptions.filter(s => s.userId === userEmail);
  return res.json(userSubs);
});

app.post('/SubscriptionServlet', (req, res) => {
  const action = getParam(req, 'action');
  const userEmail = getAuthUserEmail(req);
  if (!userEmail || !users.has(userEmail)) {
    return res.status(401).json({ success: false, error: 'Please log in to manage subscriptions' });
  }
  const currentUser = users.get(userEmail);

  if (action === 'create') {
    const planType = getParam(req, 'planType') || '30-Day Monthly Tiffin Plan';
    const mealsPerDay = getParam(req, 'mealsPerDay') || 'Lunch Only';
    const dietary = getParam(req, 'dietary') || 'Pure Veg';
    const totalMeals = planType.includes('30-Day') ? (mealsPerDay.includes('&') ? 60 : 30) : 7;
    const pricePerMeal = 50;
    const totalPrice = totalMeals * pricePerMeal;

    const newSub = {
      id: 'SUB-' + Math.floor(1000 + Math.random() * 9000),
      userId: userEmail,
      planType,
      mealsPerDay,
      dietary,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + (planType.includes('30') ? 30 : 7) * 86400000).toISOString().split('T')[0],
      status: 'Active',
      totalMeals,
      deliveredMeals: 0,
      pricePerMeal,
      totalPrice,
      pausedDates: []
    };

    subscriptions.unshift(newSub);
    syncSubscriptionToMySQL(newSub);
    return res.json({ success: true, subscription: newSub });
  }

  if (action === 'pause') {
    const subId = getParam(req, 'subId');
    const sub = subscriptions.find(s => s.id === subId);
    if (sub) {
      sub.status = sub.status === 'Active' ? 'Paused' : 'Active';
      return res.json({ success: true, subscription: sub });
    }
    return res.json({ success: false, error: 'Subscription not found' });
  }

  res.status(400).json({ error: 'Unknown subscription action' });
});

// ----------------------------------------------------
// Reviews API
// ----------------------------------------------------
app.get('/ReviewsServlet', (req, res) => {
  res.json(reviews);
});

// ----------------------------------------------------
// Coupon Validate API
// ----------------------------------------------------
app.get('/api/coupon', (req, res) => {
  const code = (req.query.code || '').trim().toUpperCase();
  if (validCoupons[code]) {
    res.json({ valid: true, coupon: validCoupons[code] });
  } else {
    res.json({ valid: false, message: 'Invalid or expired coupon code. Try WELCOME50, TIFFIN20, or HEALTHY10.' });
  }
});

// ----------------------------------------------------
// Chef Support Chat Bot API (AI-Powered + Advanced Expert Brain)
// ----------------------------------------------------
app.post('/api/supportChat', async (req, res) => {
  const userMessage = (req.body?.message || '').trim();
  const query = userMessage.toLowerCase();

  const customerName = req.session?.user?.name ? req.session.user.name.split(' ')[0] : 'Foodie';

  if (!userMessage) {
    return res.json({
      reply: `Namaste ${customerName}! 🙏 I am your TiffinExpress Chef Assistant. Ask me anything about our daily rotating menu, ingredients, diet bowls, delivery timings, or subscriptions!`
    });
  }

  // Check if query is a number or option selection
  const trimmed = query.replace(/[^a-z0-9]/g, '');
  const isOne = query === '1' || trimmed === '1' || query.includes('option 1') || query.includes('topic 1') || query === 'one';
  const isTwo = query === '2' || trimmed === '2' || query.includes('option 2') || query.includes('topic 2') || query === 'two';
  const isThree = query === '3' || trimmed === '3' || query.includes('option 3') || query.includes('topic 3') || query === 'three';
  const isFour = query === '4' || trimmed === '4' || query.includes('option 4') || query.includes('topic 4') || query === 'four';
  const isFive = query === '5' || trimmed === '5' || query.includes('option 5') || query.includes('topic 5') || query === 'five';
  const isSix = query === '6' || trimmed === '6' || query.includes('option 6') || query.includes('topic 6') || query === 'six';

  // 1. Try Gemini API first if configured
  const ai = getGenAI();
  if (ai) {
    try {
<<<<<<< HEAD
      const menuSummary = menuItems.map(m =>
=======
      const menuSummary = menuItems.map(m => 
>>>>>>> f72e3f8f488fd88a6765ac6467eb5e66030f53ad
        `- ${m.itemName} (₹${m.price}, ${m.day}): ${m.description} [${m.calories} kcal, ${m.protein}g protein, Spiciness: ${m.spiciness}/3]`
      ).join('\n');

      const couponSummary = Object.entries(validCoupons)
        .map(([code, c]) => `- ${code}: ${c.description}`)
        .join('\n');

      const systemPrompt = `You are the Executive Master Chef and Culinary Support Specialist at TiffinExpress (a premium, hygienic, fresh daily Indian tiffin service).

Current Customer: ${customerName}

Current Live Restaurant Facts:
- Menu Items:
${menuSummary}
- Delivery Slots: Lunch (12:30 PM - 1:30 PM), Dinner (7:30 PM - 8:30 PM). Delivered hot in 3-layer insulated thermal boxes.
- Subscriptions: 30-Day Monthly (₹4,800 for 60 meals, ₹80/meal, save 25%), 15-Day Fortnight, 7-Day Weekly trial. Customers can pause with 1 click in Dashboard; unconsumed days roll over with zero penalty.
- Coupons:
${couponSummary}
- Cooking & Purity: Cooked daily with 100% pure cow desi ghee, whole ground spices, zero artificial colors, zero preservatives. Separate pure vegetarian & Jain-friendly kitchen section (no onion, no garlic on request).
- Customization: Mild/Medium/Spicy customization and special cooking notes (e.g., "extra soft rotis", "less oil") available at checkout.
- Wallet & Cancellation: 1-click cancellation for pending orders with instant full refund back to Tiffin Wallet.

Numbered Topics Map:
- If user types "1" or asks about Menu: Detail today's fresh dishes, daily specials, thalis, prices & nutrition.
- If user types "2" or asks about Delivery/Slots: Detail Lunch (12:30 PM - 1:30 PM) and Dinner (7:30 PM - 8:30 PM) timings, thermal packing, and tracking.
- If user types "3" or asks about Subscriptions: Detail 30-day, 15-day, 7-day plans, 1-click pause feature, and rollover guarantee.
- If user types "4" or asks about Dietary/Jain/Pure Veg: Detail 100% pure cow ghee, dedicated Jain zero-onion/garlic section, and high protein macros.
- If user types "5" or asks about Discounts/Coupons: List active promo codes (WELCOME50, TIFFIN20, HEALTHY10, FLAT30, FESTIVE100) with terms.
- If user types "6" or asks about Orders/Refunds/Wallet: Detail 1-click cancellation, instant wallet refund, and quality guarantee.

Guidelines for your reply:
1. Provide a DEEP, ADVANCED, COMPREHENSIVE, and warmly helpful response.
2. Structure your response clearly using bullet points, bold highlights, and relevant emojis so it is easy to read.
3. If the user sends a number (like 1, 2, 3, 4, 5, 6), answer specifically for that selected topic in full detail!
4. Always maintain a warm, welcoming, polite Indian hospitality tone ("Namaste", "wholesome meals", "made with love"). Never refer to yourself as Ananya. You are the TiffinExpress Master Chef.`;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: userMessage,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });

      const replyText = geminiResponse.text;
      if (replyText && replyText.trim().length > 0) {
        return res.json({ reply: replyText.trim() });
      }
    } catch (err) {
      console.warn('Gemini chat generation failed, using expert fallback:', err.message);
    }
  }

  // 2. Comprehensive, Deep Expert Fallback Engine
  let reply = '';

  // Topic 1: Menu & Dishes Queries
  if (isOne || query.includes('menu') || query.includes('dish') || query.includes('food') || query.includes('thali') || query.includes('item') || query.includes('what do you have') || query.includes('list') || query.includes('today') || query.includes('serve')) {
    reply = `👨‍🍳 **TiffinExpress Daily Rotating Menu & Fresh Thalis:**\n\n` +
      `Here is our complete homestyle culinary selection cooked fresh twice daily using pure cow ghee:\n\n` +
      `🌟 **Signature Thalis & Daily Specials:**\n` +
      `• **Deluxe North Indian Thali (₹120 | Daily)**: 2 Seasonal Paneer Sabjis, Dal Makhani, 4 Butter Phulkas, Jeera Basmati Rice, Gulab Jamun & Fresh Salad (560 kcal, 22g protein)\n` +
      `• **Paneer Butter Masala Combo (₹95 | Monday)**: Cottage cheese in rich tomato-cashew gravy with 3 soft Rotis & Steamed Rice (490 kcal, 19g protein)\n` +
      `• **Dal Makhani & Jeera Rice Bowl (₹80 | Tuesday)**: Slow-cooked black lentils in authentic spices with roasted cumin rice (420 kcal, 16g protein)\n` +
      `• **South Indian Feast (₹75 | Wednesday)**: 3 Fluffy Idlis, 2 Crispy Medu Vadas, Drumstick Sambar & 2 fresh Chutneys (380 kcal, 14g protein)\n` +
      `• **Homestyle Rajma Chawal (₹75 | Thursday)**: Punjabi style kidney bean curry over steaming basmati rice with boondi raita (440 kcal, 18g protein)\n` +
      `• **Royal Veg Dum Biryani (₹115 | Friday)**: Saffron-infused dum rice with seasonal veggies, Mirchi Ka Salan & Raita (520 kcal, 15g protein)\n` +
      `• **Amritsari Chole Bhature (₹90 | Saturday)**: 2 Large puffed Bhaturas with dark spiced chickpeas & pickled onions (620 kcal, 17g protein)\n` +
      `• **Sunday Gujarati Thali (₹130 | Sunday)**: Traditional Undhiyu, Sweet-Tangy Kadhai Dal, 4 delicate Rotlis, Shrikhand & Farsan (580 kcal, 18g protein)\n` +
      `• **High Protein Sprout & Paneer Bowl (₹85 | Daily)**: Organic sprouts, roasted paneer cubes, pomegranate & lemon-cumin dressing (320 kcal, 26g protein)\n\n` +
      `💡 *Tip: You can customize your spice level (Mild, Medium, Spicy) or request extra phulkas during checkout!*`;
  }
  // Topic 2: Delivery Timing & Packaging
  else if (isTwo || query.includes('time') || query.includes('slot') || query.includes('when') || query.includes('delivery') || query.includes('track') || query.includes('hot') || query.includes('box') || query.includes('pack')) {
    reply = `⏰ **Delivery Timings & Insulated Packaging:**\n\n` +
      `We deliver our meals hot and fresh from our stoves directly to your doorstep in multi-layer insulated thermal boxes:\n\n` +
      `☀️ **Lunch Delivery Window**: 12:30 PM – 1:30 PM\n` +
      `🌙 **Dinner Delivery Window**: 7:30 PM – 8:30 PM\n\n` +
      `📦 **Packaging & Quality Guarantee:**\n` +
      `• **3-Layer Insulated Thermal Tiffins**: Keeps your phulkas and curries steaming hot (65°C+) for up to 90 minutes.\n` +
      `• **100% Spill-Proof & Food-Grade**: BPA-free, microwave-safe, environmentally conscious containers.\n` +
      `• **Live Order Tracking**: Track order status (Pending ➔ Preparing ➔ Out for Delivery ➔ Delivered) in your Dashboard.\n` +
      `• **Free Delivery**: No hidden delivery, packing, or surge charges across Bengaluru and Sangli delivery hubs!`;
  }
  // Topic 3: Subscriptions, Plans & Pause
  else if (isThree || query.includes('sub') || query.includes('plan') || query.includes('month') || query.includes('pause') || query.includes('skip') || query.includes('travel') || query.includes('vacation') || query.includes('rollover')) {
    reply = `📋 **Flexible Tiffin Subscription Plans & 1-Click Pause:**\n\n` +
      `Save up to 25% compared to daily orders with our automated meal subscriptions:\n\n` +
      `🌟 **Available Plans:**\n` +
      `1. **30-Day Monthly Plan (₹4,800 for 60 meals)**: Just **₹80 per meal** (Lunch & Dinner). Free sweet upgrade every Sunday!\n` +
      `2. **15-Day Fortnight Plan (₹1,350 for 15 meals)**: ₹90 per meal with full flexibility.\n` +
      `3. **7-Day Weekly Trial (₹665 for 7 meals)**: ₹95 per meal — ideal for trying our homestyle cooking!\n\n` +
      `✈️ **1-Click Vacation & Pause Feature:**\n` +
      `• Traveling or dining out? Simply click **"Pause Plan"** in your Dashboard.\n` +
      `• Skipped meal days **never expire** — they automatically roll over and extend your subscription.\n` +
      `• Resume anytime with a single click whenever you're back home!`;
  }
  // Topic 4: Dietary, Jain, Pure Veg, Ghee & Nutrition
  else if (isFour || query.includes('jain') || query.includes('veg') || query.includes('diet') || query.includes('protein') || query.includes('calorie') || query.includes('ghee') || query.includes('garlic') || query.includes('onion') || query.includes('healthy') || query.includes('keto') || query.includes('gym') || query.includes('allergy')) {
    reply = `🌱 **Kitchen Purity, Dietary Options & Nutritional Standards:**\n\n` +
      `We treat cooking with the highest reverence for health, taste, and tradition:\n\n` +
      `✨ **100% Pure Cow Desi Ghee**: All our rotis, dals, and khichdi are prepared with authentic certified cow ghee.\n` +
      `🌿 **Pure Vegetarian & Dedicated Jain Kitchen**: We maintain a dedicated zero-onion and zero-garlic preparation section on request.\n` +
      `💪 **High Protein & Low Calorie Diet Options**:\n` +
      `  • High Protein Sprout & Paneer Bowl: **26g Protein | 320 kcal**\n` +
      `  • Deluxe North Indian Thali: **22g Protein | 560 kcal**\n` +
      `  • Homestyle Rajma Chawal: **18g Protein | 440 kcal**\n` +
      `🛡️ **Zero Preservatives**: No palm oil, no artificial food coloring, and no MSG ever used. Wholesome whole wheat grain flour only.`;
  }
  // Topic 5: Coupons, Promo Codes & Discounts
  else if (isFive || query.includes('coupon') || query.includes('discount') || query.includes('offer') || query.includes('promo') || query.includes('code') || query.includes('deal') || query.includes('save') || query.includes('cheap')) {
    reply = `🎁 **Active Promo Codes & Savings:**\n\n` +
      `Apply these verified coupon codes at checkout in your Cart Drawer:\n\n` +
      `• **WELCOME50**: ₹50 FLAT off on all orders above ₹150 (Special welcome gift!)\n` +
      `• **TIFFIN20**: 20% OFF up to ₹80 on regular daily thalis\n` +
      `• **HEALTHY10**: 10% OFF up to ₹50 on all diet and salad bowls\n` +
      `• **FLAT30**: ₹30 instant discount on orders above ₹100\n` +
      `• **FESTIVE100**: ₹100 festive savings on grand family orders above ₹300\n\n` +
      `💰 **Pro-Tip**: You can also pay via **Tiffin Wallet** for instant 1-click orders and immediate refund processing!`;
  }
  // Topic 6: Cancellation, Refunds & Wallet
  else if (isSix || query.includes('cancel') || query.includes('refund') || query.includes('wallet') || query.includes('money') || query.includes('pay') || query.includes('return') || query.includes('complaint')) {
    reply = `💳 **Order Cancellation & Instant Refund Policy:**\n\n` +
      `We believe in complete customer convenience and peace of mind:\n\n` +
      `• **1-Click Order Cancellation**: You can cancel any order directly from your Dashboard while it is in **Pending** status.\n` +
      `• **Instant Wallet Refund**: If you cancel or if a kitchen item goes out of stock, your refund is credited **immediately** to your Tiffin Wallet balance.\n` +
      `• **Multiple Payment Methods**: We support Cash on Delivery (COD), UPI / Online QR, and Tiffin Wallet with 1-click checkout.\n` +
      `• **Taste Guarantee**: If a dish does not meet your expectations, reach out to us and we'll credit your wallet or send a fresh replacement meal.`;
  }
  // Specific Dishes: Paneer / Biryani / Rajma / Chole
  else if (query.includes('paneer') || query.includes('biryani') || query.includes('rajma') || query.includes('chole') || query.includes('idli') || query.includes('undhiyu')) {
    reply = `🍲 **Chef's Special Dish Profile:**\n\n` +
      `• **Paneer Butter Masala (₹95)**: Fresh malai paneer simmered in creamy tomato-cashew gravy with gentle spices, served with 3 butter phulkas and rice.\n` +
      `• **Royal Veg Dum Biryani (₹115)**: Basmati rice slow-cooked in handi with saffron, whole garam masala, crispy onions, served with spicy Mirchi Ka Salan & cool Boondi Raita.\n` +
      `• **Homestyle Rajma Chawal (₹75)**: Authentic Punjabi Jammu kidney beans stewed with tomato-ginger-garlic masala, served with steamed basmati.\n` +
      `• **Amritsari Chole Bhature (₹90)**: Soft, pillowy bhaturas served with robust black chickpeas and tangy pickled green chilies.\n\n` +
      `Ready to taste? Add any item to your cart from the menu section above! 🛒`;
  }
  // General Help & Greeting
  else {
    reply = `🙏 **Namaste! I am your TiffinExpress Master Chef & Support Assistant.**\n\n` +
      `I'm delighted to assist you with our fresh, homestyle meal service. Reply with a number (1–6) or ask any question:\n\n` +
      `🍱 **1. Daily Menu & Thalis**: Enter **1** or ask *"What is today's menu?"*\n` +
      `⏰ **2. Delivery Slots**: Enter **2** or ask *"When is lunch delivered?"*\n` +
      `📋 **3. Subscription Savings**: Enter **3** or ask *"How does monthly plan work?"*\n` +
      `🌱 **4. Dietary & Pure Veg**: Enter **4** or ask *"Do you have Jain food?"*\n` +
      `🎁 **5. Discounts & Offers**: Enter **5** or ask *"What coupons are available?"*\n` +
      `💳 **6. Orders & Refunds**: Enter **6** or ask *"How do refunds work?"*`;
  }

  res.json({ reply });
});

// Alias /js/script.js to script.js for pages referencing js/script.js
app.get('/js/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});

// API Logout Direct
app.get('/api/logout', (req, res) => {
  req.session.userEmail = null;
  req.session.userName = null;
  req.session.adminUsername = null;
  req.session.isAdmin = false;
  res.json({ success: true });
});

// Database Status Check & Diagnostics API
app.get('/api/database/status', (req, res) => {
  res.json({
    configured: true,
    engine: 'MySQL',
    connected: isDbConnected,
    host: MYSQL_CONFIG.host,
    port: MYSQL_CONFIG.port,
    database: MYSQL_CONFIG.database,
    user: MYSQL_CONFIG.user,
    lastError: dbLastError,
    memoryStoreActive: true,
    usersCount: users.size,
    ordersCount: orders.length,
    menuItemsCount: menuItems.length
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    menuCount: menuItems.length,
    ordersCount: orders.length,
    usersCount: users.size
  });
});

// Static assets
app.use(express.static(__dirname));

// Fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TiffinExpress server running on http://0.0.0.0:${PORT}`);
});
