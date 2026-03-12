const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const wsHub = require('../websocket');
const { deductInventoryForOrder } = require('../utils/inventoryDeduct');
router.use(authenticate);

// GET all orders
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.*, t.table_number, t.table_name, u.name AS created_by_name, b.name AS billed_by_name
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN users b ON o.billed_by = b.id
      ORDER BY o.created_at DESC LIMIT 200`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET single order with items
// ── GET orders with filters (for orders management page) ──
router.get('/all/list', async (req, res) => {
  try {
    const { from, to, status, search, payment_method, order_type, limit = 500 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (from && to) { where += " AND DATE_FORMAT(COALESCE(o.paid_at, o.created_at),'%Y-%m-%d') BETWEEN ? AND ?"; params.push(from, to); }
    if (status)         { where += ' AND o.status=?';           params.push(status); }
    if (payment_method) { where += ' AND o.payment_method=?';   params.push(payment_method); }
    if (order_type)     { where += ' AND o.order_type=?';       params.push(order_type); }
    if (search)         { where += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const [rows] = await db.query(`
      SELECT o.*,
        t.table_number, t.table_name,
        u.name AS created_by_name,
        b.name AS billed_by_name,
        DATE_FORMAT(o.created_at,'%Y-%m-%d') AS date,
        DATE_FORMAT(o.paid_at,'%Y-%m-%d %H:%i') AS paid_at_fmt
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN users b ON o.billed_by  = b.id
      ${where}
      ORDER BY o.created_at DESC LIMIT ?
    `, [...params, parseInt(limit)]);
    res.json({ success:true, data:rows });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await db.query(`
      SELECT o.*, t.table_number, t.table_name, u.name AS created_by_name
      FROM orders o LEFT JOIN restaurant_tables t ON o.table_id=t.id
      LEFT JOIN users u ON o.created_by=u.id WHERE o.id=?`, [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    const [items] = await db.query(
      `SELECT oi.*, mi.is_veg, mi.description AS item_description
       FROM order_items oi LEFT JOIN menu_items mi ON oi.menu_item_id=mi.id
       WHERE oi.order_id=? ORDER BY oi.id`, [req.params.id]);
    res.json({ success: true, data: { ...order, items } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// CREATE order
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { table_id, order_type, items, kot_instructions } = req.body;
    if (!items || !items.length) return res.status(400).json({ success: false, message: 'No items.' });
    const order_number = 'ORD-' + Date.now().toString().slice(-8);
    const [r] = await conn.query(
      `INSERT INTO orders (order_number,table_id,order_type,status,kot_instructions,created_by)
       VALUES (?,?,?,?,?,?)`,
      [order_number, table_id||null, order_type||'dine_in', 'open', kot_instructions||null, req.user.id]
    );
    const orderId = r.insertId;
    let subtotal = 0, totalGst = 0;
    for (const item of items) {
      const [[mi]] = await conn.query('SELECT * FROM menu_items WHERE id=?', [item.menu_item_id]);
      if (!mi) continue;
      const price = parseFloat(mi.selling_price);
      const gstPct = parseFloat(mi.gst_percent)||0;
      const qty = parseInt(item.quantity)||1;
      const lineGst = price * qty * gstPct / 100;
      const lineTotal = price * qty + lineGst;
      subtotal += price * qty;
      totalGst += lineGst;
      await conn.query(
        `INSERT INTO order_items (order_id,menu_item_id,item_name,quantity,unit_price,gst_percent,gst_amount,total_price,kot_instructions,notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [orderId, mi.id, mi.name, qty, price, gstPct, lineGst, lineTotal, item.kot_instructions||null, item.notes||null]
      );
    }
    const total = subtotal + totalGst;
    await conn.query('UPDATE orders SET subtotal=?,gst_amount=?,total_amount=? WHERE id=?', [subtotal, totalGst, total, orderId]);
    await conn.commit();
    wsHub.broadcast('sales', { type:'order_created', payload: { id: orderId, order_number, table_id: table_id||null } });
    wsHub.broadcast('dashboard', { type:'stats_update' });
    res.status(201).json({ success: true, data: { id: orderId, order_number } });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// UPDATE order items
