const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

// GET all staff
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,name,phone,role,designation,monthly_salary,work_days_month,hours_per_day,join_date,
              address,emergency_contact,page_permissions,is_active,created_at
       FROM users ORDER BY name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET staff salary summary for a month
router.get('/:id/salary/:month', async (req, res) => {
  try {
    const { id, month } = req.params; // month = 'YYYY-MM'
    const [[user]] = await db.query('SELECT * FROM users WHERE id=?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const [[adj]] = await db.query(
      'SELECT * FROM staff_day_adjustments WHERE user_id=? AND month=?', [id, month]);
    // Only count advances whose advance_date is in THIS month (fixes cross-month bug)
    const [advances] = await db.query(
      "SELECT id, user_id, amount, DATE_FORMAT(advance_date,'%Y-%m-%d') AS advance_date, description, status, created_by FROM staff_advances WHERE user_id=? AND status='pending' AND DATE_FORMAT(advance_date,'%Y-%m')=?", [id, month]);

    const workDays = parseFloat(user.work_days_month) || 30;
    const extraDays = parseFloat(adj?.extra_days || 0);
    const absentDays = parseFloat(adj?.absent_days || 0);
    const effectiveDays = workDays + extraDays - absentDays;
    const perDaySalary = parseFloat(user.monthly_salary) / workDays;
    const earnedSalary = perDaySalary * effectiveDays;
    const totalAdvance = advances.reduce((s, a) => s + parseFloat(a.amount), 0);
    const netPayable = earnedSalary - totalAdvance;

    res.json({ success: true, data: { user, adj, advances, workDays, extraDays, absentDays, effectiveDays, perDaySalary, earnedSalary, totalAdvance, netPayable }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET all advances for a staff
router.get('/:id/advances', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, user_id, amount, DATE_FORMAT(advance_date,\'%Y-%m-%d\') AS advance_date, description, status, created_by FROM staff_advances WHERE user_id=? ORDER BY advance_date DESC', [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ADD advance
router.post('/:id/advances', authorize('admin','manager'), async (req, res) => {
  try {
    const { amount, advance_date, description } = req.body;
    const [r] = await db.query(
      'INSERT INTO staff_advances (user_id,amount,advance_date,description,created_by) VALUES (?,?,?,?,?)',
      [req.params.id, parseFloat(amount), advance_date, description||null, req.user.id]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// MARK advance as deducted
router.patch('/advances/:advId/deduct', authorize('admin','manager'), async (req, res) => {
  try {
    await db.query("UPDATE staff_advances SET status='deducted' WHERE id=?", [req.params.advId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE advance
router.delete('/advances/:advId', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const advId = req.params.advId;
    await conn.query("DELETE FROM expenses WHERE ref_type='advance' AND ref_id=?", [advId]);
    await conn.query('DELETE FROM staff_advances WHERE id=?', [advId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// GET/SAVE day adjustments
router.get('/:id/adjustments/:month', async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT * FROM staff_day_adjustments WHERE user_id=? AND month=?', [req.params.id, req.params.month]);
    res.json({ success: true, data: row || null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/adjustments', authorize('admin','manager'), async (req, res) => {
  try {
    const { month, extra_days, absent_days, notes } = req.body;
    await db.query(
      `INSERT INTO staff_day_adjustments (user_id,month,extra_days,absent_days,notes,created_by) VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE extra_days=VALUES(extra_days),absent_days=VALUES(absent_days),notes=VALUES(notes)`,
      [req.params.id, month, parseFloat(extra_days)||0, parseFloat(absent_days)||0, notes||null, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update staff profile
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, phone, role, designation, monthly_salary, work_days_month, hours_per_day, join_date, address, emergency_contact, page_permissions, is_active } = req.body;
    await db.query(
      `UPDATE users SET name=?,phone=?,role=?,designation=?,monthly_salary=?,work_days_month=?,hours_per_day=?,
       join_date=?,address=?,emergency_contact=?,page_permissions=?,is_active=? WHERE id=?`,
      [name, phone, role, designation||null, parseFloat(monthly_salary)||0, parseInt(work_days_month)||26, parseInt(hours_per_day)||8,
       join_date||null, address||null, emergency_contact||null,
       page_permissions ? JSON.stringify(page_permissions) : null, is_active?1:0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
