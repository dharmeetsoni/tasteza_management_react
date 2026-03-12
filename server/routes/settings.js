const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
router.use(authenticate);

// GET settings
router.get('/', async (req, res) => {
  try {
    const [[s]] = await db.query('SELECT * FROM restaurant_settings WHERE id=1');
    res.json({ success: true, data: s || {} });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// SAVE settings (admin/manager only)
router.put('/', authorize('admin','manager'), async (req, res) => {
  try {
    const {
      restaurant_name, tagline, address, phone, email, website,
      gst_number, fssai_number, currency_symbol,
      logo_base64, logo_width, bill_footer,
      show_logo, show_gst_break, show_qr, show_thank_you, bill_copies, primary_color
    } = req.body;
    await db.query(`
      INSERT INTO restaurant_settings (id,restaurant_name,tagline,address,phone,email,website,
        gst_number,fssai_number,currency_symbol,logo_base64,logo_width,bill_footer,
        show_logo,show_gst_break,show_qr,show_thank_you,bill_copies,primary_color)
      VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        restaurant_name=VALUES(restaurant_name), tagline=VALUES(tagline),
        address=VALUES(address), phone=VALUES(phone), email=VALUES(email),
        website=VALUES(website), gst_number=VALUES(gst_number),
        fssai_number=VALUES(fssai_number), currency_symbol=VALUES(currency_symbol),
        logo_base64=VALUES(logo_base64), logo_width=VALUES(logo_width),
        bill_footer=VALUES(bill_footer), show_logo=VALUES(show_logo),
        show_gst_break=VALUES(show_gst_break), show_qr=VALUES(show_qr),
        show_thank_you=VALUES(show_thank_you), bill_copies=VALUES(bill_copies),
        primary_color=VALUES(primary_color)`,
      [restaurant_name||'Tasteza Restaurant', tagline||'', address||'', phone||'',
       email||'', website||'', gst_number||'', fssai_number||'', currency_symbol||'₹',
       logo_base64||null, logo_width||120, bill_footer||'',
       show_logo?1:0, show_gst_break?1:0, show_qr?1:0, show_thank_you?1:0,
       bill_copies||1, primary_color||'#e84a5f']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
