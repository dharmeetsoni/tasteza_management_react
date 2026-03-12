const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT mi.*, mc.name AS course_name, mc.icon AS course_icon, mc.color AS course_color,
             r.name AS recipe_name, r.cost_per_unit AS recipe_cost_per_unit
      FROM   menu_items mi
      LEFT JOIN menu_courses mc ON mi.course_id = mc.id
      LEFT JOIN recipes      r  ON mi.recipe_id = r.id
      WHERE mi.is_active = 1
      ORDER BY mc.sort_order ASC, mc.name ASC, mi.name ASC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT mi.*,
             mc.name AS course_name, mc.icon AS course_icon, mc.color AS course_color,
             r.name AS recipe_name,
             CASE WHEN mi.recipe_id IS NOT NULL THEN r.cost_per_unit ELSE mi.cost_price END AS cost_price
      FROM menu_items mi
      LEFT JOIN menu_courses mc ON mi.course_id = mc.id
      LEFT JOIN recipes r ON mi.recipe_id = r.id
      ORDER BY mc.sort_order ASC, mc.name ASC, mi.name ASC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mi.*, mc.name AS course_name, r.name AS recipe_name FROM menu_items mi
       LEFT JOIN menu_courses mc ON mi.course_id = mc.id
       LEFT JOIN recipes r ON mi.recipe_id = r.id WHERE mi.id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, course_id, selling_price, cost_price, gst_percent,
            price_includes_gst, is_veg, recipe_id, description,
            discount_applicable, is_parcel_available } = req.body;
    if (!name || !course_id || !selling_price)
      return res.status(400).json({ success: false, message: 'Name, course and selling price are required.' });

    let costPrice = parseFloat(cost_price)||null;
    if (!costPrice && recipe_id) {
      const [rr] = await db.query('SELECT cost_per_unit FROM recipes WHERE id=?', [recipe_id]);
      if (rr.length) costPrice = parseFloat(rr[0].cost_per_unit)||null;
    }

    const gst = parseFloat(gst_percent)||0;
    const enteredPrice = parseFloat(selling_price);
    let basePrice, finalPrice;
    if (price_includes_gst && gst > 0) {
      basePrice  = +(enteredPrice / (1 + gst / 100)).toFixed(4);
      finalPrice = enteredPrice;
    } else {
      basePrice  = enteredPrice;
      finalPrice = +(enteredPrice * (1 + gst / 100)).toFixed(4);
    }

    const [r] = await db.query(
      `INSERT INTO menu_items (name,course_id,selling_price,price_with_gst,cost_price,gst_percent,price_includes_gst,is_veg,recipe_id,description,is_active,discount_applicable,is_parcel_available)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [name.trim(), parseInt(course_id), basePrice, finalPrice, costPrice,
       gst, price_includes_gst?1:0, is_veg?1:0,
       recipe_id?parseInt(recipe_id):null, description||null,
       discount_applicable!==false?1:0, is_parcel_available!==false?1:0]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Item name already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, course_id, selling_price, cost_price, gst_percent,
            price_includes_gst, is_veg, recipe_id, description,
            discount_applicable, is_parcel_available } = req.body;
    if (!name || !course_id || !selling_price)
      return res.status(400).json({ success: false, message: 'Name, course and selling price are required.' });

    let costPrice = parseFloat(cost_price)||null;
    if (!costPrice && recipe_id) {
      const [rr] = await db.query('SELECT cost_per_unit FROM recipes WHERE id=?', [recipe_id]);
      if (rr.length) costPrice = parseFloat(rr[0].cost_per_unit)||null;
    }

    const gst = parseFloat(gst_percent)||0;
    const enteredPrice = parseFloat(selling_price);
    let basePrice, finalPrice;
    if (price_includes_gst && gst > 0) {
      basePrice  = +(enteredPrice / (1 + gst / 100)).toFixed(4);
      finalPrice = enteredPrice;
    } else {
      basePrice  = enteredPrice;
      finalPrice = +(enteredPrice * (1 + gst / 100)).toFixed(4);
    }

    const [r] = await db.query(
      `UPDATE menu_items SET name=?,course_id=?,selling_price=?,price_with_gst=?,cost_price=?,gst_percent=?,price_includes_gst=?,is_veg=?,recipe_id=?,description=?,discount_applicable=?,is_parcel_available=? WHERE id=?`,
      [name.trim(), parseInt(course_id), basePrice, finalPrice, costPrice,
       gst, price_includes_gst?1:0, is_veg?1:0,
       recipe_id?parseInt(recipe_id):null, description||null,
       discount_applicable!==false?1:0, is_parcel_available!==false?1:0, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    await db.query('UPDATE menu_items SET is_active=? WHERE id=?', [req.body.is_active?1:0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM menu_items WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
