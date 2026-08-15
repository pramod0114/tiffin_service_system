-- ============================================================
-- TiffinExpress MySQL Database Schema
-- Database: tiffin_service
-- User: root / Password: admin@1234
-- ============================================================

CREATE DATABASE IF NOT EXISTS `tiffin_service_new` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tiffin_service_new`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `phone` VARCHAR(20) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `address` TEXT NOT NULL,
    `dietary_preference` VARCHAR(50) DEFAULT 'veg',
    `wallet_balance` DECIMAL(10, 2) DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Saved Addresses
CREATE TABLE IF NOT EXISTS `saved_addresses` (
    `id` VARCHAR(64) PRIMARY KEY,
    `user_email` VARCHAR(150) NOT NULL,
    `label` VARCHAR(50) NOT NULL,
    `address` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Admins Table
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `role` VARCHAR(50) DEFAULT 'admin',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Menu Items Table
CREATE TABLE IF NOT EXISTS `menu_items` (
    `id` VARCHAR(64) PRIMARY KEY,
    `item_name` VARCHAR(150) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `day` VARCHAR(20) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `dietary` VARCHAR(20) DEFAULT 'veg',
    `description` TEXT,
    `calories` INT DEFAULT 450,
    `protein` INT DEFAULT 15,
    `spiciness` INT DEFAULT 2,
    `rating` DECIMAL(2, 1) DEFAULT 4.8,
    `review_count` INT DEFAULT 0,
    `in_stock` BOOLEAN DEFAULT TRUE,
    `image` VARCHAR(500),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS `orders` (
    `id` VARCHAR(64) PRIMARY KEY,
    `customer_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `address` TEXT NOT NULL,
    `items_json` JSON NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount` DECIMAL(10, 2) DEFAULT 0.00,
    `total` DECIMAL(10, 2) NOT NULL,
    `delivery_slot` VARCHAR(50) DEFAULT 'Lunch (12:30 PM - 1:30 PM)',
    `payment_method` VARCHAR(50) DEFAULT 'cod',
    `status` VARCHAR(50) DEFAULT 'Pending',
    `special_notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Subscriptions Table
