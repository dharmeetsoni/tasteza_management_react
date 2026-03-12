/**
 * Salary Management
 *
 * ADVANCE RULE (key fix):
 *   Advances are counted for the month they were GIVEN (advance_date month).
 *   An advance given in Feb (2025-02-xx) only deducts from Feb salary.
 *   An advance given in Mar (2025-03-xx) only deducts from Mar salary.
 *   Advances with status='pending' that belong to THIS month are deducted.
 *   Advances from past months that were never settled stay 'pending' — 
 *   they carry forward and show as "carry-forward" on the next unsettled month.
 *
 * FORMULA:
 *   per_day        = monthly_salary / work_days_month
 *   effective_days = work_days_month + extra_days - absent_days  (min 0)
 *   earned_salary  = per_day × effective_days
 *   this_month_adv = SUM(pending advances WHERE advance_date month = this month)
 *   carry_fwd_adv  = SUM(pending advances WHERE advance_date month < this month)
 *   total_advance  = this_month_adv + carry_fwd_adv
 *   payable        = earned + bonus - total_advance - other_deductions
 *   pending        = MAX(0, payable - paid_amount)
 */
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const wsHub   = require('../websocket');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const curMonth = () => localDate().slice(0, 7);
const p2 = n => Math.round(parseFloat(n || 0) * 100) / 100;

/**
 * computeSalary(userId, month)
 *
 * month = 'YYYY-MM'
 *
 * Advance logic:
 *  - thisMonthAdvances : advances where DATE_FORMAT(advance_date,'%Y-%m') = month AND status='pending'
 *  - carryFwdAdvances  : advances where DATE_FORMAT(advance_date,'%Y-%m') < month AND status='pending'
 *  - totalAdvance      = thisMonthAdvances + carryFwdAdvances
 *
 * This means Feb advance only affects Feb (and carries to Mar if Feb not settled).
 */
async function computeSalary(userId, month) {
  const [[user]] = await db.query(
    'SELECT id, name, role, designation, monthly_salary, work_days_month, hours_per_day, is_active FROM users WHERE id=?',
    [userId]
  );
  if (!user) throw new Error('Staff not found: ' + userId);

  const monthlySalary = p2(user.monthly_salary);
  const workDays      = p2(user.work_days_month) || 26;
  const hoursPerDay   = p2(user.hours_per_day)   || 8;

  // Attendance adjustments for this month
  const [[adj]] = await db.query(
    'SELECT * FROM staff_day_adjustments WHERE user_id=? AND month=?',
    [userId, month]
  );
  const extraDays     = p2(adj?.extra_days  || 0);
  const absentDays    = p2(adj?.absent_days || 0);
  const effectiveDays = Math.max(0, p2(workDays + extraDays - absentDays));

  // Salary calculation
  const perDaySalary  = workDays > 0 ? p2(monthlySalary / workDays) : 0;
  const earnedSalary  = p2(perDaySalary * effectiveDays);
  const perMinSalary  = workDays > 0 ? monthlySalary / (workDays * hoursPerDay * 60) : 0;

  // ── ADVANCE LOGIC ────────────────────────────────────
  // Only count advances whose advance_date falls in THIS exact month.
  // An advance given in Feb only deducts from Feb salary.
  // An advance given in Mar only deducts from Mar salary.
  // No automatic carry-forward — each advance belongs strictly to its month.
  const [thisMonthAdvances] = await db.query(
    `SELECT id, user_id, amount, DATE_FORMAT(advance_date,'%Y-%m-%d') AS advance_date, description, status, created_by, created_at FROM staff_advances
     WHERE user_id=? AND status='pending'
       AND DATE_FORMAT(advance_date,'%Y-%m') = ?
     ORDER BY advance_date ASC`,
    [userId, month]
  );

  const thisMonthAdvTotal   = p2(thisMonthAdvances.reduce((s, a) => s + p2(a.amount), 0));
  const totalPendingAdvance = thisMonthAdvTotal;
  const allAdvances         = thisMonthAdvances;

  // Settlement for this month (locked values once settled)
  const [[settlement]] = await db.query(
    'SELECT * FROM salary_settlements WHERE user_id=? AND month=?',
    [userId, month]
  );

  const bonus           = p2(settlement?.bonus       || 0);
  const otherDeductions = p2(settlement?.deductions  || 0);
  // If settled: use locked advance value; else: live total
  const advDeducted     = settlement ? p2(settlement.advance_deducted) : totalPendingAdvance;
  const paidAmount      = p2(settlement?.paid_amount || 0);

  const payableSalary = p2(earnedSalary + bonus - advDeducted - otherDeductions);
  const pendingAmount = p2(Math.max(0, payableSalary - paidAmount));

  return {
    user,
    month,
    monthlySalary,
    workDays,
    hoursPerDay,
    perMinSalary,
    extraDays,
    absentDays,
    effectiveDays,
    perDaySalary,
    earnedSalary,
    // advance info — only this month's advances
    advances: allAdvances,
    thisMonthAdvTotal,
    totalPendingAdvance,
    advanceDeducted: advDeducted,
    // settlement
    bonus,
    otherDeductions,
    paidAmount,
    payableSalary,
    pendingAmount,
    status:        settlement?.status || 'draft',
    settlementId:  settlement?.id     || null,
    hasSettlement: !!settlement,
  };
}

