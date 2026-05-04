const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Helper: get all column names for a table
async function getColumns(table) {
  try {
    const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
    return rows.map((r) => r.Field);
  } catch {
    return null; // table doesn't exist
  }
}

// GET /api/public/menu  — no auth required
router.get('/menu', async (req, res) => {
  try {
    // ── Introspect menu_items ──────────────────────────────
    const miCols = await getColumns('menu_items');
    if (!miCols) {
      return res.status(500).json({ success: false, message: 'Table menu_items not found. Run migrations.' });
    }

    // Resolve column aliases (handle different naming conventions)
    const col = (candidates) => candidates.find((c) => miCols.includes(c)) || null;

    const priceCol = col(['selling_price', 'price', 'sale_price', 'unit_price']);
    const priceGstCol = col(['price_with_gst', 'price_incl_gst']);
    const gstCol = col(['gst_percent', 'gst_rate', 'tax_percent', 'tax_rate']);
    const isVegCol = col(['is_veg', 'veg', 'is_vegetarian']);
    const spiceCol = col(['spice_level', 'spice']);
    const imageCol = col(['image_url', 'image', 'img', 'photo', 'thumbnail']);
    const activeCol = col(['is_active', 'active', 'status', 'available', 'is_available']);
    const courseIdCol = col(['course_id', 'category_id', 'menu_course_id']);
    const parcelCol = col(['is_parcel_available', 'parcel_available']);
    const descCol = col(['description', 'desc', 'details']);

    if (!priceCol) {
      return res.status(500).json({
        success: false,
        message: `No price column found in menu_items. Available: ${miCols.join(', ')}`,
      });
    }

    // ── Introspect courses table ───────────────────────────
    let coursesTable = null;
    for (const t of ['menu_courses', 'courses', 'menu_categories', 'categories']) {
      const cols = await getColumns(t);
      if (cols) { coursesTable = { name: t, cols }; break; }
    }

    // ── Build SELECT ───────────────────────────────────────
    const selects = [
      'mi.id',
      'mi.name',
      descCol ? `mi.\`${descCol}\` AS description` : 'NULL AS description',
      `mi.\`${priceCol}\` AS price`,
      priceGstCol ? `mi.\`${priceGstCol}\` AS price_with_gst` : 'NULL AS price_with_gst',
      gstCol ? `mi.\`${gstCol}\` AS gst_percent` : '0 AS gst_percent',
      isVegCol ? `mi.\`${isVegCol}\` AS is_veg` : 'NULL AS is_veg',
      spiceCol ? `mi.\`${spiceCol}\` AS spice_level` : '0 AS spice_level',
      imageCol ? `mi.\`${imageCol}\` AS image` : 'NULL AS image',
      parcelCol ? `mi.\`${parcelCol}\` AS is_parcel_available` : 'NULL AS is_parcel_available',
    ];

    let joinClause = '';
    if (coursesTable) {
      const cc = coursesTable.cols;
      const cName = cc.find((c) => ['name', 'course_name', 'category_name', 'title'].includes(c)) || 'name';
      const cIcon = cc.find((c) => ['icon', 'emoji', 'course_icon'].includes(c));
      const cColor = cc.find((c) => ['color', 'colour', 'bg_color'].includes(c));
      const cSort = cc.find((c) => ['sort_order', 'sort', 'order', 'display_order'].includes(c));
      const cId = cc.find((c) => ['id'].includes(c));

      selects.push(
        `mc.\`${cName}\` AS category`,
        cIcon ? `mc.\`${cIcon}\` AS course_icon` : 'NULL AS course_icon',
        cColor ? `mc.\`${cColor}\` AS course_color` : 'NULL AS course_color',
        cSort ? `mc.\`${cSort}\` AS course_sort` : '0 AS course_sort',
      );

      if (courseIdCol && cId) {
        joinClause = `LEFT JOIN \`${coursesTable.name}\` mc ON mi.\`${courseIdCol}\` = mc.\`${cId}\``;
      }
    } else {
      selects.push('NULL AS category', 'NULL AS course_icon', 'NULL AS course_color', '0 AS course_sort');
    }

    // ── Active filter ──────────────────────────────────────
    let whereClause = '';
    if (activeCol) {
      whereClause = `WHERE mi.\`${activeCol}\` = 1`;
    }

    const sql = `
      SELECT ${selects.join(',\n      ')}
      FROM menu_items mi
      ${joinClause}
      ${whereClause}
      ORDER BY course_sort ASC, category ASC, mi.name ASC
    `;

    console.log('[public/menu] Running query:\n', sql);

    const [rows] = await db.query(sql);
    console.log(`[public/menu] Returned ${rows.length} items`);

    // Attach addon_group_ids to each item
    try {
      const [addonLinks] = await db.query(
        'SELECT menu_item_id, addon_group_id FROM menu_item_addon_groups'
      );
      const addonMap = {};
      addonLinks.forEach(l => {
        if (!addonMap[l.menu_item_id]) addonMap[l.menu_item_id] = [];
        addonMap[l.menu_item_id].push(l.addon_group_id);
      });
      rows.forEach(row => { row.addon_group_ids = addonMap[row.id] || []; });
    } catch { /* addon_groups table may not exist yet */ }

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[public/menu] ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});

// GET /api/public/addon-groups — returns all active addon groups with items (no auth)
router.get('/addon-groups', async (req, res) => {
  try {
    const [groups] = await db.query('SELECT * FROM addon_groups WHERE is_active = 1');
    const [items] = await db.query('SELECT * FROM addon_items WHERE is_active = 1 ORDER BY group_id, sort_order');
    const result = groups.map(g => ({ ...g, items: items.filter(i => i.group_id === g.id) }));
    res.json({ success: true, data: result });
  } catch {
    res.json({ success: true, data: [] }); // graceful if table not yet created
  }
});

// POST /api/public/coupon/validate — no auth, for customers at checkout
router.post('/coupon/validate', async (req, res) => {
  try {
    const { code, order_amount } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Coupon code required.' });
    const [[c]] = await db.query("SELECT * FROM coupons WHERE code=? AND is_active=1", [code.toUpperCase()]);
    if (!c) return res.status(404).json({ success: false, message: 'Invalid coupon code.' });
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (c.valid_from && today < c.valid_from) return res.status(400).json({ success: false, message: 'Coupon not yet active.' });
    if (c.valid_until && today > c.valid_until) return res.status(400).json({ success: false, message: 'Coupon has expired.' });
    if (c.usage_limit && c.used_count >= c.usage_limit) return res.status(400).json({ success: false, message: 'Coupon usage limit reached.' });
    if (c.min_order_amount && parseFloat(order_amount) < parseFloat(c.min_order_amount))
      return res.status(400).json({ success: false, message: `Minimum order \u20b9${c.min_order_amount} required.` });
    let discount = c.discount_type === 'percentage'
      ? (parseFloat(order_amount) * parseFloat(c.discount_value) / 100)
      : parseFloat(c.discount_value);
    if (c.max_discount) discount = Math.min(discount, parseFloat(c.max_discount));
    res.json({ success: true, data: { code: c.code, discount_type: c.discount_type, discount_value: c.discount_value, calculated_discount: discount.toFixed(2), description: c.description } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Debug endpoint — shows real table/column info without auth
router.get('/menu/debug', async (req, res) => {
  try {
    const [tables] = await db.query(`SHOW TABLES`);
    const tableNames = tables.map((t) => Object.values(t)[0]);

    const info = {};
    for (const t of tableNames) {
      const [cols] = await db.query(`SHOW COLUMNS FROM \`${t}\``);
      info[t] = cols.map((c) => c.Field);
    }
    res.json({ tables: tableNames, columns: info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
