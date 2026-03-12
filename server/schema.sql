-- ============================================
-- USER LOGIN SYSTEM - MySQL Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS auth_system;
USE auth_system;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,  -- bcrypt hashed
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    is_active TINYINT(1) DEFAULT 1,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Login sessions/logs
CREATE TABLE login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    status ENUM('success', 'failed') DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- SEED DATA
-- Passwords below are bcrypt of:
--   admin123 (for admin)
--   staff123 (for staff)
-- ============================================

INSERT INTO users (name, phone, password, role) VALUES
('Admin User',  '9999999999', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cgrSKPnY.VJQAO9EjLcm0Oq', 'admin'),
('Staff Member','8888888888', '$2b$10$TIF6Yw5mFDsZ1wLSOjZb5.0NUFBH3EMHK.YGnG5sEdJYWE69D.mAK', 'staff');
