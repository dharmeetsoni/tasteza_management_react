-- Migration: Create online_orders and online_order_items tables
-- Uses IF NOT EXISTS so it is safe to re-run
CREATE TABLE
  IF NOT EXISTS online_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_type ENUM ('dine_in', 'takeaway', 'delivery') NOT NULL DEFAULT 'dine_in',
    table_number VARCHAR(20) DEFAULT NULL,
    delivery_address TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    customer_name VARCHAR(100) DEFAULT 'Guest',
    customer_phone VARCHAR(20) DEFAULT NULL,
    customer_id INT DEFAULT NULL,
    status ENUM (
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'delivered',
      'cancelled'
    ) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE
  IF NOT EXISTS online_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    menu_item_id INT DEFAULT NULL,
    name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    item_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_ooi_order FOREIGN KEY (order_id) REFERENCES online_orders (id) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;