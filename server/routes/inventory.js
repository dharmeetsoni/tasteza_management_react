const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { recalcRecipesUsingItem } = require('./recipes');

router.use(authenticate);

// ── GET all inventory items (with category + unit info) ──
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        i.*,
        c.name        AS category_name,
        c.image_url   AS category_image,
        u.name        AS unit_name,
        u.abbreviation AS unit_abbr
      FROM inventory_items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units      u ON i.unit_id      = u.id
      ORDER BY c.name, i.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET single item ──
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.*, c.name AS category_name, u.name AS unit_name, u.abbreviation AS unit_abbr
      FROM inventory_items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units      u ON i.unit_id      = u.id
      WHERE i.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE item ──
router.post('/', async (req, res) => {
  try {
    const { name, category_id, unit_id, current_quantity, min_quantity,
            purchase_price, selling_price, supplier, notes } = req.body;
    if (!name || !category_id || !unit_id)
      return res.status(400).json({ success: false, message: 'Name, category and unit are required.' });
    const [result] = await db.query(
      `INSERT INTO inventory_items
         (name, category_id, unit_id, current_quantity, min_quantity,
          purchase_price, selling_price, supplier, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), category_id, unit_id,
       current_quantity ?? 0, min_quantity ?? null,
       purchase_price ?? null, selling_price ?? null,
       supplier ?? null, notes ?? null]
    );
    res.status(201).json({ success: true, message: 'Item created.', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Item name already exists in this category.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── UPDATE item ──
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { name, category_id, unit_id, current_quantity, min_quantity,
            purchase_price, selling_price, supplier, notes } = req.body;
    if (!name || !category_id || !unit_id)
      return res.status(400).json({ success: false, message: 'Name, category and unit are required.' });
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE inventory_items
       SET name=?, category_id=?, unit_id=?, current_quantity=?, min_quantity=?,
           purchase_price=?, selling_price=?, supplier=?, notes=?
       WHERE id=?`,
      [name.trim(), category_id, unit_id,
       current_quantity ?? 0, min_quantity ?? null,
       purchase_price ?? null, selling_price ?? null,
       supplier ?? null, notes ?? null, req.params.id]
    );
    if (!result.affectedRows) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }
    // Recalculate all recipes that use this inventory item, then cascade upward
    await recalcRecipesUsingItem(conn, parseInt(req.params.id));
    await conn.commit();
    res.json({ success: true, message: 'Item updated.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── DELETE item ──
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM inventory_items WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, message: 'Item deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ADJUST STOCK ──
router.post('/:id/adjust', async (req, res) => {
  try {
    const { adjustment_type, quantity, reason } = req.body;
    if (!adjustment_type || !quantity || quantity <= 0)
      return res.status(400).json({ success: false, message: 'Adjustment type and quantity are required.' });

    const [items] = await db.query('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
    if (!items.length) return res.status(404).json({ success: false, message: 'Item not found.' });

    const currentQty = parseFloat(items[0].current_quantity) || 0;
    const adjQty     = parseFloat(quantity);
    let newQty;

    if (adjustment_type === 'add') {
      newQty = currentQty + adjQty;
    } else {
      newQty = Math.max(0, currentQty - adjQty);
    }

    await db.query('UPDATE inventory_items SET current_quantity = ? WHERE id = ?', [newQty, req.params.id]);
    await db.query(
      'INSERT INTO stock_adjustments (inventory_item_id, adjustment_type, quantity, reason, adjusted_by) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, adjustment_type, adjQty, reason || null, req.user.id]
    );
    res.json({ success: true, message: 'Stock adjusted.', data: { new_quantity: newQty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET purchase history for one item ──
router.get('/:id/purchases', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, u.name AS purchased_by_name
       FROM inventory_purchases p
       LEFT JOIN users u ON p.purchased_by = u.id
       WHERE p.inventory_item_id = ?
       ORDER BY p.purchase_date DESC, p.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET ALL purchases (purchase history page) ──
router.get('/purchases/all', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, i.name AS item_name, i.category_id, i.unit_id,
              c.name AS category_name, c.image_url AS category_image,
              u2.name AS unit_name, u2.abbreviation AS unit_abbr
       FROM inventory_purchases p
       LEFT JOIN inventory_items i  ON p.inventory_item_id = i.id
       LEFT JOIN categories      c  ON i.category_id       = c.id
       LEFT JOIN units           u2 ON i.unit_id            = u2.id
       ORDER BY p.purchase_date DESC, p.created_at DESC
       LIMIT 500`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE purchase (also adds to stock) ──
router.post('/purchases', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { inventory_item_id, quantity, price_per_unit, total_amount,
            purchase_date, supplier, invoice_no, notes } = req.body;

    if (!inventory_item_id || !quantity || !price_per_unit || !purchase_date)
      return res.status(400).json({ success: false, message: 'Item, quantity, price and date are required.' });

    // Insert purchase record
    await conn.query(
      `INSERT INTO inventory_purchases
         (inventory_item_id, quantity, price_per_unit, total_amount,
          purchase_date, supplier, invoice_no, notes, purchased_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [inventory_item_id, parseFloat(quantity), parseFloat(price_per_unit),
       parseFloat(total_amount) || parseFloat(quantity) * parseFloat(price_per_unit),
       purchase_date, supplier || null, invoice_no || null, notes || null, req.user.id]
    );

    // Update stock quantity and price
    await conn.query(
      'UPDATE inventory_items SET current_quantity = current_quantity + ?, purchase_price = ? WHERE id = ?',
      [parseFloat(quantity), parseFloat(price_per_unit), inventory_item_id]
    );

    // Recalculate all recipes using this item with new price
    await recalcRecipesUsingItem(conn, parseInt(inventory_item_id));

    await conn.commit();
    res.status(201).json({ success: true, message: 'Purchase recorded and stock updated.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
