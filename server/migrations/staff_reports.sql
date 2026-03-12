-- ============================================
-- STAFF MANAGEMENT + REPORTS MIGRATION
-- Run in phpMyAdmin → auth_system → SQL tab
-- ============================================

-- Extend users table with new roles and staff fields
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','manager','waiter','staff') NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS monthly_salary   DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_days_month  INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS join_date        DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS designation      VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS address          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS page_permissions JSON DEFAULT NULL;

-- Staff advances
CREATE TABLE IF NOT EXISTS staff_advances (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  advance_date DATE NOT NULL,
  description VARCHAR(200),
  status      ENUM('pending','deducted') DEFAULT 'pending',
  created_by  INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Staff extra days / adjustments
CREATE TABLE IF NOT EXISTS staff_day_adjustments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  month       VARCHAR(7) NOT NULL,  -- 'YYYY-MM'
  extra_days  DECIMAL(5,2) DEFAULT 0,
  absent_days DECIMAL(5,2) DEFAULT 0,
  notes       VARCHAR(200),
  created_by  INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Fixed monthly costs (rent, electricity, misc)
CREATE TABLE IF NOT EXISTS fixed_costs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  category    ENUM('rent','electricity','maintenance','staff','marketing','other') DEFAULT 'other',
  month       VARCHAR(7) NOT NULL,  -- 'YYYY-MM'
  description VARCHAR(200),
  created_by  INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Role page permissions config
CREATE TABLE IF NOT EXISTS role_permissions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  role        VARCHAR(30) NOT NULL UNIQUE,
  permissions JSON NOT NULL,
  updated_by  INT,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Default role permissions
INSERT INTO role_permissions (role, permissions) VALUES
('admin',   '["*"]'),
('manager', '["sales","kot","coupons","inventory","purchases","purchaseorders","recipes","menuitems","courses","salary","reports","customers","staff"]'),
('waiter',  '["sales","kot"]'),
('staff',   '["sales","kot","inventory"]')
ON DUPLICATE KEY UPDATE permissions = VALUES(permissions);
