const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require login
router.use(authenticate);

// GET /api/units — All logged-in users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM units ORDER BY type, name'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/units/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM units WHERE id = ?', [req.params.id]);
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Unit not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/units — Admin only
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, abbreviation, type } = req.body;
    if (!name || !abbreviation)
      return res.status(400).json({ success: false, message: 'Name and abbreviation are required.' });

    const validTypes = ['weight', 'volume', 'count', 'other'];
    const unitType   = validTypes.includes(type) ? type : 'other';

    const [result] = await db.query(
      'INSERT INTO units (name, abbreviation, type) VALUES (?, ?, ?)',
      [name.trim(), abbreviation.trim(), unitType]
    );
    res.status(201).json({
      success: true,
      message: 'Unit created.',
      data: { id: result.insertId }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Unit name or abbreviation already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/units/:id — Admin only
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, abbreviation, type, is_active } = req.body;
    if (!name || !abbreviation)
      return res.status(400).json({ success: false, message: 'Name and abbreviation are required.' });

    const validTypes = ['weight', 'volume', 'count', 'other'];
    const unitType   = validTypes.includes(type) ? type : 'other';

    const [result] = await db.query(
      'UPDATE units SET name=?, abbreviation=?, type=?, is_active=? WHERE id=?',
      [name.trim(), abbreviation.trim(), unitType, is_active ?? 1, req.params.id]
    );
    if (!result.affectedRows)
      return res.status(404).json({ success: false, message: 'Unit not found.' });
    res.json({ success: true, message: 'Unit updated.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Unit name or abbreviation already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/units/:id — Admin only
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM units WHERE id = ?', [req.params.id]);
    if (!result.affectedRows)
      return res.status(404).json({ success: false, message: 'Unit not found.' });
    res.json({ success: true, message: 'Unit deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
