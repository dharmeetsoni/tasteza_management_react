-- ============================================
-- SALES MODULE MIGRATION
-- Run in phpMyAdmin → auth_system → SQL tab
-- ============================================

-- Update menu_items table with new fields
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS price_with_gst DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_applicable TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_parcel_available TINYINT(1) DEFAULT 1;

-- Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(20) NOT NULL,
  table_name   VARCHAR(50),
  capacity     INT DEFAULT 4,
  section      VARCHAR(50) DEFAULT 'Main Hall',
  is_active    TINYINT(1) DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coupon Codes
CREATE TABLE IF NOT EXISTS coupons (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(50) NOT NULL UNIQUE,
  description      VARCHAR(200),
  discount_type    ENUM('percentage','amount') DEFAULT 'percentage',
  discount_value   DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount     DECIMAL(10,2) DEFAULT NULL,
  usage_limit      INT DEFAULT NULL,
  used_count       INT DEFAULT 0,
  valid_from       DATE,
  valid_until      DATE,
  is_active        TINYINT(1) DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders (bills)
CREATE TABLE IF NOT EXISTS orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  order_number     VARCHAR(30) NOT NULL UNIQUE,
  table_id         INT,
  order_type       ENUM('dine_in','parcel','takeaway') DEFAULT 'dine_in',
  status           ENUM('open','kot','billed','paid','cancelled') DEFAULT 'open',
  customer_name    VARCHAR(100),
  customer_phone   VARCHAR(20),
  subtotal         DECIMAL(10,2) DEFAULT 0,
  gst_amount       DECIMAL(10,2) DEFAULT 0,
  discount_type    ENUM('percentage','amount','coupon') DEFAULT NULL,
  discount_value   DECIMAL(10,2) DEFAULT 0,
  discount_amount  DECIMAL(10,2) DEFAULT 0,
  coupon_id        INT DEFAULT NULL,
  coupon_code      VARCHAR(50),
  total_amount     DECIMAL(10,2) DEFAULT 0,
  payment_method   ENUM('cash','card','upi','other') DEFAULT NULL,
  payment_status   ENUM('pending','paid') DEFAULT 'pending',
  kot_instructions TEXT,
  notes            TEXT,
  created_by       INT,
  billed_by        INT,
  billed_at        DATETIME,
  paid_at          DATETIME,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id)  REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (billed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  order_id       INT NOT NULL,
  menu_item_id   INT NOT NULL,
  item_name      VARCHAR(150) NOT NULL,
  quantity       INT DEFAULT 1,
  unit_price     DECIMAL(10,2) NOT NULL,
  gst_percent    DECIMAL(5,2) DEFAULT 0,
  gst_amount     DECIMAL(10,2) DEFAULT 0,
  total_price    DECIMAL(10,2) NOT NULL,
  kot_sent       TINYINT(1) DEFAULT 0,
  kot_instructions TEXT,
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)     REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
);

-- KOT (Kitchen Order Tickets)
CREATE TABLE IF NOT EXISTS kot_tickets (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  table_id     INT,
  kot_number   VARCHAR(30) NOT NULL,
  instructions TEXT,
  status       ENUM('pending','preparing','ready','served') DEFAULT 'pending',
  created_by   INT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS kot_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  kot_id      INT NOT NULL,
  order_item_id INT NOT NULL,
  item_name   VARCHAR(150),
  quantity    INT DEFAULT 1,
  notes       TEXT,
  FOREIGN KEY (kot_id) REFERENCES kot_tickets(id) ON DELETE CASCADE
);

-- Default tables seed
INSERT IGNORE INTO restaurant_tables (table_number, table_name, capacity, section) VALUES
('T1','Table 1',4,'Main Hall'),('T2','Table 2',4,'Main Hall'),('T3','Table 3',2,'Main Hall'),
('T4','Table 4',6,'Main Hall'),('T5','Table 5',4,'Main Hall'),('T6','Table 6',4,'Main Hall'),
('T7','Table 7',2,'Outdoor'),('T8','Table 8',4,'Outdoor'),
('T9','Table 9',8,'Private'),('T10','Table 10',4,'Bar');

-- Sample coupon
INSERT IGNORE INTO coupons (code,description,discount_type,discount_value,min_order_amount,valid_until,is_active)
VALUES ('WELCOME10','Welcome discount 10%','percentage',10,100,'2099-12-31',1);

-- Add price_includes_gst column (run if not already added)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS price_includes_gst TINYINT(1) DEFAULT 0;
