const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const wsHub   = require('../websocket');
router.use(authenticate);

const VALID_STATUSES = ['pending','preparing','ready','served','cancelled'];

// GET all KOTs
router.get('/', async (req, res) => {
  try {
    const { status, date } = req.query;
    let where = '';
    const params = [];
    if (status && status !== 'all') { where += ' AND k.status=?'; params.push(status); }
    if (date)                       { where += " AND DATE_FORMAT(k.created_at,'%Y-%m-%d')=?"; params.push(date); }

    const [kots] = await db.query(`
      SELECT k.*,
        o.order_number, o.order_type,
        t.table_number, t.table_name,
        u.name AS created_by_name
      FROM kot_tickets k
      LEFT JOIN orders  o ON k.order_id  = o.id
      LEFT JOIN restaurant_tables t ON k.table_id = t.id
      LEFT JOIN users   u ON k.created_by = u.id
      WHERE 1=1 ${where}
      ORDER BY k.created_at DESC LIMIT 300`, params);

    // Attach items inline so KDS doesn't need N+1 requests
    if (kots.length) {
      const kotIds = kots.map(k => k.id);
      const [allItems] = await db.query(
        `SELECT ki.*, oi.unit_price, oi.kot_instructions FROM kot_items ki LEFT JOIN order_items oi ON ki.order_item_id=oi.id WHERE ki.kot_id IN (?) ORDER BY ki.id ASC`,
        [kotIds]
      );
      const itemMap = {};
      allItems.forEach(it => { if (!itemMap[it.kot_id]) itemMap[it.kot_id] = []; itemMap[it.kot_id].push(it); });
      kots.forEach(k => { k.items = itemMap[k.id] || []; });
    }
    res.json({ success: true, data: kots });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET single KOT with items
router.get('/:id', async (req, res) => {
  try {
    const [[kot]] = await db.query(`
      SELECT k.*, o.order_number, o.order_type,
        t.table_number, t.table_name, u.name AS created_by_name
      FROM kot_tickets k
      LEFT JOIN orders o ON k.order_id=o.id
      LEFT JOIN restaurant_tables t ON k.table_id=t.id
      LEFT JOIN users u ON k.created_by=u.id
      WHERE k.id=?`, [req.params.id]);
    if (!kot) return res.status(404).json({ success:false, message:'KOT not found.' });

    const [items] = await db.query(`
      SELECT ki.*, oi.unit_price, oi.gst_percent, oi.kot_instructions
      FROM kot_items ki
      LEFT JOIN order_items oi ON ki.order_item_id = oi.id
      WHERE ki.kot_id=?`, [req.params.id]);

    res.json({ success: true, data: { ...kot, items } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// UPDATE KOT status — fixed & broadcast to all rooms
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ success:false, message:`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });

    const [[existing]] = await db.query('SELECT * FROM kot_tickets WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ success:false, message:'KOT not found' });

    await db.query('UPDATE kot_tickets SET status=? WHERE id=?', [status, req.params.id]);

    const payload = {
      id:       parseInt(req.params.id),
      status,
      kot_number:   existing.kot_number,
      table_id:     existing.table_id,
      order_id:     existing.order_id,
    };

    // Broadcast to all relevant rooms for live refresh
    wsHub.broadcast('kot',       { type:'kot_status', payload });
    wsHub.broadcast('sales',     { type:'kot_status', payload });
    wsHub.broadcast('kds',       { type:'kot_status', payload });
    wsHub.broadcast('dashboard', { type:'stats_update' });

    res.json({ success: true, data: payload });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// UPDATE individual KOT item status
router.patch('/:id/items/:itemId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });

    const [[item]] = await db.query(
      'SELECT ki.*, kt.order_id, kt.kot_number FROM kot_items ki JOIN kot_tickets kt ON ki.kot_id=kt.id WHERE ki.id=? AND ki.kot_id=?',
      [req.params.itemId, req.params.id]
    );
    if (!item) return res.status(404).json({ success: false, message: 'KOT item not found' });

    await db.query('UPDATE kot_items SET status=? WHERE id=?', [status, req.params.itemId]);

    // Auto-advance KOT ticket status based on all item statuses
    const [allItems] = await db.query('SELECT status FROM kot_items WHERE kot_id=?', [req.params.id]);
    const statuses = allItems.map(i => i.status);
    let kotStatus = null;
    if (statuses.every(s => s === 'served'))       kotStatus = 'served';
    else if (statuses.every(s => s === 'ready' || s === 'served')) kotStatus = 'ready';
    else if (statuses.some(s => s === 'preparing' || s === 'ready')) kotStatus = 'preparing';

    if (kotStatus) {
      await db.query('UPDATE kot_tickets SET status=? WHERE id=?', [kotStatus, req.params.id]);
    }

    const payload = {
      kot_id:   parseInt(req.params.id),
      item_id:  parseInt(req.params.itemId),
      status,
      kot_status: kotStatus,
      kot_number: item.kot_number,
    };

    wsHub.broadcast('kot',   { type: 'kot_item_status', payload });
    wsHub.broadcast('sales', { type: 'kot_item_status', payload });
    wsHub.broadcast('kds',   { type: 'kot_item_status', payload });

    res.json({ success: true, data: payload });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE KOT (admin/manager only)
router.delete('/:id', authorize('admin','manager'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[kot]] = await conn.query('SELECT * FROM kot_tickets WHERE id=?', [req.params.id]);
    if (!kot) { await conn.rollback(); return res.status(404).json({ success:false, message:'KOT not found' }); }

    // Reset order_items kot_sent=0 for items in this KOT so they can be re-KOT'd
    await conn.query(
      'UPDATE order_items SET kot_sent=0 WHERE id IN (SELECT order_item_id FROM kot_items WHERE kot_id=?)',
      [req.params.id]
    );
    await conn.query('DELETE FROM kot_items WHERE kot_id=?', [req.params.id]);
    await conn.query('DELETE FROM kot_tickets WHERE id=?', [req.params.id]);

    // If order has no remaining KOTs, reset order status to 'open'
    const [[remaining]] = await conn.query('SELECT COUNT(*) AS cnt FROM kot_tickets WHERE order_id=?', [kot.order_id]);
    if (remaining.cnt === 0) {
      await conn.query("UPDATE orders SET status='open' WHERE id=?", [kot.order_id]);
    }

    await conn.commit();
    wsHub.broadcast('kot',   { type:'kot_deleted', payload:{ id: parseInt(req.params.id), order_id: kot.order_id } });
    wsHub.broadcast('sales', { type:'order_updated', payload:{ id: kot.order_id } });
    res.json({ success:true });
  } catch(err) {
    await conn.rollback();
    res.status(500).json({ success:false, message:err.message });
  } finally { conn.release(); }
});

module.exports = router;