router.put('/:id/items', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items, kot_instructions } = req.body;
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.status === 'paid' || order.status === 'cancelled')
      return res.status(400).json({ success: false, message: 'Cannot edit closed order.' });

    // Delete un-KOT'd items and re-insert all
    await conn.query('DELETE FROM order_items WHERE order_id=? AND kot_sent=0', [req.params.id]);
    // Keep already KOT'd items, add new ones
    let subtotal = 0, totalGst = 0;
    const [existing] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    existing.forEach(ei => { subtotal += parseFloat(ei.unit_price) * ei.quantity; totalGst += parseFloat(ei.gst_amount); });

    for (const item of items) {
      const [[mi]] = await conn.query('SELECT * FROM menu_items WHERE id=?', [item.menu_item_id]);
      if (!mi) continue;
      const price = parseFloat(mi.selling_price);
      const gstPct = parseFloat(mi.gst_percent)||0;
      const qty = parseInt(item.quantity)||1;
      const lineGst = price * qty * gstPct / 100;
      const lineTotal = price * qty + lineGst;
      subtotal += price * qty; totalGst += lineGst;
      await conn.query(
        `INSERT INTO order_items (order_id,menu_item_id,item_name,quantity,unit_price,gst_percent,gst_amount,total_price,kot_instructions,notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [req.params.id, mi.id, mi.name, qty, price, gstPct, lineGst, lineTotal, item.kot_instructions||null, item.notes||null]
      );
    }
    if (kot_instructions !== undefined)
      await conn.query('UPDATE orders SET kot_instructions=? WHERE id=?', [kot_instructions||null, req.params.id]);
    const total = subtotal + totalGst;
    await conn.query('UPDATE orders SET subtotal=?,gst_amount=?,total_amount=? WHERE id=?', [subtotal, totalGst, total, req.params.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// SEND KOT
router.post('/:id/kot', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { instructions } = req.body;
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    const [newItems] = await conn.query('SELECT * FROM order_items WHERE order_id=? AND kot_sent=0', [req.params.id]);
    if (!newItems.length) return res.status(400).json({ success: false, message: 'No new items to KOT.' });
    const kot_number = 'KOT-' + Date.now().toString().slice(-6);
    const [kr] = await conn.query(
      'INSERT INTO kot_tickets (order_id,table_id,kot_number,instructions,created_by) VALUES (?,?,?,?,?)',
      [req.params.id, order.table_id, kot_number, instructions||order.kot_instructions||null, req.user.id]
    );
    for (const item of newItems) {
      await conn.query('INSERT INTO kot_items (kot_id,order_item_id,item_name,quantity,notes) VALUES (?,?,?,?,?)',
        [kr.insertId, item.id, item.item_name, item.quantity, item.kot_instructions||null]);
    }
    await conn.query('UPDATE order_items SET kot_sent=1 WHERE order_id=? AND kot_sent=0', [req.params.id]);
    await conn.query("UPDATE orders SET status='kot' WHERE id=?", [req.params.id]);
    await conn.commit();
    wsHub.broadcast('kot', { type:'kot_new', payload: { kot_number, order_id: req.params.id, table_id: order.table_id } });
    wsHub.broadcast('sales', { type:'order_updated', payload: { id: req.params.id, status:'kot' } });
    res.json({ success: true, data: { kot_number } });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// GENERATE BILL (apply discount)
router.post('/:id/bill', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_name, customer_phone, discount_type, discount_value, coupon_code, notes } = req.body;
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    let discountAmt = 0, couponId = null, appliedCoupon = coupon_code || null;

    if (discount_type === 'coupon' && coupon_code) {
      const [[c]] = await conn.query("SELECT * FROM coupons WHERE code=? AND is_active=1", [coupon_code.toUpperCase()]);
      if (c) {
        couponId = c.id;
        appliedCoupon = c.code;
        discountAmt = c.discount_type === 'percentage'
          ? Math.min(parseFloat(order.subtotal) * parseFloat(c.discount_value) / 100, c.max_discount || 99999)
          : parseFloat(c.discount_value);
        await conn.query('UPDATE coupons SET used_count=used_count+1 WHERE id=?', [c.id]);
      }
    } else if (discount_type === 'percentage' && discount_value > 0) {
      discountAmt = parseFloat(order.subtotal) * parseFloat(discount_value) / 100;
    } else if (discount_type === 'amount' && discount_value > 0) {
      discountAmt = parseFloat(discount_value);
    }
    discountAmt = Math.min(discountAmt, parseFloat(order.total_amount));
    const finalTotal = Math.max(0, parseFloat(order.total_amount) - discountAmt);

    await conn.query(
      `UPDATE orders SET status='billed',customer_name=?,customer_phone=?,
       discount_type=?,discount_value=?,discount_amount=?,coupon_id=?,coupon_code=?,
       total_amount=?,notes=?,billed_by=?,billed_at=NOW() WHERE id=?`,
      [customer_name||null, customer_phone||null, discount_type||null,
       parseFloat(discount_value)||0, discountAmt, couponId, appliedCoupon,
       finalTotal, notes||null, req.user.id, req.params.id]
    );
    // Auto-serve all KOTs for this order that are still pending/preparing/ready
    await conn.query(
      "UPDATE kot_tickets SET status='served' WHERE order_id=? AND status IN ('pending','preparing','ready')",
      [req.params.id]
    );

    await conn.commit();
    wsHub.broadcast('billing', { type:'bill_generated', payload: { order_id: req.params.id, total: finalTotal } });
    wsHub.broadcast('sales',   { type:'order_updated',  payload: { id: req.params.id, status:'billed' } });
    wsHub.broadcast('kot',     { type:'kot_status',     payload: { order_id: req.params.id, auto_served: true } });
    wsHub.broadcast('kds',     { type:'kot_status',     payload: { order_id: req.params.id, auto_served: true } });
    res.json({ success: true, data: { total_amount: finalTotal, discount_amount: discountAmt } });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// MARK PAID — also deducts inventory
router.post('/:id/pay', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { payment_method } = req.body;
    const orderId = req.params.id;

    // Guard: only deduct once (don't deduct if already paid)
    const [[existing]] = await conn.query('SELECT status FROM orders WHERE id=?', [orderId]);
    if (!existing) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Order not found.' }); }
    if (existing.status === 'paid') { await conn.rollback(); return res.json({ success: true }); }

    await conn.query(
      "UPDATE orders SET status='paid',payment_status='paid',payment_method=?,paid_at=NOW() WHERE id=?",
      [payment_method||'cash', orderId]
    );

    // Deduct ingredients from inventory based on recipes
    try {
      await deductInventoryForOrder(conn, orderId, req.user.id);
    } catch (invErr) {
      // Log but don't fail the payment — inventory deduction is best-effort
      console.error('[Inventory] Deduction error for order', orderId, ':', invErr.message);
    }

    await conn.commit();
    wsHub.broadcast('sales',     { type: 'order_paid',    payload: { id: parseInt(orderId), payment_method: payment_method||'cash' } });
    wsHub.broadcast('dashboard', { type: 'stats_update' });
    wsHub.broadcast('inventory', { type: 'stock_updated', payload: { order_id: orderId } });
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── UPDATE a single order item (even after KOT) ──────────────────────────────
// PATCH /orders/:id/items/:itemId  { quantity, notes, kot_instructions }
router.patch('/:id/items/:itemId', authorize('admin','manager','staff'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { quantity, notes, kot_instructions } = req.body;
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.status === 'paid' || order.status === 'cancelled')
      return res.status(400).json({ success: false, message: 'Cannot edit closed order.' });

    const [[item]] = await conn.query('SELECT * FROM order_items WHERE id=? AND order_id=?', [req.params.itemId, req.params.id]);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    const qty = parseInt(quantity) || item.quantity;
    const price = parseFloat(item.unit_price);
    const gstPct = parseFloat(item.gst_percent) || 0;
    const lineGst = price * qty * gstPct / 100;
    const lineTotal = price * qty + lineGst;

    await conn.query(
      'UPDATE order_items SET quantity=?, gst_amount=?, total_price=?, notes=?, kot_instructions=? WHERE id=?',
      [qty, lineGst, lineTotal, notes ?? item.notes, kot_instructions ?? item.kot_instructions, item.id]
    );

    // Recalc order totals
    const [all] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    const subtotal = all.reduce((s, r) => s + parseFloat(r.unit_price) * r.quantity, 0);
    const totalGst = all.reduce((s, r) => s + parseFloat(r.gst_amount), 0);
    await conn.query('UPDATE orders SET subtotal=?, gst_amount=?, total_amount=? WHERE id=?',
      [subtotal, totalGst, subtotal + totalGst, req.params.id]);

    await conn.commit();
    wsHub.broadcast('sales', { type: 'order_updated', payload: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// ── DELETE a single order item (even after KOT) ──────────────────────────────
// DELETE /orders/:id/items/:itemId
router.delete('/:id/items/:itemId', authorize('admin','manager','staff'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.status === 'paid' || order.status === 'cancelled')
      return res.status(400).json({ success: false, message: 'Cannot edit closed order.' });

    const [[item]] = await conn.query('SELECT * FROM order_items WHERE id=? AND order_id=?', [req.params.itemId, req.params.id]);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    await conn.query('DELETE FROM order_items WHERE id=?', [item.id]);
    // Also remove from any kot_items entries (for display consistency)
    await conn.query('DELETE FROM kot_items WHERE order_item_id=?', [item.id]);

    // Recalc order totals
    const [all] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    const subtotal = all.reduce((s, r) => s + parseFloat(r.unit_price) * r.quantity, 0);
    const totalGst = all.reduce((s, r) => s + parseFloat(r.gst_amount), 0);
    await conn.query('UPDATE orders SET subtotal=?, gst_amount=?, total_amount=? WHERE id=?',
      [subtotal, totalGst, subtotal + totalGst, req.params.id]);

    // If no items remain, revert status
    if (all.length === 0) {
      await conn.query("UPDATE orders SET status='open' WHERE id=?", [req.params.id]);
    }

    await conn.commit();
    wsHub.broadcast('sales', { type: 'order_updated', payload: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// ── RE-KOT: send correction/update KOT for modified KOT'd items ──────────────
// POST /orders/:id/reKot  { item_ids: [1,2,3], reason, instructions }
router.post('/:id/reKot', authorize('admin','manager','staff'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { item_ids, reason, instructions } = req.body;
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.status === 'paid' || order.status === 'cancelled')
      return res.status(400).json({ success: false, message: 'Cannot re-KOT closed order.' });

    let items;
    if (item_ids && item_ids.length > 0) {
      [items] = await conn.query('SELECT * FROM order_items WHERE order_id=? AND id IN (?)', [req.params.id, item_ids]);
    } else {
      [items] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    }
    if (!items.length) return res.status(400).json({ success: false, message: 'No items for re-KOT.' });

    const kot_number = 'RKOT-' + Date.now().toString().slice(-6);
    const fullInstructions = [reason ? `[UPDATE] ${reason}` : '[UPDATE]', instructions].filter(Boolean).join(' | ');
    const [kr] = await conn.query(
      'INSERT INTO kot_tickets (order_id,table_id,kot_number,instructions,created_by) VALUES (?,?,?,?,?)',
      [req.params.id, order.table_id, kot_number, fullInstructions, req.user.id]
    );
    for (const item of items) {
      await conn.query('INSERT INTO kot_items (kot_id,order_item_id,item_name,quantity,notes) VALUES (?,?,?,?,?)',
        [kr.insertId, item.id, item.item_name, item.quantity, item.kot_instructions || null]);
    }
    await conn.commit();
    wsHub.broadcast('kot', { type: 'kot_new', payload: { kot_number, order_id: req.params.id, table_id: order.table_id, is_reKot: true } });
    res.json({ success: true, data: { kot_number } });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// CANCEL order
router.post('/:id/cancel', async (req, res) => {
  try {
    await db.query("UPDATE orders SET status='cancelled' WHERE id=?", [req.params.id]);
    wsHub.broadcast('sales', { type:'order_cancelled', payload: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
// ── GET all KOT tickets ──────────────────────────────────
// (inserted before module.exports line - will add as separate route file)

// ── DELETE order (admin/manager only) ────────────────────
router.delete('/:id', authorize('admin','manager'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!order) { await conn.rollback(); return res.status(404).json({ success:false, message:'Order not found' }); }

    // Reverse inventory deductions if order was paid (graceful if table missing)
    if (order.status === 'paid') {
      try {
        const [movements] = await conn.query(
          "SELECT * FROM inventory_movements WHERE reference_type='order' AND reference_id=?", [req.params.id]
        );
        for (const mv of movements) {
          await conn.query(
            'UPDATE inventory_items SET current_quantity = current_quantity + ? WHERE id=?',
            [Math.abs(parseFloat(mv.quantity_change)), mv.inventory_item_id]
          );
        }
        await conn.query("DELETE FROM inventory_movements WHERE reference_type='order' AND reference_id=?", [req.params.id]);
      } catch(invErr) {
        // inventory_movements table may not exist yet — skip silently
        console.warn('inventory reversal skipped:', invErr.message);
      }
    }

    // kot_items cascade-delete from kot_tickets automatically
    await conn.query('DELETE FROM kot_tickets WHERE order_id=?', [req.params.id]);
    await conn.query('DELETE FROM order_items WHERE order_id=?', [req.params.id]);
    await conn.query('DELETE FROM orders WHERE id=?', [req.params.id]);
    await conn.commit();

    wsHub.broadcast('sales',     { type:'order_deleted', payload:{ id: parseInt(req.params.id) } });
    wsHub.broadcast('dashboard', { type:'stats_update' });
    res.json({ success:true });
  } catch(err) {
    await conn.rollback();
    res.status(500).json({ success:false, message:err.message });
  } finally { conn.release(); }
});

// ── PATCH order — edit customer/payment/notes on a paid order ─
router.patch('/:id/edit', authorize('admin','manager'), async (req, res) => {
  try {
    const { customer_name, customer_phone, payment_method, notes, total_amount, discount_amount, discount_type, discount_value, status } = req.body;
    const fields = [];
    const vals   = [];
    if (customer_name   !== undefined) { fields.push('customer_name=?');   vals.push(customer_name||null); }
    if (customer_phone  !== undefined) { fields.push('customer_phone=?');  vals.push(customer_phone||null); }
    if (payment_method  !== undefined) { fields.push('payment_method=?');  vals.push(payment_method||null); }
    if (notes           !== undefined) { fields.push('notes=?');           vals.push(notes||null); }
    if (total_amount    !== undefined) { fields.push('total_amount=?');    vals.push(parseFloat(total_amount)); }
    if (discount_amount !== undefined) { fields.push('discount_amount=?'); vals.push(parseFloat(discount_amount)||0); }
    if (discount_type   !== undefined) { fields.push('discount_type=?');   vals.push(discount_type||null); } // null = no discount type
    if (discount_value  !== undefined) { fields.push('discount_value=?');  vals.push(parseFloat(discount_value)||0); }
    if (status          !== undefined) { fields.push('status=?');          vals.push(status); }
    if (!fields.length) return res.status(400).json({ success:false, message:'Nothing to update' });
    vals.push(req.params.id);
    await db.query(`UPDATE orders SET ${fields.join(',')} WHERE id=?`, vals);
    wsHub.broadcast('dashboard', { type:'stats_update' });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});
