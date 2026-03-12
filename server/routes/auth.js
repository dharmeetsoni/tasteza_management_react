const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
require('dotenv').config();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });

    const [users] = await db.query(
      'SELECT * FROM users WHERE phone = ? AND is_active = 1', [phone]
    );

    if (!users.length)
      return res.status(401).json({ success: false, message: 'Invalid phone number or password.' });

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid phone number or password.' });

    const token = jwt.sign(
      { id: user.id, name: user.name, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await db.query(
      'INSERT INTO login_logs (user_id, ip_address, status) VALUES (?, ?, ?)',
      [user.id, ip, 'success']
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id:    user.id,
        name:  user.name,
        phone: user.phone,
        role:  user.role,
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, phone, role, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