// ── GET /summary?month=YYYY-MM ───────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || curMonth();
    const [staff] = await db.query(
      "SELECT id FROM users WHERE is_active=1 ORDER BY name"
    );
    const results = await Promise.all(
      staff.map(s => computeSalary(s.id, month).catch(e => { console.error(e.message); return null; }))
    );
    res.json({ success: true, data: results.filter(Boolean) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET /:userId/:month ───────────────────────────────────
router.get('/:userId/:month', async (req, res) => {
  try {
    const data = await computeSalary(req.params.userId, req.params.month);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET /advances/all ─────────────────────────────────────
router.get('/advances/all', async (req, res) => {
  try {
    const { user_id, status, month } = req.query;
    let q = `SELECT sa.*, u.name AS staff_name, u.role, u.designation,
                DATE_FORMAT(sa.advance_date,'%Y-%m') AS advance_month
             FROM staff_advances sa
             JOIN users u ON sa.user_id = u.id
             WHERE 1=1`;
    const params = [];
    if (user_id) { q += ' AND sa.user_id=?';  params.push(user_id); }
    if (status)  { q += ' AND sa.status=?';   params.push(status); }
    else         { q += " AND sa.status='pending'"; }
    // Filter by advance_date month (not entry month)
    if (month)   { q += " AND DATE_FORMAT(sa.advance_date,'%Y-%m')=?"; params.push(month); }
    q += ' ORDER BY sa.advance_date DESC LIMIT 500';
    const [rows] = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET /settlements/all ──────────────────────────────────
router.get('/settlements/all', async (req, res) => {
  try {
    const { month, user_id, status } = req.query;
    let q = `SELECT ss.*, u.name AS staff_name, u.role, u.designation
             FROM salary_settlements ss
             JOIN users u ON ss.user_id = u.id
             WHERE 1=1`;
    const params = [];
    if (month)   { q += ' AND ss.month=?';   params.push(month); }
    if (user_id) { q += ' AND ss.user_id=?'; params.push(user_id); }
    if (status)  { q += ' AND ss.status=?';  params.push(status); }
    q += ' ORDER BY ss.month DESC, u.name';
    const [rows] = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── POST /advances — add advance ──────────────────────────
router.post('/advances', authorize('admin','manager'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { user_id, amount, advance_date, description } = req.body;
    if (!user_id || !amount || !advance_date)
      return res.status(400).json({ success: false, message: 'user_id, amount, advance_date are required' });

    const amt = p2(amount);
    if (amt <= 0) return res.status(400).json({ success: false, message: 'Amount must be > 0' });

    const [r] = await conn.query(
      'INSERT INTO staff_advances (user_id, amount, advance_date, description, status, created_by) VALUES (?,?,?,?,?,?)',
      [user_id, amt, advance_date, description || null, 'pending', req.user.id]
    );
    // Get employee name for the expense note
    const [[emp]] = await conn.query('SELECT name FROM users WHERE id=?', [user_id]);
    const empName = emp?.name || `Staff #${user_id}`;
    // Auto-log expense on the advance_date with employee name
    await conn.query(
      "INSERT INTO expenses (category_id,amount,date,note,ref_type,ref_id,created_by) VALUES (?,?,?,?,?,?,?)",
      [2, amt, advance_date, `Advance — ${empName}${description ? ' · ' + description : ''}`, 'advance', r.insertId, req.user.id]
    );

    await conn.commit();
    wsHub.broadcast('dashboard', { type: 'stats_update' });
    wsHub.broadcast('sales',     { type: 'salary_updated', payload: { user_id: parseInt(user_id) } });
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, message: e.message }); }
  finally { conn.release(); }
});

// ── POST /settle ──────────────────────────────────────────
router.post('/settle', authorize('admin','manager'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { user_id, month, bonus = 0, deductions = 0, paid_amount, notes } = req.body;
    if (!user_id || !month)
      return res.status(400).json({ success: false, message: 'user_id and month are required' });

    const sd            = await computeSalary(user_id, month);
    const bonusAmt      = p2(bonus);
    const deductionsAmt = p2(deductions);
    const paidAmt       = p2(paid_amount || 0);
    // Lock the TOTAL advances at time of settlement (this month + carry-fwd)
    const advDeducted   = sd.totalPendingAdvance;

    const payable = p2(sd.earnedSalary + bonusAmt - advDeducted - deductionsAmt);
    if (paidAmt > payable + 0.01)
      return res.status(400).json({
        success: false,
        message: `Paid ₹${paidAmt} exceeds payable ₹${payable.toFixed(2)}`
      });

    const pending = p2(Math.max(0, payable - paidAmt));
    const status  = pending <= 0.009 ? 'paid' : (paidAmt > 0 ? 'partial' : 'draft');

    await conn.query(`
      INSERT INTO salary_settlements
        (user_id, month, monthly_salary, extra_days, absent_days, effective_days,
         per_day_salary, earned_salary, advance_deducted, bonus, deductions,
         payable_salary, paid_amount, pending_amount, status, notes, settled_by, settled_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
      ON DUPLICATE KEY UPDATE
        monthly_salary=VALUES(monthly_salary), extra_days=VALUES(extra_days),
        absent_days=VALUES(absent_days), effective_days=VALUES(effective_days),
        per_day_salary=VALUES(per_day_salary), earned_salary=VALUES(earned_salary),
        advance_deducted=VALUES(advance_deducted), bonus=VALUES(bonus),
        deductions=VALUES(deductions), payable_salary=VALUES(payable_salary),
        paid_amount=VALUES(paid_amount), pending_amount=VALUES(pending_amount),
        status=VALUES(status), notes=VALUES(notes),
        settled_by=VALUES(settled_by), settled_at=NOW()`,
      [
        user_id, month, sd.monthlySalary, sd.extraDays, sd.absentDays, sd.effectiveDays,
        sd.perDaySalary, sd.earnedSalary, advDeducted, bonusAmt, deductionsAmt,
        payable, paidAmt, pending, status, notes || null, req.user.id
      ]
    );

    // Mark ALL pending advances as deducted (both this month + carry-fwd)
    if (paidAmt > 0 || status === 'paid') {
      await conn.query(
        "UPDATE staff_advances SET status='deducted' WHERE user_id=? AND status='pending'",
        [user_id]
      );
    }

    // Auto-expense for salary paid
    if (paidAmt > 0) {
      await conn.query(
        "INSERT INTO expenses (category_id,amount,date,note,ref_type,ref_id,created_by) VALUES (?,?,?,?,?,?,?)",
        [1, paidAmt, localDate(), `Salary ${month} — ${sd.user.name}`, 'salary', user_id, req.user.id]
      );
    }

    await conn.commit();
    wsHub.broadcast('dashboard', { type: 'stats_update' });
    wsHub.broadcast('sales',     { type: 'salary_updated', payload: { user_id: parseInt(user_id), month, status } });
    res.json({ success: true, data: { status, payable, pending, paid: paidAmt } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, message: e.message }); }
  finally { conn.release(); }
});

// ── DELETE /advances/:id ──────────────────────────────────
router.delete('/advances/:id', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const advId = req.params.id;
    // Also delete the auto-created expense entry linked to this advance
    await conn.query("DELETE FROM expenses WHERE ref_type='advance' AND ref_id=?", [advId]);
    await conn.query('DELETE FROM staff_advances WHERE id=?', [advId]);
    await conn.commit();
    wsHub.broadcast('dashboard', { type: 'stats_update' });
    wsHub.broadcast('sales', { type: 'expense_added' }); // triggers expense list refresh
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: e.message });
  } finally { conn.release(); }
});

module.exports = router;
