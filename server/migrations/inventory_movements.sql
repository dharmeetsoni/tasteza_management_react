-- Track every inventory change (purchase in, sale deduction, manual adjust)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT NOT NULL,
  movement_type   ENUM('purchase','sale_deduction','manual_add','manual_remove','wastage') NOT NULL,
  quantity_change DECIMAL(12,4) NOT NULL,          -- positive = IN, negative = OUT
  quantity_before DECIMAL(12,4) NOT NULL DEFAULT 0,
  quantity_after  DECIMAL(12,4) NOT NULL DEFAULT 0,
  reference_type  VARCHAR(30) DEFAULT NULL,        -- 'order', 'purchase', 'manual'
  reference_id    INT DEFAULT NULL,                -- order_id or purchase_id
  note            TEXT DEFAULT NULL,
  created_by      INT DEFAULT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

-- Index for fast lookups by item and date
CREATE INDEX IF NOT EXISTS idx_inv_mov_item ON inventory_movements(inventory_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ref  ON inventory_movements(reference_type, reference_id);
