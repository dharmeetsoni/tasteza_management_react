const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const wsHub   = require('../websocket');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// GET all categories
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM expense_categories WHERE is_active=1 ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET all expenses
router.get('/', async (req, res) => {
  try {
    const { date, from, to, category_id } = req.query;
    let q = `SELECT e.id, e.category_id, e.amount,
                DATE_FORMAT(e.date,'%Y-%m-%d') AS date,
                e.note, e.ref_type, e.ref_id, e.created_by,
                ec.name AS category_name, ec.icon AS cat_icon, ec.color AS cat_color,
                u.name AS created_by_name,
                -- For advance entries: get the staff member's name
                CASE
                  WHEN e.ref_type='advance' THEN (SELECT u2.name FROM staff_advances sa JOIN users u2 ON sa.user_id=u2.id WHERE sa.id=e.ref_id)
                  WHEN e.ref_type='salary'  THEN (SELECT u2.name FROM users u2 WHERE u2.id=e.ref_id)
                  ELSE NULL
                END AS staff_name
             FROM expenses e
             LEFT JOIN expense_categories ec ON e.category_id = ec.id
             LEFT JOIN users u ON e.created_by = u.id WHERE 1=1`;
    const params = [];
    if (date)        { q += ' AND DATE_FORMAT(e.date,\'%Y-%m-%d\')=?'; params.push(date); }
    if (from && to)  { q += ' AND e.date BETWEEN ? AND ?';              params.push(from, to); }
    else if (from)   { q += ' AND e.date>=?';                           params.push(from); }
    if (category_id) { q += ' AND e.category_id=?';                     params.push(category_id); }
    q += ' ORDER BY e.date DESC, e.id DESC LIMIT 1000';
    const [rows] = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET daily/monthly summary
router.get('/summary', async (req, res) => {
  try {
    const { date, month } = req.query;
    const today = date || localDate();
    const thisMonth = month || today.slice(0,7);

    const [[todaySum]] = await db.query(
      'SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM expenses WHERE date=?', [today]
    );
    const [[monthSum]] = await db.query(
      "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM expenses WHERE DATE_FORMAT(date,'%Y-%m')=?", [thisMonth]
    );
    const [byCat] = await db.query(
      `SELECT ec.name, ec.icon, ec.color, COALESCE(SUM(e.amount),0) AS total
       FROM expense_categories ec LEFT JOIN expenses e ON e.category_id=ec.id AND DATE_FORMAT(e.date,'%Y-%m')=?
       WHERE ec.is_active=1 GROUP BY ec.id ORDER BY total DESC`, [thisMonth]
    );
    res.json({ success: true, data: { today: todaySum, month: monthSum, byCategory: byCat } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// CREATE expense
router.post('/', async (req, res) => {
  try {
    const { category_id, amount, date, note } = req.body;
    if (!amount || !date) return res.status(400).json({ success: false, message: 'amount and date required' });
    const [r] = await db.query(
      'INSERT INTO expenses (category_id,amount,date,note,created_by) VALUES (?,?,?,?,?)',
      [category_id||null, parseFloat(amount), date, note||null, req.user.id]
    );
    wsHub.broadcast('dashboard', { type: 'stats_update' });
    wsHub.broadcast('sales', { type: 'expense_added', payload: { id: r.insertId, amount: parseFloat(amount), date } });
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// UPDATE expense
router.put('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const { category_id, amount, date, note } = req.body;
    await db.query(
      'UPDATE expenses SET category_id=?,amount=?,date=?,note=? WHERE id=?',
      [category_id||null, parseFloat(amount), date, note||null, req.params.id]
    );
    wsHub.broadcast('dashboard', { type: 'stats_update' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE expense
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    // If this is an advance auto-expense, we just delete the expense record only
    // (the advance itself stays - user must delete advance from Salary Manager if needed)
    await db.query('DELETE FROM expenses WHERE id=?', [req.params.id]);
    wsHub.broadcast('dashboard', { type: 'stats_update' });
    wsHub.broadcast('sales', { type: 'expense_added' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
