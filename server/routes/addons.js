const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ── GET /api/addons ───────────────────────────────────────
// All addon groups with their items
router.get('/', async (req, res) => {
  try {
    const [groups] = await db.query('SELECT * FROM addon_groups ORDER BY id DESC');
    const [items] = await db.query('SELECT * FROM addon_items ORDER BY group_id, sort_order, id');
    const result = groups.map(g => ({
      ...g,
      items: items.filter(i => i.group_id === g.id),
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/addons ──────────────────────────────────────
// Create addon group
router.post('/', async (req, res) => {
  const { name, is_required, min_select, max_select } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  try {
    const [r] = await db.query(
      'INSERT INTO addon_groups (name, is_required, min_select, max_select) VALUES (?, ?, ?, ?)',
      [name, is_required ? 1 : 0, min_select || 0, max_select || 1]
    );
    res.json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/addons/:id ───────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, is_required, min_select, max_select, is_active } = req.body;
  try {
    await db.query(
      'UPDATE addon_groups SET name=?, is_required=?, min_select=?, max_select=?, is_active=? WHERE id=?',
      [name, is_required ? 1 : 0, min_select || 0, max_select || 1, is_active !== false ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/addons/:id ────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM addon_groups WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/addons/:id/items ────────────────────────────
router.post('/:id/items', async (req, res) => {
  const { name, price, sort_order } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  try {
    const [r] = await db.query(
      'INSERT INTO addon_items (group_id, name, price, sort_order) VALUES (?, ?, ?, ?)',
      [req.params.id, name, price || 0, sort_order || 0]
    );
    res.json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/addons/items/:itemId ─────────────────────────
router.put('/items/:itemId', async (req, res) => {
  const { name, price, is_active, sort_order } = req.body;
  try {
    await db.query(
      'UPDATE addon_items SET name=?, price=?, is_active=?, sort_order=? WHERE id=?',
      [name, price || 0, is_active !== false ? 1 : 0, sort_order || 0, req.params.itemId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/addons/items/:itemId ─────────────────────
router.delete('/items/:itemId', async (req, res) => {
  try {
    await db.query('DELETE FROM addon_items WHERE id = ?', [req.params.itemId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/addons/menuitem/:menuItemId ──────────────────
// Get addon groups linked to a menu item
router.get('/menuitem/:menuItemId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ag.*, GROUP_CONCAT(ai.id) AS item_ids
       FROM menu_item_addon_groups miag
       JOIN addon_groups ag ON ag.id = miag.addon_group_id
       LEFT JOIN addon_items ai ON ai.group_id = ag.id AND ai.is_active = 1
       WHERE miag.menu_item_id = ? AND ag.is_active = 1
       GROUP BY ag.id`,
      [req.params.menuItemId]
    );
    // Fetch full items for each group
    const groupIds = rows.map(r => r.id);
    let items = [];
    if (groupIds.length) {
      [items] = await db.query(
        `SELECT * FROM addon_items WHERE group_id IN (?) AND is_active = 1 ORDER BY group_id, sort_order`,
        [groupIds]
      );
    }
    const result = rows.map(g => ({
      ...g,
      items: items.filter(i => i.group_id === g.id),
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/addons/menuitem/:menuItemId/link ────────────
// Link addon groups to a menu item (replace all existing links)
router.post('/menuitem/:menuItemId/link', async (req, res) => {
  const { group_ids } = req.body; // array of addon_group ids
  const menuItemId = req.params.menuItemId;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM menu_item_addon_groups WHERE menu_item_id = ?', [menuItemId]);
    if (group_ids && group_ids.length) {
      for (const gid of group_ids) {
        await conn.query(
          'INSERT IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)',
          [menuItemId, gid]
        );
      }
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ── GET /api/addons/all-links ─────────────────────────────
// Returns { menu_item_id: [group_id, ...] } map
router.get('/all-links', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT menu_item_id, addon_group_id FROM menu_item_addon_groups');
    const map = {};
    rows.forEach(r => {
      if (!map[r.menu_item_id]) map[r.menu_item_id] = [];
      map[r.menu_item_id].push(r.addon_group_id);
    });
    res.json({ success: true, data: map });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
