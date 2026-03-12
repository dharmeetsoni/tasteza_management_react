-- Purchase Orders Migration
-- Run this SQL in phpMyAdmin → auth_system database → SQL tab

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  po_number          VARCHAR(30) NOT NULL UNIQUE,
  supplier           VARCHAR(150),
  supplier_phone     VARCHAR(20),
  supplier_address   TEXT,
  expected_date      DATE,
  status             ENUM('pending','partial','received','cancelled') DEFAULT 'pending',
  total_amount       DECIMAL(12,2) DEFAULT 0,
  bill_amount        DECIMAL(12,2),
  invoice_no         VARCHAR(80),
  notes              TEXT,
  receive_notes      TEXT,
  created_by         INT,
  received_by        INT,
  received_at        DATETIME,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  order_id            INT NOT NULL,
  inventory_item_id   INT NOT NULL,
  unit_id             INT,
  ordered_qty         DECIMAL(12,3) NOT NULL,
  received_qty        DECIMAL(12,3) DEFAULT 0,
  unit_price          DECIMAL(12,4) DEFAULT 0,
  total_price         DECIMAL(12,2) DEFAULT 0,
  notes               TEXT,
  FOREIGN KEY (order_id)          REFERENCES purchase_orders(id)  ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)  ON DELETE CASCADE,
  FOREIGN KEY (unit_id)           REFERENCES units(id)            ON DELETE SET NULL
);
