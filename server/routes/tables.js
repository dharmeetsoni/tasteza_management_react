const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [tables] = await db.query(`
      SELECT t.*,
        o.id AS order_id, o.order_number, o.status AS order_status, o.total_amount,
        o.customer_name, o.order_type
      FROM restaurant_tables t
      LEFT JOIN orders o ON o.table_id = t.id AND o.status IN ('open','kot','billed')
      WHERE t.is_active = 1
      ORDER BY t.section, t.table_number`);
    res.json({ success: true, data: tables });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { table_number, table_name, capacity, section } = req.body;
    if (!table_number) return res.status(400).json({ success: false, message: 'Table number required.' });
    const [r] = await db.query(
      'INSERT INTO restaurant_tables (table_number,table_name,capacity,section) VALUES (?,?,?,?)',
      [table_number, table_name||null, capacity||4, section||'Main Hall']
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Table number exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { table_number, table_name, capacity, section } = req.body;
    await db.query('UPDATE restaurant_tables SET table_number=?,table_name=?,capacity=?,section=? WHERE id=?',
      [table_number, table_name||null, capacity||4, section||'Main Hall', req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('UPDATE restaurant_tables SET is_active=0 WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
