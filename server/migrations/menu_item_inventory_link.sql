-- Add direct inventory link to menu_items
-- This allows: Menu Item "Paneer Tikka" → directly deducts from inventory_items "Paneer Tikka"
-- qty_per_sale = how many inventory units are consumed per 1 menu item sold (default 1)
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS inventory_item_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS qty_per_sale DECIMAL(10,4) DEFAULT 1.0000;

-- Optional FK (add only if you want strict referential integrity)
-- ALTER TABLE menu_items ADD FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;
