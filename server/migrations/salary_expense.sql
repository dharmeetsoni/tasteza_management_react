-- =====================================================
-- SALARY MANAGEMENT + EXPENSE MANAGER MIGRATION
-- Run in phpMyAdmin → auth_system → SQL tab
-- =====================================================

-- Monthly salary settlement records
CREATE TABLE IF NOT EXISTS salary_settlements (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  month             VARCHAR(7) NOT NULL,          -- 'YYYY-MM'
  monthly_salary    DECIMAL(10,2) DEFAULT 0,
  extra_days        DECIMAL(5,2)  DEFAULT 0,
  absent_days       DECIMAL(5,2)  DEFAULT 0,
  effective_days    DECIMAL(5,2)  DEFAULT 0,
  per_day_salary    DECIMAL(10,2) DEFAULT 0,
  earned_salary     DECIMAL(10,2) DEFAULT 0,
  advance_deducted  DECIMAL(10,2) DEFAULT 0,
  bonus             DECIMAL(10,2) DEFAULT 0,
  deductions        DECIMAL(10,2) DEFAULT 0,
  payable_salary    DECIMAL(10,2) DEFAULT 0,
  paid_amount       DECIMAL(10,2) DEFAULT 0,
  pending_amount    DECIMAL(10,2) DEFAULT 0,
  status            ENUM('draft','partial','paid') DEFAULT 'draft',
  notes             TEXT,
  settled_by        INT,
  settled_at        DATETIME,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_month (user_id, month),
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (settled_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Expense categories and transactions
CREATE TABLE IF NOT EXISTS expense_categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  icon       VARCHAR(10)  DEFAULT '💰',
  color      VARCHAR(10)  DEFAULT '#888',
  is_active  TINYINT      DEFAULT 1,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO expense_categories (id, name, icon, color) VALUES
(1,  'Salary',      '💰', '#1db97e'),
(2,  'Advance',     '🤝', '#118ab2'),
(3,  'Purchase',    '🛒', '#e8572a'),
(4,  'Electricity', '💡', '#f59e0b'),
(5,  'Gas',         '🔥', '#e84a5f'),
(6,  'Rent',        '🏠', '#8b5cf6'),
(7,  'Marketing',   '📣', '#06b6d4'),
(8,  'Maintenance', '🔧', '#b07a00'),
(9,  'Miscellaneous','📦','#5a5a78');

CREATE TABLE IF NOT EXISTS expenses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  amount      DECIMAL(10,2) NOT NULL,
  date        DATE NOT NULL,
  note        TEXT,
  ref_type    VARCHAR(30)  DEFAULT NULL,  -- 'salary', 'advance', 'purchase'
  ref_id      INT          DEFAULT NULL,
  created_by  INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL
);