CREATE TABLE IF NOT EXISTS `subscriptions` (
    `id` VARCHAR(64) PRIMARY KEY,
    `customer_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `address` TEXT NOT NULL,
    `plan_name` VARCHAR(100) NOT NULL,
    `days_count` INT NOT NULL,
    `start_date` DATE NOT NULL,
    `expiry_date` DATE NOT NULL,
    `meal_time` VARCHAR(50) NOT NULL,
    `dietary` VARCHAR(50) DEFAULT 'veg',
    `status` VARCHAR(50) DEFAULT 'Active',
    `total_price` DECIMAL(10, 2) NOT NULL,
    `paused_dates_json` JSON,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Reviews Table
CREATE TABLE IF NOT EXISTS `reviews` (
    `id` VARCHAR(64) PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `rating` INT NOT NULL,
    `comment` TEXT NOT NULL,
    `dish` VARCHAR(150) NOT NULL,
    `date` VARCHAR(50) NOT NULL,
    `verified` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Coupons Table
CREATE TABLE IF NOT EXISTS `coupons` (
    `code` VARCHAR(50) PRIMARY KEY,
    `discount_type` VARCHAR(20) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `max_discount` DECIMAL(10, 2) DEFAULT NULL,
    `min_order` DECIMAL(10, 2) DEFAULT 0.00,
    `description` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
    `id` VARCHAR(64) PRIMARY KEY,
    `user_email` VARCHAR(150) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `type` VARCHAR(20) NOT NULL, -- 'credit' or 'debit'
    `description` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INITIAL SEED DATA
-- ============================================================

-- Seed Default Admin (admin / admin123)
INSERT INTO `admins` (`username`, `password`, `name`, `role`)
VALUES ('admin', 'admin123', 'Kitchen Master Admin', 'admin')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Seed Promo Coupons
INSERT INTO `coupons` (`code`, `discount_type`, `value`, `max_discount`, `min_order`, `description`, `is_active`) VALUES
('WELCOME50', 'flat', 50.00, NULL, 150.00, '₹50 flat off on orders above ₹150', TRUE),
('TIFFIN20', 'percent', 20.00, 80.00, 100.00, '20% off up to ₹80', TRUE),
('HEALTHY10', 'percent', 10.00, 50.00, 80.00, '10% discount on healthy meals', TRUE),
('FLAT30', 'flat', 30.00, NULL, 100.00, '₹30 flat discount', TRUE),
('FESTIVE100', 'flat', 100.00, NULL, 300.00, '₹100 festive savings on grand thalis', TRUE)
ON DUPLICATE KEY UPDATE `description`=VALUES(`description`);

-- Seed Menu Items
INSERT INTO `menu_items` (`id`, `item_name`, `price`, `day`, `category`, `dietary`, `description`, `calories`, `protein`, `spiciness`, `rating`, `review_count`, `in_stock`, `image`) VALUES
('menu-1', 'Deluxe North Indian Thali', 120.00, 'Daily', 'North Indian', 'veg', '2 Paneer Sabji, Dal Makhani, 4 Butter Phulkas, Jeera Rice, Gulab Jamun & Fresh Salad.', 560, 22, 2, 4.9, 312, TRUE, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&auto=format&fit=crop&q=80'),
('menu-2', 'Paneer Butter Masala Combo', 95.00, 'Monday', 'North Indian', 'veg', 'Rich cottage cheese gravy served with 3 soft rotis, steamed basmati rice & pickle.', 490, 19, 2, 4.8, 184, TRUE, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80'),
('menu-3', 'Dal Makhani & Jeera Rice Bowl', 80.00, 'Tuesday', 'North Indian', 'veg', 'Slow-cooked creamy black lentils over fragrant cumin rice with fresh cucumber salad.', 420, 16, 1, 4.7, 142, TRUE, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80'),
('menu-4', 'South Indian Feast', 75.00, 'Wednesday', 'South Indian', 'veg', '3 Soft Idlis, 2 Medu Vadas, homestyle drumstick Sambar & 2 fresh coconut chutneys.', 380, 14, 2, 4.9, 219, TRUE, 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=600&auto=format&fit=crop&q=80'),
('menu-5', 'Homestyle Rajma Chawal', 75.00, 'Thursday', 'North Indian', 'veg', 'Authentic Punjabi spiced kidney beans with long-grain basmati rice and boondi raita.', 440, 18, 2, 4.8, 267, TRUE, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80'),
('menu-6', 'Royal Veg Dum Biryani', 115.00, 'Friday', 'Biryani & Rice', 'veg', 'Slow-cooked handi dum rice with fresh garden vegetables, saffron, salan & mint raita.', 520, 15, 3, 4.9, 410, TRUE, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80'),
('menu-7', 'Amritsari Chole Bhature', 90.00, 'Saturday', 'North Indian', 'veg', '2 Fluffy puffed Bhaturas with dark spiced chickpea curry, pickled chillies & onions.', 620, 17, 3, 4.8, 385, TRUE, 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80'),
('menu-8', 'Sunday Gujarati Special Thali', 130.00, 'Sunday', 'Gujarati', 'veg', 'Authentic Undhiyu, Kadhai Dal, 4 Phulkas, Steamed Rice, Shrikhand, Dhokla & Papad.', 580, 18, 1, 5.0, 520, TRUE, 'https://images.unsplash.com/photo-1613292443284-8d10ef9383fe?w=600&auto=format&fit=crop&q=80'),
('menu-9', 'High Protein Sprout & Paneer Bowl', 85.00, 'Daily', 'Healthy & Diet', 'diet', 'Organic sprouted moong, roasted cow-ghee paneer cubes, pomegranate & roasted cumin dressing.', 320, 26, 1, 4.9, 178, TRUE, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80')
ON DUPLICATE KEY UPDATE `item_name`=VALUES(`item_name`);
