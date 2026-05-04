-- migration: add_customers_and_addresses_tables
-- date: 2026-03-29
-- purpose: Customer accounts for public ordering with phone-based Firebase OTP auth
CREATE TABLE
  IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) DEFAULT NULL,
    firebase_uid VARCHAR(128) UNIQUE DEFAULT NULL,
    is_active TINYINT (1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

CREATE TABLE
  IF NOT EXISTS customer_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    label VARCHAR(50) DEFAULT 'Home',
    address TEXT NOT NULL,
    lat DECIMAL(11, 7) DEFAULT NULL,
    lng DECIMAL(11, 7) DEFAULT NULL,
    is_default TINYINT (1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
  );