const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/validate', async (req, res) => {
  try {
    const { code, order_amount } = req.body;
    const [[c]] = await db.query("SELECT * FROM coupons WHERE code=? AND is_active=1", [code?.toUpperCase()]);
    if (!c) return res.status(404).json({ success: false, message: 'Invalid coupon code.' });
    const d=new Date(); const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (c.valid_from && today < c.valid_from) return res.status(400).json({ success: false, message: 'Coupon not yet active.' });
    if (c.valid_until && today > c.valid_until) return res.status(400).json({ success: false, message: 'Coupon has expired.' });
    if (c.usage_limit && c.used_count >= c.usage_limit) return res.status(400).json({ success: false, message: 'Coupon usage limit reached.' });
    if (c.min_order_amount && parseFloat(order_amount) < parseFloat(c.min_order_amount))
      return res.status(400).json({ success: false, message: `Min order ₹${c.min_order_amount} required.` });
    let discount = c.discount_type === 'percentage'
      ? (parseFloat(order_amount) * parseFloat(c.discount_value) / 100)
      : parseFloat(c.discount_value);
    if (c.max_discount) discount = Math.min(discount, parseFloat(c.max_discount));
    res.json({ success: true, data: { ...c, calculated_discount: discount.toFixed(2) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit, valid_from, valid_until } = req.body;
    if (!code || !discount_value) return res.status(400).json({ success: false, message: 'Code and discount value required.' });
    const [r] = await db.query(
      `INSERT INTO coupons (code,description,discount_type,discount_value,min_order_amount,max_discount,usage_limit,valid_from,valid_until)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [code.toUpperCase(), description||null, discount_type||'percentage', parseFloat(discount_value),
       parseFloat(min_order_amount)||0, max_discount?parseFloat(max_discount):null,
       usage_limit?parseInt(usage_limit):null, valid_from||null, valid_until||null]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Coupon code already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit, valid_from, valid_until, is_active } = req.body;
    await db.query(
      `UPDATE coupons SET code=?,description=?,discount_type=?,discount_value=?,min_order_amount=?,max_discount=?,usage_limit=?,valid_from=?,valid_until=?,is_active=? WHERE id=?`,
      [code?.toUpperCase(), description||null, discount_type||'percentage', parseFloat(discount_value),
       parseFloat(min_order_amount)||0, max_discount?parseFloat(max_discount):null,
       usage_limit?parseInt(usage_limit):null, valid_from||null, valid_until||null, is_active?1:0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM coupons WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
