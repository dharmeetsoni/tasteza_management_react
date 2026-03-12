-- ============================================
-- ZOMATO MENU MIGRATION
-- Run in phpMyAdmin → auth_system → SQL tab
-- ============================================

CREATE TABLE IF NOT EXISTS zomato_settings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  commission_pct  DECIMAL(5,2) DEFAULT 22.00,
  active_discount DECIMAL(5,2) DEFAULT 0.00,
  restaurant_name VARCHAR(150) DEFAULT 'My Restaurant',
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO zomato_settings (id, commission_pct, active_discount, restaurant_name)
VALUES (1, 22.00, 0.00, 'Tasteza Restaurant');

CREATE TABLE IF NOT EXISTS zomato_menu (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id     INT NOT NULL,
  listed_price     DECIMAL(10,2) NOT NULL,
  target_margin    DECIMAL(5,2) DEFAULT 30.00,
  is_available     TINYINT(1) DEFAULT 1,
  is_featured      TINYINT(1) DEFAULT 0,
  zomato_item_name VARCHAR(150),
  zomato_description TEXT,
  sort_order       INT DEFAULT 0,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_menu_item (menu_item_id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);
