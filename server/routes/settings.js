const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// ── GET /api/settings/public — NO auth, returns safe public config ────────
router.get('/public', async (req, res) => {
  try {
    const [[s]] = await db.query('SELECT * FROM restaurant_settings WHERE id=1');
    if (!s) return res.json({ success: true, data: {} });
    res.json({
      success: true,
      data: {
        restaurant_name: s.restaurant_name,
        tagline: s.tagline,
        logo_base64: s.logo_base64,
        primary_color: s.primary_color,
        currency_symbol: s.currency_symbol,
        delivery_charge: s.delivery_charge,
        delivery_free_above: s.delivery_free_above,
        online_ordering_enabled: s.online_ordering_enabled,
        google_maps_key: s.google_maps_key,
        // Firebase public (web) config — safe to expose
        firebase_api_key: s.firebase_api_key,
        firebase_auth_domain: s.firebase_auth_domain,
        firebase_project_id: s.firebase_project_id,
        firebase_app_id: s.firebase_app_id,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.use(authenticate);

// GET settings
router.get('/', async (req, res) => {
  try {
    const [[s]] = await db.query('SELECT * FROM restaurant_settings WHERE id=1');
    res.json({ success: true, data: s || {} });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// SAVE settings (admin/manager only)
router.put('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const {
      restaurant_name, tagline, address, phone, email, website,
      gst_number, fssai_number, currency_symbol,
      logo_base64, logo_width, bill_footer,
      show_logo, show_gst_break, show_qr, show_thank_you, bill_copies, primary_color,
      // Integration settings
      firebase_api_key, firebase_auth_domain, firebase_project_id, firebase_app_id,
      phonepay_merchant_id, phonepay_salt_key, phonepay_salt_index, phonepay_env,
      phonepay_client_id, phonepay_client_secret, phonepay_client_version,
      google_maps_key,
      delivery_charge, delivery_free_above, auto_accept_seconds, online_ordering_enabled,
    } = req.body;
    await db.query(`
      INSERT INTO restaurant_settings (id,restaurant_name,tagline,address,phone,email,website,
        gst_number,fssai_number,currency_symbol,logo_base64,logo_width,bill_footer,
        show_logo,show_gst_break,show_qr,show_thank_you,bill_copies,primary_color,
        firebase_api_key,firebase_auth_domain,firebase_project_id,firebase_app_id,
        phonepay_merchant_id,phonepay_salt_key,phonepay_salt_index,phonepay_env,
        phonepay_client_id,phonepay_client_secret,phonepay_client_version,
        google_maps_key,delivery_charge,delivery_free_above,auto_accept_seconds,online_ordering_enabled)
      VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        restaurant_name=VALUES(restaurant_name), tagline=VALUES(tagline),
        address=VALUES(address), phone=VALUES(phone), email=VALUES(email),
        website=VALUES(website), gst_number=VALUES(gst_number),
        fssai_number=VALUES(fssai_number), currency_symbol=VALUES(currency_symbol),
        logo_base64=VALUES(logo_base64), logo_width=VALUES(logo_width),
        bill_footer=VALUES(bill_footer), show_logo=VALUES(show_logo),
        show_gst_break=VALUES(show_gst_break), show_qr=VALUES(show_qr),
        show_thank_you=VALUES(show_thank_you), bill_copies=VALUES(bill_copies),
        primary_color=VALUES(primary_color),
        firebase_api_key=VALUES(firebase_api_key), firebase_auth_domain=VALUES(firebase_auth_domain),
        firebase_project_id=VALUES(firebase_project_id), firebase_app_id=VALUES(firebase_app_id),
        phonepay_merchant_id=VALUES(phonepay_merchant_id), phonepay_salt_key=VALUES(phonepay_salt_key),
        phonepay_salt_index=VALUES(phonepay_salt_index), phonepay_env=VALUES(phonepay_env),
        phonepay_client_id=VALUES(phonepay_client_id), phonepay_client_secret=VALUES(phonepay_client_secret),
        phonepay_client_version=VALUES(phonepay_client_version),
        google_maps_key=VALUES(google_maps_key),
        delivery_charge=VALUES(delivery_charge), delivery_free_above=VALUES(delivery_free_above),
        auto_accept_seconds=VALUES(auto_accept_seconds), online_ordering_enabled=VALUES(online_ordering_enabled)`,
      [
        restaurant_name || 'Tasteza Restaurant', tagline || '', address || '', phone || '',
        email || '', website || '', gst_number || '', fssai_number || '', currency_symbol || '₹',
        logo_base64 || null, logo_width || 120, bill_footer || '',
        show_logo ? 1 : 0, show_gst_break ? 1 : 0, show_qr ? 1 : 0, show_thank_you ? 1 : 0,
        bill_copies || 1, primary_color || '#e84a5f',
        firebase_api_key || null, firebase_auth_domain || null, firebase_project_id || null, firebase_app_id || null,
        phonepay_merchant_id || null, phonepay_salt_key || null, phonepay_salt_index || '1', phonepay_env || 'sandbox',
        phonepay_client_id || null, phonepay_client_secret || null, phonepay_client_version || '1',
        google_maps_key || null,
        delivery_charge || 30, delivery_free_above || 199, auto_accept_seconds || 0,
        online_ordering_enabled !== false ? 1 : 0,
      ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
