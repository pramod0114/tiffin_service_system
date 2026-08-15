# 🍱 Tiffin Service Management System (Dabba Express)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4.18+-lightgrey.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-v8.0+-blue.svg)](https://www.mysql.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A complete, full-featured web application for homestyle daily meal delivery, custom meal planning, real-time dispatch tracking, and subscription management. Built with a responsive vanilla JavaScript/HTML5/CSS3 frontend, a high-performance Node.js & Express.js backend, and enterprise-grade MySQL database integration with automatic schema synchronization and in-memory fallback.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
  - [Customer Features](#-customer-features)
  - [Admin Management Features](#-admin-management-features)
- [Screenshots & UI Modules](#-screenshots--ui-modules)
- [Tech Stack](#-tech-stack)
- [System Architecture & Database Design](#-system-architecture--database-design)
- [Getting Started](#-getting-started)
  - [Prerequisites](#1-prerequisites)
  - [Installation](#2-installation)
  - [Environment Configuration](#3-environment-configuration)
- [MySQL Database Setup Guide](#-mysql-database-setup-guide)
  - [Method 1: Automatic Auto-Migration (Recommended)](#method-1-automatic-auto-migration-recommended)
  - [Method 2: phpMyAdmin Import](#method-2-phpmyadmin-import)
  - [Method 3: MySQL CLI Import](#method-3-mysql-cli-import)
- [Default Login Credentials](#-default-login-credentials)
- [API Documentation & Endpoints](#-api-documentation--endpoints)
  - [Authentication Endpoints](#1-authentication-endpoints)
  - [Subscriptions & Plans](#2-subscriptions--plans)
  - [Orders & Live Tracking](#3-orders--live-tracking)
  - [Admin Operations](#4-admin-operations)
- [Project Directory Structure](#-project-directory-structure)
- [Deployment Guide](#-deployment-guide)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

The **Tiffin Service Management System** solves the daily challenge of meal planning, preparation, and doorstep delivery for working professionals, students, and families. It bridges the gap between home chefs / commercial cloud kitchens and hungry consumers through an automated subscription and dispatch platform.

---

## 🚀 Key Features

### 👤 Customer Features
- **Interactive Landing Page (`index.html`)**:
  - **Live Meal Budget Calculator**: Calculates real-time savings (₹3,000 monthly plan @ ₹50/meal for 60 meals vs. restaurant costs).
  - **Dynamic Menu Showcase**: Multi-cuisine rotation (Standard Homestyle Thali, High Protein Diet Bowl, Deluxe Paneer Thali).
  - **Customer Reviews & Testimonials**: Verified ratings, health & hygiene compliance scores.
  - **Chef Helpline & FAQ Accordion**: Instant answers to common delivery questions.
- **Authentication & Security (`login.html`, `register.html`)**:
  - Account registration with email format & mobile number validation.
  - Secure credential checking with session persistence in `localStorage` & `sessionStorage`.
  - Automatic redirect to the personalized dashboard after login.
- **Customer Self-Service Dashboard (`dashboard.html`)**:
  - **Subscription Overview**: Real-time remaining meals counter, active plan status, expiry date, and meal type.
  - **Live Delivery Radar**: Delivery partner details, phone number, vehicle type, real-time progress bar, and estimated arrival time.
  - **Instant Pause / Resume**: Allows users to freeze delivery schedules when traveling with zero penalties.
  - **Meal Customization**: Switch between Pure Veg, Jain, Non-Veg, adjust spice level, and opt for extra chapatis.
  - **Order History & Invoices**: Detailed transaction ledger with downloadable receipts and delivery status badges.
  - **In-App Wallet**: Recharging wallet, instant payment checkouts, and promotional discount code redemption.
  - **Meal Feedback**: 5-star rating system with comments directly viewable by the head chef.

### 🛡️ Admin Management Features (`admin-dashboard.html`)
- **Executive Analytics Dashboard**:
  - Total active subscribers & retention rate.
  - Today's dispatched meals vs. pending preparations.
  - Monthly Recurring Revenue (MRR) & net earnings summary.
- **Kitchen & Order Dispatch Control**:
  - Real-time order pipeline: `Received` ➔ `In Kitchen (Prepping)` ➔ `Out for Delivery` ➔ `Delivered`.
  - Filter orders by time slot (Lunch vs. Dinner) and delivery zones.
- **Menu & Pricing Management**:
  - Add, edit, or toggle daily availability for breakfast, lunch, and dinner items.
  - Set custom daily special dishes.
- **User & Subscription Oversight**:
  - View full customer roster with contact details, active plans, and lifetime spend.
  - Manual subscription renewal, plan upgrade, or refund issuance.
- **Support & Inquiries Inbox**:
  - Read customer feedback, meal change requests, and contact inquiries.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Modern Flexbox, CSS Grid, Custom Design Tokens), Vanilla ES6+ JavaScript |
| **Backend Framework** | Node.js, Express.js (REST API & legacy servlet compatibility) |
| **Database** | MySQL 8.0+ / MariaDB (`mysql2/promise` connection pooling) |
| **Fallback Storage** | Robust In-Memory and JSON Data Store (ensures zero-config running out of the box) |
| **Session & State** | Client-side Session Management + Express Middleware Token Handling |
| **Development & Build**| Bun / Vite / NPM scripts |

---

## 📊 System Architecture & Database Design

The database schema (`schema.sql`) contains 8 normalized tables with foreign keys and cascade integrity:

```sql
┌──────────────┐       ┌────────────────────┐       ┌─────────────────┐
│    users     │───┬───│   subscriptions    │       │      meals      │
└──────────────┘   │   └────────────────────┘       └─────────────────┘
       │           │                                         │
       │           │   ┌────────────────────┐                │
       ├───────────┼───│       orders       │────────────────┤
       │           │   └────────────────────┘                │
       │           │             │                           │
       │           │   ┌────────────────────┐                │
       │           └───│    order_items     │────────────────┘
       │               └────────────────────┘
       │
       │   ┌───────────────────────┐
       ├───│  wallet_transactions  │
       │   └───────────────────────┘
       │
       │   ┌───────────────────────┐
       ├───│       feedback        │
       │   └───────────────────────┘
       │
       │   ┌───────────────────────┐
       └───│   contact_messages    │
           └───────────────────────┘
```

---

## 🏁 Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (bundled with Node.js)
- *(Optional)* **MySQL / XAMPP / WAMP / MySQL Workbench**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/pramod0114/tiffin_service_management.git

# Navigate into the project folder
cd tiffin_service_management

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Add your configuration details:
```env
PORT=3000

# MySQL Database Settings (Optional)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=tiffin_service
```

---

## 🗄️ MySQL Database Setup Guide

### Method 1: Automatic Auto-Migration (Recommended)
You don't need to manually create tables! 
1. Start your local MySQL server (via XAMPP or terminal).
2. Configure `.env` with your MySQL credentials.
3. Start the application with `npm start`.
4. The server will automatically connect, create the `tiffin_service` database, initialize all tables, and seed initial demo data.

### Method 2: phpMyAdmin Import
1. Open **phpMyAdmin** (`http://localhost/phpmyadmin`).
2. Click **New** on the sidebar and create a database named `tiffin_service`.
3. Select the `tiffin_service` database and click the **Import** tab.
4. Choose the `schema.sql` file located in the root directory of this project.
5. Click **Go / Import**.

### Method 3: MySQL CLI Import
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tiffin_service;"
mysql -u root -p tiffin_service < schema.sql
```

---

## 🔐 Default Login Credentials

| Role | Email / Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Customer** | `demo@tiffin.com` | `password123` | Access user dashboard, view subscription, track delivery |
| **Admin** | `admin@tiffin.com` | `admin123` | Access management portal, dispatch orders, update menu |

---

## 🔌 API Documentation & Endpoints

All backend endpoints support both standard RESTful paths and legacy servlet patterns:

### 1. Authentication Endpoints
- `POST /api/auth/login` (or `/LoginServlet`) — User login and session verification.
- `POST /api/auth/register` (or `/UserServlet`) — User registration with profile creation.
- `POST /api/auth/admin-login` (or `/AdminLoginServlet`) — Admin authentication.

### 2. Subscriptions & Plans
- `GET /api/subscriptions` (or `/SubscriptionServlet?action=list`) — Get active user subscription.
- `POST /api/subscriptions` (or `/SubscriptionServlet?action=create`) — Create/upgrade a subscription plan.
- `POST /api/subscriptions/pause` (or `/SubscriptionServlet?action=pause`) — Pause or resume deliveries.

### 3. Orders & Live Tracking
- `GET /api/orders` (or `/OrderServlet?action=list`) — Retrieve user order history.
- `POST /api/orders` (or `/OrderServlet?action=place`) — Place a new single or recurring meal order.
- `GET /api/orders/track/:id` (or `/TrackOrderServlet`) — Fetch live delivery GPS coordinates & ETA.

### 4. Admin Operations
- `GET /api/admin/stats` — Overall revenue, active subscriptions, and meal dispatch counts.
- `POST /api/admin/orders/status` — Update order delivery lifecycle state.
- `POST /api/admin/menu/update` — Add or modify daily meal items and pricing.

---

## 📂 Project Directory Structure

```
tiffin_service_management/
├── .env.example              # Sample environment configuration template
├── README.md                 # Complete project documentation
├── package.json              # Dependencies and run scripts
├── schema.sql                # Full MySQL schema with constraints & sample seeds
├── server.js                 # Express.js REST API server & database pool logic
├── css/                      # CSS styling files
│   └── (Modular style assets)
├── js/                       # Client-side JavaScript modules
│   └── (Script helpers)
├── index.html                # Homepage with pricing & meal budget calculator
├── login.html                # Customer login interface
├── register.html             # New customer registration page
├── dashboard.html            # Customer dashboard & live order tracker
├── admin-login.html          # Administrator login portal
└── admin-dashboard.html      # Kitchen and dispatch admin management console
```

---

## 🌐 Deployment Guide

### Deploying to Cloud / VPS (Render, Railway, Heroku, AWS EC2)
1. Set the build and start commands:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
2. Add environment variables in your provider dashboard:
   - `PORT=3000`
   - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_PORT`
3. Push your code to GitHub and link your repository.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
