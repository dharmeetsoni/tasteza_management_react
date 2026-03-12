const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM fuel_profiles ORDER BY fuel_name ASC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { fuel_name, fuel_type, fuel_unit, cost_per_unit, burn_duration_hours, per_minute, icon, notes } = req.body;
    if (!fuel_name || !cost_per_unit) return res.status(400).json({ success: false, message: 'Fuel name and cost required.' });
    const [r] = await db.query(
      'INSERT INTO fuel_profiles (fuel_name,fuel_type,fuel_unit,cost_per_unit,burn_duration_hours,per_minute,icon,notes) VALUES (?,?,?,?,?,?,?,?)',
      [fuel_name, fuel_type||'gas', fuel_unit||'cylinder', parseFloat(cost_per_unit), parseFloat(burn_duration_hours)||8, parseFloat(per_minute)||0, icon||'🔥', notes||null]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { fuel_name, fuel_type, fuel_unit, cost_per_unit, burn_duration_hours, per_minute, icon, notes } = req.body;
    if (!fuel_name || !cost_per_unit) return res.status(400).json({ success: false, message: 'Fuel name and cost required.' });
    await db.query(
      'UPDATE fuel_profiles SET fuel_name=?,fuel_type=?,fuel_unit=?,cost_per_unit=?,burn_duration_hours=?,per_minute=?,icon=?,notes=? WHERE id=?',
      [fuel_name, fuel_type||'gas', fuel_unit||'cylinder', parseFloat(cost_per_unit), parseFloat(burn_duration_hours)||8, parseFloat(per_minute)||0, icon||'🔥', notes||null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM fuel_profiles WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
