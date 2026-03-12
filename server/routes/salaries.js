const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM salary_profiles ORDER BY role_name ASC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { role_name, salary_type, amount, hours_per_day, days_per_month, per_minute, notes } = req.body;
    if (!role_name || !amount) return res.status(400).json({ success: false, message: 'Role name and amount required.' });
    const [r] = await db.query(
      'INSERT INTO salary_profiles (role_name,salary_type,amount,hours_per_day,days_per_month,per_minute,notes) VALUES (?,?,?,?,?,?,?)',
      [role_name, salary_type||'monthly', parseFloat(amount), parseFloat(hours_per_day)||8, parseFloat(days_per_month)||26, parseFloat(per_minute)||0, notes||null]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { role_name, salary_type, amount, hours_per_day, days_per_month, per_minute, notes } = req.body;
    if (!role_name || !amount) return res.status(400).json({ success: false, message: 'Role name and amount required.' });
    await db.query(
      'UPDATE salary_profiles SET role_name=?,salary_type=?,amount=?,hours_per_day=?,days_per_month=?,per_minute=?,notes=? WHERE id=?',
      [role_name, salary_type||'monthly', parseFloat(amount), parseFloat(hours_per_day)||8, parseFloat(days_per_month)||26, parseFloat(per_minute)||0, notes||null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM salary_profiles WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
