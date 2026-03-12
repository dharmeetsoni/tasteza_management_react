const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require login
router.use(authenticate);

// GET /api/categories — All logged in users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/categories/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/categories — Admin only
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, description, image_url } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });
    const [result] = await db.query(
      'INSERT INTO categories (name, description, image_url) VALUES (?, ?, ?)',
      [name, description || null, image_url || null]
    );
    res.status(201).json({ success: true, message: 'Category created.', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Category name already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/categories/:id — Admin only
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, description, image_url, is_active } = req.body;
    const [result] = await db.query(
      'UPDATE categories SET name=?, description=?, image_url=?, is_active=? WHERE id=?',
      [name, description || null, image_url || null, is_active ?? 1, req.params.id]
    );
    if (!result.affectedRows)
      return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, message: 'Category updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/categories/:id — Admin only
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (!result.affectedRows)
      return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
