const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

// ── SALES REPORT ──────────────────────────────────────────
router.get('/sales', async (req, res) => {
  try {
    const { from, to, group_by = 'day' } = req.query;
    const dateFilter = from && to ? `AND DATE_FORMAT(o.created_at,'%Y-%m-%d') BETWEEN '${from}' AND '${to}'` : '';
    const groupExpr = group_by === 'month' ? `DATE_FORMAT(o.created_at,'%Y-%m')` : `DATE_FORMAT(o.created_at,'%Y-%m-%d')`;
    const [rows] = await db.query(`
      SELECT ${groupExpr} AS period,
        COUNT(*) AS total_orders,
        SUM(o.subtotal) AS subtotal,
        SUM(o.gst_amount) AS gst_amount,
        SUM(o.discount_amount) AS discount_amount,
        SUM(o.total_amount) AS total_amount,
        SUM(CASE WHEN o.order_type='dine_in' THEN 1 ELSE 0 END) AS dine_in_count,
        SUM(CASE WHEN o.order_type='parcel' THEN 1 ELSE 0 END) AS parcel_count,
        SUM(CASE WHEN o.payment_method='cash' THEN o.total_amount ELSE 0 END) AS cash_total,
        SUM(CASE WHEN o.payment_method='card' THEN o.total_amount ELSE 0 END) AS card_total,
        SUM(CASE WHEN o.payment_method='upi' THEN o.total_amount ELSE 0 END) AS upi_total
      FROM orders o WHERE o.status='paid' ${dateFilter}
      GROUP BY period ORDER BY period DESC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── ITEM-WISE SALES ───────────────────────────────────────
router.get('/items', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to ? `AND DATE_FORMAT(o.created_at,'%Y-%m-%d') BETWEEN '${from}' AND '${to}'` : '';
    const [rows] = await db.query(`
      SELECT oi.item_name, oi.menu_item_id,
        SUM(oi.quantity) AS total_qty,
        AVG(oi.unit_price) AS avg_price,
        SUM(oi.unit_price * oi.quantity) AS gross_revenue,
        SUM(oi.gst_amount) AS total_gst,
        SUM(oi.total_price) AS total_revenue,
        mi.cost_price, mi.is_veg,
        mc.name AS course_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN menu_courses mc ON mi.course_id = mc.id
      WHERE o.status='paid' ${dateFilter}
      GROUP BY oi.menu_item_id, oi.item_name
      ORDER BY total_qty DESC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── PROFIT & LOSS ─────────────────────────────────────────
router.get('/pnl', async (req, res) => {
  try {
    const { from, to, month } = req.query;
    const mth = month || (from ? from.slice(0,7) : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })());
    const dateFilter = from && to
      ? `DATE_FORMAT(o.created_at,'%Y-%m-%d') BETWEEN '${from}' AND '${to}'`
      : `DATE_FORMAT(o.created_at,'%Y-%m') = '${mth}'`;

    const [[sales]] = await db.query(`
      SELECT COALESCE(SUM(o.subtotal),0) AS gross_sales,
             COALESCE(SUM(o.gst_amount),0) AS total_gst,
             COALESCE(SUM(o.discount_amount),0) AS total_discounts,
             COALESCE(SUM(o.total_amount),0) AS net_revenue,
             COUNT(*) AS orders_count
      FROM orders o WHERE o.status='paid' AND ${dateFilter}`);

    // COGS from order items × cost_price
    const [[cogs]] = await db.query(`
      SELECT COALESCE(SUM(oi.quantity * COALESCE(mi.cost_price, mi.selling_price*0.35)),0) AS total_cogs
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.status='paid' AND ${dateFilter}`);

    // Fixed costs
    const [fixedCosts] = await db.query(
      `SELECT * FROM fixed_costs WHERE month=?`, [mth]);
    const totalFixed = fixedCosts.reduce((s, f) => s + parseFloat(f.amount), 0);

    // Salary costs for month
    const [salaryData] = await db.query(
      `SELECT u.monthly_salary, u.work_days_month,
              COALESCE(adj.extra_days,0) AS extra_days,
              COALESCE(adj.absent_days,0) AS absent_days
       FROM users u
       LEFT JOIN staff_day_adjustments adj ON adj.user_id=u.id AND adj.month=?
       WHERE u.is_active=1 AND u.monthly_salary > 0`, [mth]);
    const totalSalary = salaryData.reduce((s, u) => {
      const wd = parseFloat(u.work_days_month)||30;
      const eff = wd + parseFloat(u.extra_days) - parseFloat(u.absent_days);
      return s + (parseFloat(u.monthly_salary)/wd) * eff;
    }, 0);

    // Fuel costs
    const [[fuel]] = await db.query(
      `SELECT COALESCE(SUM(total_cost),0) AS total_fuel FROM fuel_logs
       WHERE DATE_FORMAT(log_date,'%Y-%m')=?`, [mth]);

    const grossProfit = parseFloat(sales.net_revenue) - parseFloat(cogs.total_cogs);
    const totalExpenses = totalFixed + totalSalary + parseFloat(fuel?.total_fuel||0);
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = sales.net_revenue > 0 ? (grossProfit / sales.net_revenue * 100) : 0;
    const netMargin = sales.net_revenue > 0 ? (netProfit / sales.net_revenue * 100) : 0;

    res.json({ success: true, data: {
      period: mth,
      sales: { ...sales, gross_sales: parseFloat(sales.gross_sales), gst: parseFloat(sales.total_gst), discounts: parseFloat(sales.total_discounts), net_revenue: parseFloat(sales.net_revenue) },
      cogs: parseFloat(cogs.total_cogs),
      gross_profit: grossProfit,
      gross_margin: grossMargin,
      expenses: { fixed: totalFixed, salary: totalSalary, fuel: parseFloat(fuel?.total_fuel||0), fixed_list: fixedCosts, total: totalExpenses },
      net_profit: netProfit,
      net_margin: netMargin,
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── CUSTOMERS ─────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to ? `AND DATE_FORMAT(created_at,'%Y-%m-%d') BETWEEN '${from}' AND '${to}'` : '';
    const [rows] = await db.query(`
      SELECT customer_name, customer_phone,
        COUNT(*) AS visit_count,
        SUM(total_amount) AS total_spent,
        MAX(created_at) AS last_visit,
        MIN(created_at) AS first_visit
      FROM orders
      WHERE status='paid' AND customer_name IS NOT NULL ${dateFilter}
      GROUP BY customer_phone, customer_name
      ORDER BY total_spent DESC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── FIXED COSTS CRUD ──────────────────────────────────────
router.get('/fixed-costs', async (req, res) => {
  try {
    const { month } = req.query;
    const where = month ? `WHERE month='${month}'` : '';
    const [rows] = await db.query(`SELECT * FROM fixed_costs ${where} ORDER BY month DESC, created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.post('/fixed-costs', authorize('admin','manager'), async (req, res) => {
  try {
    const { name, amount, category, month, description } = req.body;
    const [r] = await db.query(
      'INSERT INTO fixed_costs (name,amount,category,month,description,created_by) VALUES (?,?,?,?,?,?)',
      [name, parseFloat(amount), category||'other', month, description||null, req.user.id]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/fixed-costs/:id', authorize('admin','manager'), async (req, res) => {
  try {
    const { name, amount, category, month, description } = req.body;
    await db.query('UPDATE fixed_costs SET name=?,amount=?,category=?,month=?,description=? WHERE id=?',
      [name, parseFloat(amount), category||'other', month, description||null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.delete('/fixed-costs/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM fixed_costs WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── ROLE PERMISSIONS ──────────────────────────────────────
router.get('/role-permissions', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM role_permissions ORDER BY role');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
router.put('/role-permissions/:role', authorize('admin'), async (req, res) => {
  try {
    const { permissions } = req.body;
    await db.query(
      `INSERT INTO role_permissions (role,permissions,updated_by) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE permissions=VALUES(permissions),updated_by=VALUES(updated_by)`,
      [req.params.role, JSON.stringify(permissions), req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── PAYMENT METHOD BREAKDOWN ───────────────────────────────
router.get('/payments', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to ? `AND DATE_FORMAT(created_at,'%Y-%m-%d') BETWEEN '${from}' AND '${to}'` : '';
    const [rows] = await db.query(`
      SELECT payment_method, COUNT(*) AS count, SUM(total_amount) AS total
      FROM orders WHERE status='paid' ${dateFilter}
      GROUP BY payment_method`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── DISCOUNT ANALYSIS ─────────────────────────────────────
router.get('/discounts', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to ? `AND DATE_FORMAT(created_at,'%Y-%m-%d') BETWEEN '${from}' AND '${to}'` : '';
    const [rows] = await db.query(`
      SELECT discount_type, coupon_code,
        COUNT(*) AS count,
        SUM(discount_amount) AS total_discount,
        AVG(discount_amount) AS avg_discount,
        SUM(total_amount) AS total_revenue
      FROM orders WHERE status='paid' AND discount_amount > 0 ${dateFilter}
      GROUP BY discount_type, coupon_code ORDER BY total_discount DESC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── STAFF SALARY REPORT ───────────────────────────────────
router.get('/salary-report', async (req, res) => {
  try {
    const { month } = req.query;
    const mth = month || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
    const [staff] = await db.query(`
      SELECT u.id, u.name, u.role, u.designation, u.monthly_salary, u.work_days_month,
             COALESCE(adj.extra_days,0) AS extra_days,
             COALESCE(adj.absent_days,0) AS absent_days,
             COALESCE(adv.total_advance,0) AS total_advance
      FROM users u
      LEFT JOIN staff_day_adjustments adj ON adj.user_id=u.id AND adj.month=?
      LEFT JOIN (SELECT user_id, SUM(amount) AS total_advance FROM staff_advances WHERE status='pending' GROUP BY user_id) adv ON adv.user_id=u.id
      WHERE u.is_active=1 ORDER BY u.name`, [mth]);
    const result = staff.map(s => {
      const wd = parseFloat(s.work_days_month)||30;
      const eff = wd + parseFloat(s.extra_days) - parseFloat(s.absent_days);
      const perDay = parseFloat(s.monthly_salary) / wd;
      const earned = perDay * eff;
      const net = earned - parseFloat(s.total_advance);
      return { ...s, effective_days: eff, per_day_salary: perDay, earned_salary: earned, net_payable: net };
    });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── DASHBOARD STATS (single fast query) ───────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const thisMonth = today.slice(0, 7);

    // Today's sales
    const [todayRows] = await db.query(`
      SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue,
             COALESCE(SUM(discount_amount),0) AS discounts,
             COALESCE(SUM(gst_amount),0) AS gst
      FROM orders WHERE status='paid' AND DATE_FORMAT(created_at,'%Y-%m-%d')=?`, [today]);

    // This month's sales
    const [monthRows] = await db.query(`
      SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
      FROM orders WHERE status='paid' AND DATE_FORMAT(created_at,'%Y-%m')=?`, [thisMonth]);

    // Yesterday comparison
    const yesterday = (() => { const d = new Date(Date.now()-86400000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const [yestRows] = await db.query(`
      SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS orders
      FROM orders WHERE status='paid' AND DATE_FORMAT(created_at,'%Y-%m-%d')=?`, [yesterday]);

    // Live open orders
    const [liveRows] = await db.query(`
      SELECT COUNT(*) AS open_orders FROM orders WHERE status IN ('open','kot')`);

    // KOT pending — safe if table doesn't exist yet
    let pendingRows = [{ pending: 0 }];
    try {
      [pendingRows] = await db.query(`SELECT COUNT(*) AS pending FROM kot_tickets WHERE status IN ('pending','preparing')`);
    } catch { pendingRows = [{ pending: 0 }]; }

    // Top 5 items today
    let topItems = [];
    try {
      [topItems] = await db.query(`
        SELECT oi.item_name, SUM(oi.quantity) AS qty, SUM(oi.total_price) AS revenue
        FROM order_items oi JOIN orders o ON oi.order_id=o.id
        WHERE o.status='paid' AND DATE_FORMAT(o.created_at,'%Y-%m-%d')=?
        GROUP BY oi.item_name ORDER BY qty DESC LIMIT 5`, [today]);
    } catch { topItems = []; }

    // Last 7 days sales for chart
    const [last7] = await db.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m-%d') AS day, COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
      FROM orders WHERE status='paid' AND DATE_FORMAT(created_at,'%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY day ORDER BY day ASC`);

    // Payment method today
    const [payments] = await db.query(`
      SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS total
      FROM orders WHERE status='paid' AND DATE_FORMAT(created_at,'%Y-%m-%d')=?
      GROUP BY payment_method`, [today]);

    // Hourly today
    const [hourly] = await db.query(`
      SELECT HOUR(created_at) AS hour, COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
      FROM orders WHERE status='paid' AND DATE_FORMAT(created_at,'%Y-%m-%d')=?
      GROUP BY hour ORDER BY hour`, [today]);

    // This month top categories — safe if menu tables missing
    let topCats = [];
    try {
      [topCats] = await db.query(`
        SELECT mc.name AS category, mc.icon, SUM(oi.quantity) AS qty, SUM(oi.total_price) AS revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id=o.id
        LEFT JOIN menu_items mi ON oi.menu_item_id=mi.id
        LEFT JOIN menu_courses mc ON mi.course_id=mc.id
        WHERE o.status='paid' AND DATE_FORMAT(o.created_at,'%Y-%m')=?
        GROUP BY mc.id ORDER BY revenue DESC LIMIT 6`, [thisMonth]);
    } catch { topCats = []; }

    // Monthly comparison (last 6 months)
    const [monthlyTrend] = await db.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
             COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
      FROM orders WHERE status='paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month ASC`);

    // Active tables — safe even if table is empty
    const [tablesRows] = await db.query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN t.id IN (SELECT table_id FROM orders WHERE status IN ('open','kot','billed')) THEN 1 ELSE 0 END) AS occupied
      FROM restaurant_tables t WHERE t.is_active=1`);
    const tables = tablesRows[0] || { total: 0, occupied: 0 };

    // Low stock alert — table is inventory_items (not inventory)
    let lowStock = [];
    try {
      [lowStock] = await db.query(`
        SELECT name, current_quantity AS quantity, min_quantity
        FROM inventory_items
        WHERE min_quantity IS NOT NULL AND current_quantity <= min_quantity
        LIMIT 5`);
    } catch { lowStock = []; }

    res.json({ success: true, data: {
      today: todayRows[0] || { orders:0, revenue:0, discounts:0, gst:0 },
      yesterday: yestRows[0] || { revenue:0, orders:0 },
      month: monthRows[0] || { revenue:0, orders:0 },
      live: { open_orders: (liveRows[0]||{}).open_orders||0, pending_kot: (pendingRows[0]||{}).pending||0 },
      tables,
      top_items: topItems,
      last7,
      payments,
      hourly,
      top_categories: topCats,
      monthly_trend: monthlyTrend,
      low_stock: lowStock,
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;

// ── INVENTORY REPORT ──────────────────────────────────────
// GET /reports/inventory/summary — current stock levels with value
router.get('/inventory/summary', async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT i.id, i.name, i.current_quantity, i.min_quantity,
             i.purchase_price, i.selling_price,
             i.current_quantity * COALESCE(i.purchase_price, 0) AS stock_value,
             c.name AS category_name,
             u.abbreviation AS unit_abbr,
             CASE
               WHEN i.min_quantity IS NOT NULL AND i.current_quantity <= 0              THEN 'out_of_stock'
               WHEN i.min_quantity IS NOT NULL AND i.current_quantity <= i.min_quantity THEN 'low_stock'
               ELSE 'ok'
             END AS stock_status
      FROM inventory_items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      ORDER BY c.name, i.name
    `);
    const totalValue = items.reduce((s, r) => s + parseFloat(r.stock_value || 0), 0);
    const lowCount   = items.filter(r => r.stock_status === 'low_stock').length;
    const outCount   = items.filter(r => r.stock_status === 'out_of_stock').length;
    res.json({ success: true, data: { items, totalValue, lowCount, outCount } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /reports/inventory/movements — movement history with filters
router.get('/inventory/movements', async (req, res) => {
  try {
    const { from, to, item_id, movement_type } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (from && to) { where += ' AND DATE_FORMAT(m.created_at,\'%Y-%m-%d\') BETWEEN ? AND ?'; params.push(from, to); }
    if (item_id)       { where += ' AND m.inventory_item_id=?'; params.push(item_id); }
    if (movement_type) { where += ' AND m.movement_type=?';     params.push(movement_type); }

    const [rows] = await db.query(`
      SELECT m.*, i.name AS item_name, u.abbreviation AS unit_abbr,
             DATE_FORMAT(m.created_at,'%Y-%m-%d') AS date,
             ub.name AS created_by_name
      FROM inventory_movements m
      JOIN inventory_items i ON m.inventory_item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN users ub ON m.created_by = ub.id
      ${where}
      ORDER BY m.created_at DESC LIMIT 1000
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// GET /reports/inventory/daily-category — daily category-wise consumption vs purchase
router.get('/inventory/daily-category', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ success: false, message: 'from and to required' });

    // Daily consumption (sale_deductions) grouped by category
    const [consumed] = await db.query(`
      SELECT
        DATE_FORMAT(m.created_at,'%Y-%m-%d') AS day,
        c.id          AS category_id,
        c.name        AS category_name,
        c.image_url   AS category_image,
        SUM(ABS(m.quantity_change) * COALESCE(i.purchase_price,0)) AS consumed_value,
        SUM(ABS(m.quantity_change))                                  AS consumed_qty
      FROM inventory_movements m
      JOIN inventory_items i  ON m.inventory_item_id = i.id
      JOIN categories      c  ON i.category_id       = c.id
      WHERE m.movement_type = 'sale_deduction'
        AND DATE_FORMAT(m.created_at,'%Y-%m-%d') BETWEEN ? AND ?
      GROUP BY day, c.id
      ORDER BY day DESC, c.name
    `, [from, to]);

    // Daily purchases grouped by category
    const [purchased] = await db.query(`
      SELECT
        DATE_FORMAT(p.purchase_date,'%Y-%m-%d') AS day,
        c.id          AS category_id,
        c.name        AS category_name,
        c.image_url   AS category_image,
        SUM(p.total_amount)    AS purchased_value,
        SUM(p.quantity)        AS purchased_qty
      FROM inventory_purchases p
      JOIN inventory_items i ON p.inventory_item_id = i.id
      JOIN categories      c ON i.category_id       = c.id
      WHERE DATE_FORMAT(p.purchase_date,'%Y-%m-%d') BETWEEN ? AND ?
      GROUP BY day, c.id
      ORDER BY day DESC, c.name
    `, [from, to]);

    // All categories present in the period
    const catMap = {};
    [...consumed, ...purchased].forEach(r => {
      catMap[r.category_id] = { id: r.category_id, name: r.category_name, image_url: r.category_image };
    });

    res.json({ success: true, data: { consumed, purchased, categories: Object.values(catMap) } });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /reports/inventory/consumption — item consumption by date range
router.get('/inventory/consumption', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to
      ? `AND DATE_FORMAT(m.created_at,'%Y-%m-%d') BETWEEN '${from}' AND '${to}'` : '';
    const [rows] = await db.query(`
      SELECT i.id, i.name AS item_name, u.abbreviation AS unit_abbr,
             c.name AS category_name,
             ABS(SUM(CASE WHEN m.movement_type='sale_deduction' THEN m.quantity_change ELSE 0 END)) AS sold_qty,
             SUM(CASE WHEN m.movement_type='purchase'           THEN m.quantity_change ELSE 0 END) AS purchased_qty,
             ABS(SUM(CASE WHEN m.movement_type='sale_deduction' THEN m.quantity_change ELSE 0 END))
               * COALESCE(i.purchase_price, 0) AS consumed_value
      FROM inventory_items i
      LEFT JOIN inventory_movements m ON m.inventory_item_id = i.id ${dateFilter}
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      GROUP BY i.id
      HAVING sold_qty > 0 OR purchased_qty > 0
      ORDER BY consumed_value DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── ADMIN: RESET ALL OPERATIONAL DATA (keep users/settings/menu) ─
// DELETE /reports/reset-data — ADMIN ONLY — selective by category
const { authorize: _auth } = require('../middleware/auth');
router.delete('/reset-data', _auth('admin'), async (req, res) => {
  const conn = await db.getConnection();
  const sel = req.body || {};
  const deleted = [];
  const errors  = [];

  // Helper: run query, swallow error, log it
  const safe = async (sql, params=[]) => {
    try { await conn.query(sql, params); } catch(e) { errors.push(e.message); }
  };

  try {
    // Disable FK checks for the duration so order doesn't matter
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.beginTransaction();

    if (sel.orders) {
      await safe('DELETE FROM inventory_movements');
      await safe('DELETE FROM kot_items');
      await safe('DELETE FROM kot_tickets');
      await safe('DELETE FROM order_items');
      await safe('DELETE FROM orders');
      // Clear the order_id reference on tables
      await safe('UPDATE restaurant_tables SET order_id=NULL, order_status=NULL, order_type=NULL, customer_name=NULL, total_amount=0');
      deleted.push('Orders & KOTs');
    }

    if (sel.inventory) {
      await safe('DELETE FROM inventory_movements');
      await safe('UPDATE inventory_items SET current_quantity=0');
      await safe('DELETE FROM purchase_order_items');
      await safe('DELETE FROM purchase_orders');
      deleted.push('Inventory stock & purchase orders');
    }

    if (sel.inventory_items) {
      await safe('DELETE FROM inventory_movements');
      await safe('UPDATE menu_items SET inventory_item_id=NULL');
      await safe('UPDATE recipe_items SET inventory_item_id=NULL');
      await safe('DELETE FROM inventory_items');
      deleted.push('Inventory items');
    }

    if (sel.salary) {
      await safe('DELETE FROM staff_advances');
      await safe('DELETE FROM salary_records');
      deleted.push('Salary records & advances');
    }

    if (sel.expenses) {
      await safe('DELETE FROM expenses');
      await safe('DELETE FROM fuel_logs');
      await safe('DELETE FROM fixed_costs');
      deleted.push('Expenses, fuel logs & fixed costs');
    }

    if (sel.menu) {
      await safe('UPDATE menu_items SET recipe_id=NULL, inventory_item_id=NULL');
      await safe('DELETE FROM recipe_items');
      await safe('DELETE FROM recipe_staff');
      await safe('DELETE FROM recipes');
      await safe('DELETE FROM menu_items');
      deleted.push('Menu items & recipes');
    }

    if (sel.staff) {
      await safe('DELETE FROM staff_advances WHERE staff_id IN (SELECT id FROM users WHERE role != "admin")');
      await safe('DELETE FROM salary_records WHERE staff_id IN (SELECT id FROM users WHERE role != "admin")');
      await safe('DELETE FROM users WHERE role != "admin"');
      deleted.push('Staff (non-admin)');
    }

    if (sel.coupons) {
      await safe('UPDATE orders SET coupon_id=NULL, coupon_code=NULL');
      await safe('DELETE FROM coupons');
      deleted.push('Coupons');
    }

    if (sel.tables) {
      await safe('DELETE FROM restaurant_tables WHERE (order_id IS NULL OR order_id=0)');
      deleted.push('Tables (unoccupied)');
    }

    await conn.commit();
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    res.json({ success: true, deleted, errors, message: deleted.length ? 'Deleted: ' + deleted.join(', ') : 'Nothing selected' });
  } catch (err) {
    await conn.rollback();
    await conn.query('SET FOREIGN_KEY_CHECKS=1').catch(()=>{});
    console.error('[reset-data]', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── DAILY P&L FOR MONTH ───────────────────────────────────
// Returns per-day breakdown for a given month:
// sales, base cost, expenses, predicted days, salary/rent/light per day
router.get('/daily-pnl', async (req, res) => {
  try {
    const { month } = req.query;
    const mth = month || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
    const [year, mon] = mth.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // 1. Daily sales + base cost from orders
    const [salesRows] = await db.query(`
      SELECT
        DATE_FORMAT(o.created_at,'%Y-%m-%d') AS date,
        SUM(o.total_amount) AS total_sale,
        SUM(oi.quantity * COALESCE(mi.cost_price, mi.selling_price * 0.35)) AS base_cost
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.status = 'paid'
        AND DATE_FORMAT(o.created_at,'%Y-%m') = ?
      GROUP BY DATE_FORMAT(o.created_at,'%Y-%m-%d')
      ORDER BY date ASC
    `, [mth]);

    // 2. Daily misc expenses only — Marketing, Maintenance, Miscellaneous categories
    // (Salary, Advance, Fuel, Electricity etc. are already counted separately)
    const [expRows] = await db.query(`
      SELECT DATE_FORMAT(e.date,'%Y-%m-%d') AS date,
             SUM(e.amount) AS total_expense
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE DATE_FORMAT(e.date,'%Y-%m') = ?
        AND LOWER(ec.name) IN ('marketing','maintenance','miscellaneous')
      GROUP BY DATE_FORMAT(e.date,'%Y-%m-%d')
    `, [mth]);

    // 3. Total monthly salary (all active staff)
    const [salaryData] = await db.query(`
      SELECT u.monthly_salary, u.work_days_month,
             COALESCE(adj.extra_days,0) AS extra_days,
             COALESCE(adj.absent_days,0) AS absent_days
      FROM users u
      LEFT JOIN staff_day_adjustments adj ON adj.user_id=u.id AND adj.month=?
      WHERE u.is_active=1 AND u.monthly_salary > 0
    `, [mth]);
    const monthlySalary = salaryData.reduce((s, u) => {
      const wd = parseFloat(u.work_days_month) || 30;
      const eff = wd + parseFloat(u.extra_days) - parseFloat(u.absent_days);
      return s + (parseFloat(u.monthly_salary) / wd) * eff;
    }, 0);
    const dailySalary = monthlySalary / daysInMonth;

    // 4. Fixed costs: rent & light for this month (from fixed_costs table)
    const [fixedRows] = await db.query(`
      SELECT name, amount, category FROM fixed_costs WHERE month=?
    `, [mth]);
    const rentEntry   = fixedRows.find(f => f.category === 'rent')  || fixedRows.find(f => f.name?.toLowerCase().includes('rent'));
    const lightEntry  = fixedRows.find(f => f.category === 'electricity') || fixedRows.find(f => f.name?.toLowerCase().includes('light') || f.name?.toLowerCase().includes('electric'));
    const monthlyRent  = parseFloat(rentEntry?.amount  || 0);
    const monthlyLight = parseFloat(lightEntry?.amount || 0);
    const dailyRent  = monthlyRent  / daysInMonth;
    const dailyLight = monthlyLight / daysInMonth;

    // 5. Build day-by-day array
    const salesMap = {};
    salesRows.forEach(r => { salesMap[r.date] = { total_sale: parseFloat(r.total_sale)||0, base_cost: parseFloat(r.base_cost)||0 }; });
    const expMap = {};
    expRows.forEach(r => { expMap[r.date] = parseFloat(r.total_expense)||0; });

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${mth}-${String(d).padStart(2,'0')}`;
      const isPast    = dateStr <= todayStr;
      const isToday   = dateStr === todayStr;
      const s = salesMap[dateStr] || { total_sale: 0, base_cost: 0 };
      const expense   = expMap[dateStr] || 0;
      const totalDeductions = s.base_cost + dailySalary + dailyRent + dailyLight + expense;
      const profit = s.total_sale - totalDeductions;
      days.push({
        date:         dateStr,
        day:          d,
        is_past:      isPast,
        is_today:     isToday,
        has_sale:     s.total_sale > 0,
        total_sale:   s.total_sale,
        base_cost:    s.base_cost,
        salary:       dailySalary,
        rent:         dailyRent,
        light:        dailyLight,
        expense:      expense,
        total_deductions: totalDeductions,
        profit:       profit,
      });
    }

    // 6. Predict remaining days using avg of past days with sales
    const pastWithSale = days.filter(d => d.is_past && d.has_sale);
    const avgSale    = pastWithSale.length ? pastWithSale.reduce((s,d)=>s+d.total_sale,0)   / pastWithSale.length : 0;
    const avgCost    = pastWithSale.length ? pastWithSale.reduce((s,d)=>s+d.base_cost,0)    / pastWithSale.length : 0;
    const avgExpense = pastWithSale.length ? pastWithSale.reduce((s,d)=>s+d.expense,0)      / pastWithSale.length : 0;
    const avgProfit  = pastWithSale.length ? pastWithSale.reduce((s,d)=>s+d.profit,0)       / pastWithSale.length : 0;

    res.json({ success: true, data: {
      month: mth,
      days_in_month: daysInMonth,
      monthly: { salary: monthlySalary, rent: monthlyRent, light: monthlyLight },
      daily:   { salary: dailySalary, rent: dailyRent, light: dailyLight },
      fixed_costs: fixedRows,
      days,
      averages: { sale: avgSale, base_cost: avgCost, expense: avgExpense, profit: avgProfit },
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
