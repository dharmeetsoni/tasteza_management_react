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

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[public/menu] ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
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
