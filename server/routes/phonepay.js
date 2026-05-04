const express = require('express');
const router = express.Router();
const db = require('../config/db');
const https = require('https');

// ── V2 API: get settings from DB ─────────────────────────
async function getV2Settings() {
  const [[s]] = await db.query('SELECT * FROM restaurant_settings WHERE id = 1');
  return {
    clientId: s?.phonepay_client_id || '',
    clientSecret: s?.phonepay_client_secret || '',
    clientVersion: s?.phonepay_client_version || '1',
    env: s?.phonepay_env || 'sandbox',
  };
}

// ── V2 API: base URLs ─────────────────────────────────────
function v2PayBaseUrl(env) {
  return env === 'production'
    ? 'https://api.phonepe.com/apis/pg'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
}
function v2AuthUrl(env) {
  return env === 'production'
    ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
}

// ── V2 API: OAuth token cache (in-memory) ─────────────────
let _tokenCache = { token: null, expiresAt: 0 };

async function getOAuthToken(s) {
  const now = Math.floor(Date.now() / 1000);
  // Refresh if expired or within 60s of expiry
  if (_tokenCache.token && _tokenCache.expiresAt > now + 60) {
    return _tokenCache.token;
  }
  const res = await httpPostForm(v2AuthUrl(s.env), {
    client_id: s.clientId,
    client_version: s.clientVersion,
    client_secret: s.clientSecret,
    grant_type: 'client_credentials',
  });
  if (!res.access_token) {
    throw new Error('PhonePe OAuth failed: ' + (res.message || JSON.stringify(res)));
  }
  _tokenCache = { token: res.access_token, expiresAt: res.expires_at || (now + 3600) };
  return _tokenCache.token;
}

