const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ── GET /api/vendors  ─────────────────────────────────────────────────────────
// Returns all vendors with their category list
router.get('/', async (req, res) => {
  try {
    const [vendors] = await db.query(`
      SELECT v.*,
        GROUP_CONCAT(vc.category_id ORDER BY vc.category_id) AS category_ids,
        GROUP_CONCAT(c.name         ORDER BY vc.category_id) AS category_names
      FROM vendors v
      LEFT JOIN vendor_categories vc ON vc.vendor_id = v.id
      LEFT JOIN categories c         ON c.id = vc.category_id
      GROUP BY v.id
      ORDER BY v.name
    `);
    // Parse comma-separated strings back to arrays
    const data = vendors.map(v => ({
      ...v,
      category_ids:   v.category_ids   ? v.category_ids.split(',').map(Number)   : [],
      category_names: v.category_names ? v.category_names.split(',')             : [],
    }));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET /api/vendors/:id  ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [[vendor]] = await db.query('SELECT * FROM vendors WHERE id=?', [req.params.id]);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    const [cats] = await db.query(
      'SELECT vc.category_id, c.name FROM vendor_categories vc JOIN categories c ON c.id=vc.category_id WHERE vc.vendor_id=?',
      [req.params.id]
    );
    res.json({ success: true, data: {
      ...vendor,
      category_ids:   cats.map(c => c.category_id),
      category_names: cats.map(c => c.name),
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── POST /api/vendors  ────────────────────────────────────────────────────────
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, contact_name, phone, email, address, notes, category_ids = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Vendor name is required.' });

    const [result] = await conn.query(
      'INSERT INTO vendors (name, contact_name, phone, email, address, notes) VALUES (?,?,?,?,?,?)',
      [name.trim(), contact_name||null, phone||null, email||null, address||null, notes||null]
    );
    const vendorId = result.insertId;

    if (category_ids.length) {
      await conn.query(
        'INSERT INTO vendor_categories (vendor_id, category_id) VALUES ?',
        [category_ids.map(cid => [vendorId, cid])]
      );
    }
    await conn.commit();
    res.status(201).json({ success: true, message: 'Vendor created.', data: { id: vendorId } });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Vendor name already exists.' });
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── PUT /api/vendors/:id  ─────────────────────────────────────────────────────
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, contact_name, phone, email, address, notes, is_active, category_ids = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Vendor name is required.' });

    await conn.query(
      'UPDATE vendors SET name=?, contact_name=?, phone=?, email=?, address=?, notes=?, is_active=? WHERE id=?',
      [name.trim(), contact_name||null, phone||null, email||null, address||null, notes||null, is_active ?? 1, req.params.id]
    );
    // Replace category mappings
    await conn.query('DELETE FROM vendor_categories WHERE vendor_id=?', [req.params.id]);
    if (category_ids.length) {
      await conn.query(
        'INSERT INTO vendor_categories (vendor_id, category_id) VALUES ?',
        [category_ids.map(cid => [req.params.id, cid])]
      );
    }
    await conn.commit();
    res.json({ success: true, message: 'Vendor updated.' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Vendor name already exists.' });
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── DELETE /api/vendors/:id  ──────────────────────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM vendors WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    res.json({ success: true, message: 'Vendor deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
