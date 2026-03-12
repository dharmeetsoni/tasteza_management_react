const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu_courses ORDER BY sort_order ASC, name ASC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Course name is required.' });
    const [r] = await db.query(
      'INSERT INTO menu_courses (name,icon,color,description,is_active) VALUES (?,?,?,?,1)',
      [name.trim(), icon||'🍽️', color||'#e8572a', description||null]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Course name already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Course name is required.' });
    await db.query(
      'UPDATE menu_courses SET name=?,icon=?,color=?,description=? WHERE id=?',
      [name.trim(), icon||'🍽️', color||'#e8572a', description||null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    await db.query('UPDATE menu_courses SET is_active=? WHERE id=?', [req.body.is_active?1:0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM menu_courses WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
