-- migration: online_orders_v2_enhancements
-- date: 2026-03-29
-- purpose: Add payment fields, KOT linkage, GST and customer JWT to online orders

ALTER TABLE online_orders
  ADD COLUMN gst_amount        DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN payment_method    VARCHAR(30)   DEFAULT 'cod',
  ADD COLUMN payment_status    VARCHAR(20)   DEFAULT 'pending',
  ADD COLUMN payment_ref       VARCHAR(100)  DEFAULT NULL,
  ADD COLUMN phonepay_txn_id   VARCHAR(100)  DEFAULT NULL,
  ADD COLUMN estimated_minutes INT           DEFAULT NULL,
  ADD COLUMN linked_order_id   INT           DEFAULT NULL;

ALTER TABLE online_order_items
  ADD COLUMN addon_data TEXT DEFAULT NULL;
