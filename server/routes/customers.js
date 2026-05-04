const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// ── POST /api/customers/verify-phone ─────────────────────
// Called after Firebase OTP confirms the phone number on the client.
// Creates or fetches the customer record; returns a backend JWT.
router.post('/verify-phone', async (req, res) => {
  const { phone, firebase_uid, name } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });

  try {
    // Find existing customer by phone OR firebase_uid
    const [[existing]] = await db.query(
      'SELECT * FROM customers WHERE phone = ? OR firebase_uid = ? LIMIT 1',
      [phone, firebase_uid || null]
    );

    let customer;
    if (existing) {
      // Update name if provided and different
      if (name && name !== existing.name) {
        await db.query('UPDATE customers SET name = ?, firebase_uid = ?, updated_at = NOW() WHERE id = ?',
          [name, firebase_uid || existing.firebase_uid, existing.id]);
      } else if (firebase_uid && !existing.firebase_uid) {
        await db.query('UPDATE customers SET firebase_uid = ? WHERE id = ?', [firebase_uid, existing.id]);
      }
      customer = { ...existing, name: name || existing.name };
    } else {
      // New customer
      const [result] = await db.query(
        'INSERT INTO customers (name, phone, firebase_uid) VALUES (?, ?, ?)',
        [name || 'Customer', phone, firebase_uid || null]
      );
      customer = { id: result.insertId, name: name || 'Customer', phone, firebase_uid };
    }

    const token = jwt.sign(
      { id: customer.id, phone: customer.phone, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Middleware: authenticate customer JWT ─────────────────
function authCustomer(req, res, next) {
  const header = req.headers['x-customer-token'] || req.headers.authorization?.replace('Bearer ', '');
  if (!header) return res.status(401).json({ success: false, message: 'Customer auth required' });
  try {
    const decoded = jwt.verify(header, process.env.JWT_SECRET);
    if (decoded.role !== 'customer') throw new Error('Not a customer token');
    req.customer = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ── GET /api/customers/me ─────────────────────────────────
router.get('/me', authCustomer, async (req, res) => {
  try {
    const [[customer]] = await db.query(
      'SELECT id, name, phone, email, created_at FROM customers WHERE id = ?',
      [req.customer.id]
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/customers/orders ─────────────────────────────
router.get('/orders', authCustomer, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT id, order_type, status, payment_status, payment_method,
              subtotal, delivery_charge, gst_amount, total, created_at
       FROM online_orders
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.customer.id]
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/customers/orders/:id ────────────────────────
router.get('/orders/:id', authCustomer, async (req, res) => {
  try {
    const [[order]] = await db.query(
      'SELECT * FROM online_orders WHERE id = ? AND customer_id = ?',
      [req.params.id, req.customer.id]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const [items] = await db.query(
      'SELECT * FROM online_order_items WHERE order_id = ?',
      [req.params.id]
    );
    res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/customers/addresses ─────────────────────────
router.get('/addresses', authCustomer, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC',
      [req.customer.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/customers/addresses ────────────────────────
router.post('/addresses', authCustomer, async (req, res) => {
  const { label, address, lat, lng, is_default } = req.body;
  if (!address) return res.status(400).json({ success: false, message: 'Address is required' });
  try {
    if (is_default) {
      await db.query('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?', [req.customer.id]);
    }
    const [result] = await db.query(
      'INSERT INTO customer_addresses (customer_id, label, address, lat, lng, is_default) VALUES (?, ?, ?, ?, ?, ?)',
      [req.customer.id, label || 'Home', address, lat || null, lng || null, is_default ? 1 : 0]
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/customers/addresses/:id ──────────────────
router.delete('/addresses/:id', authCustomer, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [req.params.id, req.customer.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
