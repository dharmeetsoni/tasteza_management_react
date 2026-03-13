const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Auto-create quotation tables on first use
async function ensureTables() {
  await db.query(`CREATE TABLE IF NOT EXISTS quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_number  VARCHAR(30) NOT NULL UNIQUE,
    customer_name     VARCHAR(150),
    customer_phone    VARCHAR(20),
    customer_email    VARCHAR(150),
    customer_address  VARCHAR(255),
    notes             TEXT,
    valid_until       DATE,
    discount_type     ENUM('percentage','amount') DEFAULT NULL,
    discount_value    DECIMAL(10,2) DEFAULT 0,
    subtotal          DECIMAL(10,2) DEFAULT 0,
    gst_amount        DECIMAL(10,2) DEFAULT 0,
    discount_amount   DECIMAL(10,2) DEFAULT 0,
    total_amount      DECIMAL(10,2) DEFAULT 0,
    status            ENUM('draft','sent','accepted','rejected') DEFAULT 'draft',
    created_by        INT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS quotation_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id    INT NOT NULL,
    menu_item_id    INT DEFAULT NULL,
    item_name       VARCHAR(200) NOT NULL,
    quantity        INT DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL,
    gst_percent     DECIMAL(5,2) DEFAULT 0,
    gst_amount      DECIMAL(10,2) DEFAULT 0,
    total_price     DECIMAL(10,2) DEFAULT 0,
    notes           VARCHAR(255),
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
  )`);
}

