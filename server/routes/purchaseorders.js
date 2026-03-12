const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ── GET all POs ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT po.*,
             u.name AS created_by_name,
             r.name AS received_by_name,
             COUNT(poi.id) AS item_count
      FROM purchase_orders po
      LEFT JOIN users u  ON po.created_by  = u.id
      LEFT JOIN users r  ON po.received_by = r.id
      LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
      GROUP BY po.id
      ORDER BY po.created_at DESC
    `);
    res.json({ success: true, data: orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET single PO with items ─────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await db.query(`
      SELECT po.*, u.name AS created_by_name, r.name AS received_by_name
      FROM purchase_orders po
      LEFT JOIN users u ON po.created_by  = u.id
      LEFT JOIN users r ON po.received_by = r.id
      WHERE po.id = ?`, [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const [items] = await db.query(`
      SELECT poi.*,
             i.name AS item_name, i.unit_id,
             c.name AS category_name,
             u.name AS unit_name, u.abbreviation AS unit_abbr
      FROM purchase_order_items poi
      LEFT JOIN inventory_items i ON poi.inventory_item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON poi.unit_id = u.id
      WHERE poi.order_id = ?
      ORDER BY poi.id`, [req.params.id]);

    res.json({ success: true, data: { ...order, items } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── CREATE PO ────────────────────────────────────────────
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { supplier, supplier_phone, supplier_address, expected_date, notes, items } = req.body;
    if (!items || !items.length)
      return res.status(400).json({ success: false, message: 'At least one item required.' });

    const po_number = 'PO-' + Date.now().toString().slice(-8);
    const total_amount = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price || 0)), 0);

    const [result] = await conn.query(
      `INSERT INTO purchase_orders
         (po_number, supplier, supplier_phone, supplier_address, expected_date, notes, total_amount, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [po_number, supplier || null, supplier_phone || null, supplier_address || null,
       expected_date || null, notes || null, total_amount, req.user.id]
    );
    const orderId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO purchase_order_items
           (order_id, inventory_item_id, unit_id, ordered_qty, received_qty, unit_price, total_price, notes)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        [orderId, item.inventory_item_id, item.unit_id,
         parseFloat(item.quantity), parseFloat(item.unit_price || 0),
         parseFloat(item.quantity) * parseFloat(item.unit_price || 0),
         item.notes || null]
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'Purchase order created.', data: { id: orderId, po_number } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── UPDATE PO (edit before receiving) ───────────────────
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { supplier, supplier_phone, supplier_address, expected_date, notes, items } = req.body;

    const [[po]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (!po) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (po.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Only pending orders can be edited.' });

    const total_amount = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price || 0)), 0);

    await conn.query(
      `UPDATE purchase_orders SET supplier=?, supplier_phone=?, supplier_address=?, expected_date=?, notes=?, total_amount=? WHERE id=?`,
      [supplier || null, supplier_phone || null, supplier_address || null,
       expected_date || null, notes || null, total_amount, req.params.id]
    );

    await conn.query('DELETE FROM purchase_order_items WHERE order_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query(
        `INSERT INTO purchase_order_items (order_id, inventory_item_id, unit_id, ordered_qty, received_qty, unit_price, total_price, notes)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        [req.params.id, item.inventory_item_id, item.unit_id,
         parseFloat(item.quantity), parseFloat(item.unit_price || 0),
         parseFloat(item.quantity) * parseFloat(item.unit_price || 0),
         item.notes || null]
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Order updated.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── RECEIVE ORDER (adds to inventory) ───────────────────
router.post('/:id/receive', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items, invoice_no, bill_amount, notes } = req.body;
    // items: [{ item_id (poi id), received_qty }]

    const [[po]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (!po) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (po.status === 'received')
      return res.status(400).json({ success: false, message: 'Order already fully received.' });

    let allReceived = true;
    let totalReceived = 0;

    for (const ri of items) {
      if (!ri.received_qty || parseFloat(ri.received_qty) <= 0) { allReceived = false; continue; }

      const [[poi] = []] = await conn.query(
        'SELECT * FROM purchase_order_items WHERE id = ? AND order_id = ?',
        [ri.item_id, req.params.id]
      );
      if (!poi) continue;

      const receivedQty = parseFloat(ri.received_qty);
      const newReceived = (parseFloat(poi.received_qty) || 0) + receivedQty;
      totalReceived += receivedQty;

      if (newReceived < parseFloat(poi.ordered_qty)) allReceived = false;

      await conn.query(
        'UPDATE purchase_order_items SET received_qty = ? WHERE id = ?',
        [newReceived, poi.id]
      );

      // Add to inventory stock
      await conn.query(
        'UPDATE inventory_items SET current_quantity = current_quantity + ?, purchase_price = ? WHERE id = ?',
        [receivedQty, poi.unit_price, poi.inventory_item_id]
      );

      // Log purchase record
      await conn.query(
        `INSERT INTO inventory_purchases
           (inventory_item_id, quantity, price_per_unit, total_amount, purchase_date,
            supplier, invoice_no, notes, purchased_by)
         VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
        [poi.inventory_item_id, receivedQty, poi.unit_price,
         receivedQty * poi.unit_price, po.supplier || null,
         invoice_no || po.invoice_no || null,
         `PO: ${po.po_number}` + (notes ? ` — ${notes}` : ''),
         req.user.id]
      );
    }

    const newStatus = allReceived ? 'received' : 'partial';
    await conn.query(
      `UPDATE purchase_orders
       SET status=?, received_at=NOW(), received_by=?,
           invoice_no=COALESCE(?,invoice_no),
           bill_amount=COALESCE(?,bill_amount),
           receive_notes=?
       WHERE id=?`,
      [newStatus, req.user.id, invoice_no || null, bill_amount || null, notes || null, req.params.id]
    );

    await conn.commit();
    res.json({ success: true, message: `Order marked as ${newStatus}. Stock updated.`, data: { status: newStatus } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── CANCEL PO ────────────────────────────────────────────
router.patch('/:id/cancel', authorize('admin'), async (req, res) => {
  try {
    const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (!po) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (po.status === 'received')
      return res.status(400).json({ success: false, message: 'Cannot cancel a received order.' });
    await db.query("UPDATE purchase_orders SET status='cancelled' WHERE id=?", [req.params.id]);
    res.json({ success: true, message: 'Order cancelled.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── DELETE PO ─────────────────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const [[po]] = await db.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (!po) return res.status(404).json({ success: false, message: 'Order not found.' });
    await db.query('DELETE FROM purchase_orders WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Order deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
