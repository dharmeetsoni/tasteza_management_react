-- migration: add_addon_groups_tables
-- date: 2026-03-29
-- purpose: Add-on groups for menu items (like Zomato/Swiggy customisation options)
CREATE TABLE
  IF NOT EXISTS addon_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_required TINYINT (1) DEFAULT 0,
    min_select INT DEFAULT 0,
    max_select INT DEFAULT 1,
    is_active TINYINT (1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE
  IF NOT EXISTS addon_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0.00,
    is_active TINYINT (1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES addon_groups (id) ON DELETE CASCADE
  );

CREATE TABLE
  IF NOT EXISTS menu_item_addon_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_item_id INT NOT NULL,
    addon_group_id INT NOT NULL,
    UNIQUE KEY uk_item_group (menu_item_id, addon_group_id)
  );