// GET all quotations
router.get('/', async (req, res) => {
  try {
    await ensureTables();
    const { from, to, search, status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (from && to) { where += ` AND DATE_FORMAT(q.created_at,'%Y-%m-%d') BETWEEN ? AND ?`; params.push(from, to); }
    if (status)     { where += ' AND q.status=?'; params.push(status); }
    if (search)     { where += ' AND (q.quotation_number LIKE ? OR q.customer_name LIKE ? OR q.customer_phone LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    const [rows] = await db.query(`
      SELECT q.*, u.name AS created_by_name,
        DATE_FORMAT(q.created_at,'%Y-%m-%d') AS date,
        DATE_FORMAT(q.valid_until,'%Y-%m-%d') AS valid_until_fmt
      FROM quotations q
      LEFT JOIN users u ON q.created_by = u.id
      ${where}
      ORDER BY q.created_at DESC LIMIT 300
    `, params);
    res.json({ success: true, data: rows });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET single quotation with items
router.get('/:id', async (req, res) => {
  try {
    await ensureTables();
    const [[q]] = await db.query(`
      SELECT q.*, u.name AS created_by_name
      FROM quotations q LEFT JOIN users u ON q.created_by=u.id WHERE q.id=?
    `, [req.params.id]);
    if (!q) return res.status(404).json({ success: false, message: 'Not found.' });
    const [items] = await db.query('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY id', [req.params.id]);
    res.json({ success: true, data: { ...q, items } });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// CREATE quotation
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureTables();
    await conn.beginTransaction();
    const { customer_name, customer_phone, customer_email, customer_address,
            items, notes, valid_until, discount_type, discount_value } = req.body;
    if (!items || !items.length) return res.status(400).json({ success:false, message:'No items.' });

    const qnum = 'QT-' + Date.now().toString().slice(-8);
    let subtotal = 0, totalGst = 0;

    const [r] = await conn.query(`
      INSERT INTO quotations (quotation_number,customer_name,customer_phone,customer_email,
        customer_address,notes,valid_until,discount_type,discount_value,status,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [qnum, customer_name||null, customer_phone||null, customer_email||null,
       customer_address||null, notes||null, valid_until||null,
       discount_type||null, parseFloat(discount_value)||0, 'draft', req.user.id]
    );
    const qid = r.insertId;

    for (const item of items) {
      const price  = parseFloat(item.unit_price);
      const qty    = parseInt(item.quantity) || 1;
      const gstPct = parseFloat(item.gst_percent) || 0;
      const lineGst   = price * qty * gstPct / 100;
      const lineTotal = price * qty + lineGst;
      subtotal  += price * qty;
      totalGst  += lineGst;
      await conn.query(
        `INSERT INTO quotation_items (quotation_id,menu_item_id,item_name,quantity,unit_price,gst_percent,gst_amount,total_price,notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [qid, item.menu_item_id||null, item.item_name||item.name, qty, price, gstPct, lineGst, lineTotal, item.notes||null]
      );
    }

    let discountAmt = 0;
    if (discount_type === 'percentage' && discount_value > 0) discountAmt = (subtotal+totalGst) * parseFloat(discount_value)/100;
    else if (discount_type === 'amount' && discount_value > 0) discountAmt = parseFloat(discount_value);
    const finalTotal = Math.max(0, subtotal + totalGst - discountAmt);

    await conn.query(
      'UPDATE quotations SET subtotal=?,gst_amount=?,discount_amount=?,total_amount=? WHERE id=?',
      [subtotal, totalGst, discountAmt, finalTotal, qid]
    );
    await conn.commit();
    res.status(201).json({ success: true, data: { id: qid, quotation_number: qnum, total_amount: finalTotal } });
  } catch(err) { await conn.rollback(); res.status(500).json({ success:false, message:err.message }); }
  finally { conn.release(); }
});

// UPDATE quotation
router.put('/:id', authorize('admin','manager'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_name, customer_phone, customer_email, customer_address,
            items, notes, valid_until, discount_type, discount_value, status } = req.body;

    if (items && items.length) {
      await conn.query('DELETE FROM quotation_items WHERE quotation_id=?', [req.params.id]);
      let subtotal = 0, totalGst = 0;
      for (const item of items) {
        const price = parseFloat(item.unit_price); const qty = parseInt(item.quantity)||1;
        const gstPct = parseFloat(item.gst_percent)||0;
        const lineGst = price*qty*gstPct/100; const lineTotal = price*qty+lineGst;
        subtotal += price*qty; totalGst += lineGst;
        await conn.query(
          `INSERT INTO quotation_items (quotation_id,menu_item_id,item_name,quantity,unit_price,gst_percent,gst_amount,total_price,notes) VALUES (?,?,?,?,?,?,?,?,?)`,
          [req.params.id, item.menu_item_id||null, item.item_name||item.name, qty, price, gstPct, lineGst, lineTotal, item.notes||null]
        );
      }
      let discountAmt = 0;
      if (discount_type === 'percentage' && discount_value > 0) discountAmt = (subtotal+totalGst)*parseFloat(discount_value)/100;
      else if (discount_type === 'amount' && discount_value > 0) discountAmt = parseFloat(discount_value);
      const finalTotal = Math.max(0, subtotal+totalGst-discountAmt);
      await conn.query(
        'UPDATE quotations SET subtotal=?,gst_amount=?,discount_amount=?,total_amount=?,customer_name=?,customer_phone=?,customer_email=?,customer_address=?,notes=?,valid_until=?,discount_type=?,discount_value=?,status=? WHERE id=?',
        [subtotal, totalGst, discountAmt, finalTotal, customer_name||null, customer_phone||null, customer_email||null, customer_address||null, notes||null, valid_until||null, discount_type||null, parseFloat(discount_value)||0, status||'draft', req.params.id]
      );
    } else {
      const fields=[]; const vals=[];
      if (customer_name!==undefined){fields.push('customer_name=?');vals.push(customer_name||null);}
      if (customer_phone!==undefined){fields.push('customer_phone=?');vals.push(customer_phone||null);}
      if (notes!==undefined){fields.push('notes=?');vals.push(notes||null);}
      if (status!==undefined){fields.push('status=?');vals.push(status);}
      if (valid_until!==undefined){fields.push('valid_until=?');vals.push(valid_until||null);}
      if (fields.length) { vals.push(req.params.id); await conn.query(`UPDATE quotations SET ${fields.join(',')} WHERE id=?`, vals); }
    }
    await conn.commit();
    res.json({ success: true });
  } catch(err) { await conn.rollback(); res.status(500).json({ success:false, message:err.message }); }
  finally { conn.release(); }
});

// DELETE quotation
router.delete('/:id', authorize('admin','manager'), async (req, res) => {
  try {
    await db.query('DELETE FROM quotation_items WHERE quotation_id=?', [req.params.id]);
    await db.query('DELETE FROM quotations WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
