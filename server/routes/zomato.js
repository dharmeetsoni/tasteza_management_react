const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

// ── GET settings ──────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const [[s]] = await db.query('SELECT * FROM zomato_settings WHERE id=1');
    res.json({ success: true, data: s || { commission_pct: 22, active_discount: 0, restaurant_name: 'My Restaurant' } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/settings', authorize('admin'), async (req, res) => {
  try {
    const { commission_pct, active_discount, restaurant_name } = req.body;
    await db.query(
      `INSERT INTO zomato_settings (id, commission_pct, active_discount, restaurant_name)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE commission_pct=VALUES(commission_pct),
         active_discount=VALUES(active_discount), restaurant_name=VALUES(restaurant_name)`,
      [parseFloat(commission_pct)||22, parseFloat(active_discount)||0, restaurant_name||'My Restaurant']
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET full zomato menu (joined with menu_items) ─────────
router.get('/menu', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        zm.*,
        mi.name            AS item_name,
        mi.selling_price   AS base_price,
        mi.price_with_gst,
        mi.cost_price,
        mi.gst_percent,
        mi.is_veg,
        mi.description     AS item_description,
        mi.image_url,
        mi.is_active       AS item_is_active,
        mc.name            AS course_name,
        mc.icon            AS course_icon,
        mc.color           AS course_color,
        mc.id              AS course_id
      FROM zomato_menu zm
      JOIN menu_items mi ON zm.menu_item_id = mi.id
      LEFT JOIN menu_courses mc ON mi.course_id = mc.id
      ORDER BY mc.sort_order ASC, zm.sort_order ASC, mi.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET all menu_items NOT yet on zomato menu ─────────────
router.get('/available-items', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT mi.*, mc.name AS course_name, mc.icon AS course_icon, mc.color AS course_color
      FROM menu_items mi
      LEFT JOIN menu_courses mc ON mi.course_id = mc.id
      LEFT JOIN zomato_menu zm ON zm.menu_item_id = mi.id
      WHERE mi.is_active = 1 AND zm.id IS NULL
      ORDER BY mc.sort_order ASC, mi.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── ADD item to zomato menu ───────────────────────────────
router.post('/menu', authorize('admin'), async (req, res) => {
  try {
    const { menu_item_id, listed_price, target_margin, zomato_item_name, zomato_description, is_featured } = req.body;
    if (!menu_item_id || !listed_price)
      return res.status(400).json({ success: false, message: 'menu_item_id and listed_price required.' });
    const [r] = await db.query(
      `INSERT INTO zomato_menu (menu_item_id, listed_price, target_margin, zomato_item_name, zomato_description, is_featured)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [parseInt(menu_item_id), parseFloat(listed_price), parseFloat(target_margin)||30,
       zomato_item_name||null, zomato_description||null, is_featured?1:0]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Item already on Zomato menu.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── BULK add items ────────────────────────────────────────
router.post('/menu/bulk', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items } = req.body; // [{menu_item_id, listed_price, target_margin}]
    for (const item of items) {
      await conn.query(
        `INSERT IGNORE INTO zomato_menu (menu_item_id, listed_price, target_margin)
         VALUES (?, ?, ?)`,
        [parseInt(item.menu_item_id), parseFloat(item.listed_price), parseFloat(item.target_margin)||30]
      );
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
  finally { conn.release(); }
});

// ── UPDATE zomato menu item ───────────────────────────────
router.put('/menu/:id', authorize('admin'), async (req, res) => {
  try {
    const { listed_price, target_margin, zomato_item_name, zomato_description, is_available, is_featured, sort_order } = req.body;
    await db.query(
      `UPDATE zomato_menu SET listed_price=?, target_margin=?, zomato_item_name=?,
       zomato_description=?, is_available=?, is_featured=?, sort_order=? WHERE id=?`,
      [parseFloat(listed_price), parseFloat(target_margin)||30, zomato_item_name||null,
       zomato_description||null, is_available?1:0, is_featured?1:0, parseInt(sort_order)||0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── REMOVE item from zomato menu ─────────────────────────
router.delete('/menu/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM zomato_menu WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