// ── POST /api/phonepay/initiate ───────────────────────────
// V2: Creates a PhonePe checkout session for the given online order
router.post('/initiate', async (req, res) => {
  const { order_id, customer_phone, amount_paise, redirect_url } = req.body;
  if (!order_id || !amount_paise) {
    return res.status(400).json({ success: false, message: 'order_id and amount_paise are required' });
  }

  let s;
  try {
    s = await getV2Settings();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
  if (!s.clientId || !s.clientSecret) {
    return res.status(400).json({ success: false, message: 'PhonePe not configured. Add Client ID & Client Secret in Settings → Integrations.' });
  }

  try {
    const token = await getOAuthToken(s);
    const merchantOrderId = `TZ_${order_id}_${Date.now()}`;

    const body = {
      merchantOrderId,
      amount: amount_paise,
      expireAfter: 900, // 15 minutes
      paymentFlow: {
        type: 'PG_CHECKOUT',
        merchantUrls: {
          redirectUrl: redirect_url || `${process.env.APP_URL || 'http://localhost:3000'}/menu/payment-callback`,
        },
      },
    };

    const ppRes = await httpPost(`${v2PayBaseUrl(s.env)}/checkout/v2/pay`, body, {
      'Content-Type': 'application/json',
      'Authorization': `O-Bearer ${token}`,
    });

    if (ppRes.redirectUrl) {
      await db.query(
        `UPDATE online_orders SET phonepay_txn_id = ?, payment_status = 'initiated' WHERE id = ?`,
        [merchantOrderId, order_id]
      );
      res.json({ success: true, redirectUrl: ppRes.redirectUrl, merchantOrderId });
    } else {
      res.status(400).json({ success: false, message: ppRes.message || 'PhonePe initiation failed', raw: ppRes });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/phonepay/callback ───────────────────────────
// V2: PhonePe server-to-server webhook after payment
router.post('/callback', async (req, res) => {
  try {
    // V2 webhook body: { event: 'checkout.order.completed'|'checkout.order.failed', payload: { merchantOrderId, state, ... } }
    const { event, payload } = req.body;
    if (!payload?.merchantOrderId) {
      return res.status(200).json({ message: 'OK' }); // Ignore malformed
    }

    const merchantOrderId = payload.merchantOrderId;
    const isSuccess = payload.state === 'COMPLETED';
    const transactionId = payload.paymentDetails?.[0]?.transactionId || merchantOrderId;
    const paymentStatus = isSuccess ? 'paid' : 'failed';
    const orderStatus = isSuccess ? 'confirmed' : 'payment_failed';

    await db.query(
      `UPDATE online_orders SET payment_status = ?, payment_ref = ?, status = ? WHERE phonepay_txn_id = ?`,
      [paymentStatus, transactionId, orderStatus, merchantOrderId]
    );

    if (isSuccess) {
      const [[order]] = await db.query('SELECT * FROM online_orders WHERE phonepay_txn_id = ?', [merchantOrderId]);
      if (order) {
        await autoCreatePosOrder(order, req.app.get('wsHub'));
      }
    }

    res.status(200).json({ message: 'OK' }); // Always return 200
  } catch (err) {
    console.error('[phonepay callback]', err.message);
    res.status(200).json({ message: 'OK' });
  }
});

// ── GET /api/phonepay/status/:txnId ──────────────────────
// V2: Check payment status after customer redirect back
router.get('/status/:txnId', async (req, res) => {
  try {
    const s = await getV2Settings();
    const token = await getOAuthToken(s);
    const merchantOrderId = req.params.txnId;

    const ppRes = await httpGet(
      `${v2PayBaseUrl(s.env)}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`,
      { 'Content-Type': 'application/json', 'Authorization': `O-Bearer ${token}` }
    );

    const isSuccess = ppRes.state === 'COMPLETED';
    if (isSuccess) {
      const [[order]] = await db.query('SELECT * FROM online_orders WHERE phonepay_txn_id = ?', [merchantOrderId]);
      if (order && order.payment_status !== 'paid') {
        const transactionId = ppRes.paymentDetails?.[0]?.transactionId || merchantOrderId;
        await db.query(
          `UPDATE online_orders SET payment_status='paid', payment_ref=?, status='confirmed' WHERE id=?`,
          [transactionId, order.id]
        );
        await autoCreatePosOrder(order, req.app.get('wsHub'));
      }
    }

    res.json({ success: true, state: ppRes.state, isSuccess, data: ppRes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/phonepay/confirm-cod ───────────────────────
// Confirm a COD / pay-at-counter order (no payment gateway)
router.post('/confirm-cod', async (req, res) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ success: false, message: 'order_id required' });
  try {
    await db.query(
      `UPDATE online_orders SET payment_status='cod', status='confirmed' WHERE id=?`,
      [order_id]
    );
    const [[order]] = await db.query('SELECT * FROM online_orders WHERE id=?', [order_id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    await autoCreatePosOrder(order, req.app.get('wsHub'));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Helper: auto-create POS orders + KOT from online order ─
async function autoCreatePosOrder(onlineOrder, wsHub) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Build order number
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM orders');
    const orderNumber = `ONL${String(cnt + 1).padStart(4, '0')}`;

    // 2. Get online order items
    const [onlineItems] = await conn.query(
      'SELECT * FROM online_order_items WHERE order_id = ?', [onlineOrder.id]
    );

    // 3. Create POS order
    const [orderResult] = await conn.query(
      `INSERT INTO orders
         (order_number, order_type, status, subtotal, gst_amount, total_amount,
          customer_name, notes, created_by, created_at)
       VALUES (?, ?, 'open', ?, ?, ?, ?, ?, 1, NOW())`,
      [
        orderNumber,
        onlineOrder.order_type || 'takeaway',
        onlineOrder.subtotal || 0,
        onlineOrder.gst_amount || 0,
        onlineOrder.total || 0,
        onlineOrder.customer_name || 'Online Customer',
        onlineOrder.notes || '',
      ]
    );
    const posOrderId = orderResult.insertId;

    // 4. Insert order items
    for (const item of onlineItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, total_price, kot_sent)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [posOrderId, item.menu_item_id || null, item.name, item.quantity, item.price, item.item_total]
      );
    }

    // 5. Create KOT ticket
    const [[{ kotCount }]] = await conn.query('SELECT COUNT(*) AS kotCount FROM kot_tickets WHERE order_id = ?', [posOrderId]);
    const kotNumber = kotCount + 1;
    const [kotResult] = await conn.query(
      `INSERT INTO kot_tickets (order_id, kot_number, status, created_at) VALUES (?, ?, 'pending', NOW())`,
      [posOrderId, kotNumber]
    );
    const kotId = kotResult.insertId;

    // 6. Link order items to KOT
    const [orderItems] = await conn.query('SELECT id, quantity FROM order_items WHERE order_id = ?', [posOrderId]);
    for (const oi of orderItems) {
      await conn.query(
        'INSERT INTO kot_items (kot_id, order_item_id, quantity) VALUES (?, ?, ?)',
        [kotId, oi.id, oi.quantity]
      );
      await conn.query('UPDATE order_items SET kot_sent = 1 WHERE id = ?', [oi.id]);
    }

    // 7. Update order status to 'kot'
    await conn.query(`UPDATE orders SET status = 'kot' WHERE id = ?`, [posOrderId]);

    // 8. Link back to online order
    await conn.query('UPDATE online_orders SET linked_order_id = ? WHERE id = ?', [posOrderId, onlineOrder.id]);

    await conn.commit();

    // 9. Broadcast to admin dashboard, KOT, KDS
    if (wsHub) {
      const broadcastData = {
        type: 'new_online_order',
        data: {
          online_order_id: onlineOrder.id,
          pos_order_id: posOrderId,
          order_number: orderNumber,
          order_type: onlineOrder.order_type,
          customer_name: onlineOrder.customer_name,
          customer_phone: onlineOrder.customer_phone,
          total: onlineOrder.total,
          items: onlineItems,
          payment_method: onlineOrder.payment_method,
        },
      };
      wsHub.broadcast('sales', broadcastData);
      wsHub.broadcast('kot', { type: 'kot_new', data: { order_id: posOrderId, kot_id: kotId, order_number: orderNumber } });
      wsHub.broadcast('kds', { type: 'kot_new', data: { order_id: posOrderId, kot_id: kotId, order_number: orderNumber } });
      wsHub.broadcast('dashboard', broadcastData);
    }
  } catch (err) {
    await conn.rollback();
    console.error('[autoCreatePosOrder]', err.message);
  } finally {
    conn.release();
  }
}

// ── HTTP helpers ─────────────────────────────────────────
function httpPostForm(url, params) {
  return new Promise((resolve, reject) => {
    const bodyStr = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname, port: parsed.port || 443,
      path: parsed.pathname + parsed.search, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr) },
    };
    const req = https.request(options, (r) => {
      let data = '';
      r.on('data', d => data += d);
      r.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname, port: parsed.port || 443,
      path: parsed.pathname + parsed.search, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
    };
    const req = https.request(options, (r) => {
      let data = '';
      r.on('data', d => data += d);
      r.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname, port: parsed.port || 443,
      path: parsed.pathname + parsed.search, method: 'GET',
      headers,
    };
    const req = https.request(options, (r) => {
      let data = '';
      r.on('data', d => data += d);
      r.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = router;
