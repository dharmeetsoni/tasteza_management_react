const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('admin','manager'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,name,phone,role,designation,monthly_salary,work_days_month,
              join_date,is_active,last_login,created_at,page_permissions
       FROM users ORDER BY name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/logs/all', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ll.*, u.name, u.phone, u.role FROM login_logs ll
      JOIN users u ON ll.user_id=u.id ORDER BY ll.created_at DESC LIMIT 200`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT id,name,phone,role,designation,monthly_salary,work_days_month,
              join_date,address,emergency_contact,page_permissions,is_active,last_login,created_at
       FROM users WHERE id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, phone, password, role, designation, monthly_salary, work_days_month, join_date } = req.body;
    if (!name || !phone || !password || !role)
      return res.status(400).json({ success: false, message: 'name, phone, password, role are required.' });
    const hashed = await bcrypt.hash(password, 10);
    const [r] = await db.query(
      `INSERT INTO users (name,phone,password,role,designation,monthly_salary,work_days_month,join_date)
       VALUES (?,?,?,?,?,?,?,?)`,
      [name, phone, hashed, role, designation||null,
       parseFloat(monthly_salary)||0, parseInt(work_days_month)||30, join_date||null]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Phone already registered.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, phone, role, designation, monthly_salary, work_days_month,
            join_date, address, emergency_contact, page_permissions, is_active } = req.body;
    await db.query(
      `UPDATE users SET name=?,phone=?,role=?,designation=?,monthly_salary=?,work_days_month=?,
       join_date=?,address=?,emergency_contact=?,page_permissions=?,is_active=? WHERE id=?`,
      [name, phone, role, designation||null, parseFloat(monthly_salary)||0, parseInt(work_days_month)||30,
       join_date||null, address||null, emergency_contact||null,
       page_permissions ? JSON.stringify(page_permissions) : null,
       is_active?1:0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id/password', authorize('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password required.' });
    await db.query('UPDATE users SET password=? WHERE id=?', [await bcrypt.hash(password, 10), req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    if (req.params.id == req.user.id)
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
