const express = require('express');
const router = express.Router();
const db = require('../config/db');

// POST /api/online-orders — place a new order
router.post('/', async (req, res) => {
  const {
    items, order_type, table_number, delivery_address,
    notes, subtotal, delivery_charge, gst_amount, total,
    customer_name, customer_phone, customer_id, payment_method,
    coupon_code, discount_amount,
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Insert order header
    const [orderResult] = await conn.query(
      `INSERT INTO online_orders
        (order_type, table_number, delivery_address, notes,
         subtotal, delivery_charge, gst_amount, discount_amount, total,
         customer_name, customer_phone, customer_id,
         payment_method, payment_status, coupon_code, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending', NOW())`,
      [
        order_type, table_number || null, delivery_address || null,
        notes || null, subtotal, delivery_charge || 0,
        gst_amount || 0, discount_amount || 0, total,
        customer_name || 'Guest', customer_phone || null, customer_id || null,
        payment_method || 'phonepay',
        coupon_code || null,
      ]
    );

    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of items) {
      await conn.query(
        `INSERT INTO online_order_items
          (order_id, menu_item_id, name, quantity, price, item_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.menu_item_id || null, item.name, item.quantity, item.price, item.price * item.quantity]
      );
    }

    await conn.commit();

    try {
      const wsHub = req.app.get('wsHub');
      if (wsHub) wsHub.broadcast('sales', { type: 'new_online_order', data: { id: orderId, order_type, total } });
    } catch { }

    res.json({ success: true, order_id: orderId, message: 'Order placed successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('[online-orders POST]', err.message);

    // If tables don't exist yet, return a clear message
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'online_orders table not found. Run the migration below.',
        migration: `
CREATE TABLE IF NOT EXISTS online_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_type ENUM('dine_in','takeaway','delivery') DEFAULT 'dine_in',
  table_number VARCHAR(20),
  delivery_address TEXT,
  notes TEXT,
  subtotal DECIMAL(10,2) DEFAULT 0,
  delivery_charge DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  customer_name VARCHAR(100),
  customer_phone VARCHAR(20),
  customer_id INT,
  status ENUM('pending','confirmed','preparing','ready','delivered','cancelled') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS online_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT,
  name VARCHAR(200) NOT NULL,
  quantity INT DEFAULT 1,
  price DECIMAL(10,2) DEFAULT 0,
  item_total DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES online_orders(id) ON DELETE CASCADE
);`,
      });
    }

    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// GET /api/online-orders — admin list (authenticated)
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT * FROM online_orders ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/online-orders/:id — fetch order details (public — customer tracking)
router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await db.query('SELECT * FROM online_orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const [items] = await db.query('SELECT * FROM online_order_items WHERE order_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/online-orders/:id/status — admin update status
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status, estimated_minutes } = req.body;
  try {
    await db.query(
      'UPDATE online_orders SET status = ?, estimated_minutes = COALESCE(?, estimated_minutes) WHERE id = ?',
      [status, estimated_minutes || null, req.params.id]
    );
    // Broadcast to customer (online_orders room) and dashboard
    const wsHub = req.app.get('wsHub');
    if (wsHub) {
      wsHub.broadcast('sales', { type: 'online_order_status', data: { id: req.params.id, status, estimated_minutes } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
