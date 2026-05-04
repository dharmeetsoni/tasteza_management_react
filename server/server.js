const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const wsHub = require('./websocket');
const runMigrations = require('./migrator');   // ← add
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
    ok ? cb(null, true) : cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

const db = require('./config/db');

// Adds missing integration columns one-by-one, ignoring "already exists" errors.
// Handles MySQL 5.7 which doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS.
async function ensureIntegrationColumns() {
  const cols = [
    ['firebase_api_key', 'VARCHAR(255) DEFAULT NULL'],
    ['firebase_auth_domain', 'VARCHAR(255) DEFAULT NULL'],
    ['firebase_project_id', 'VARCHAR(255) DEFAULT NULL'],
    ['firebase_app_id', 'VARCHAR(255) DEFAULT NULL'],
    ['phonepay_merchant_id', 'VARCHAR(100) DEFAULT NULL'],
    ['phonepay_salt_key', 'VARCHAR(100) DEFAULT NULL'],
    ['phonepay_salt_index', "VARCHAR(10)  DEFAULT '1'"],
    ['phonepay_env', "VARCHAR(20)  DEFAULT 'sandbox'"],
    // V2 credentials
    ['phonepay_client_id', 'VARCHAR(255) DEFAULT NULL'],
    ['phonepay_client_secret', 'VARCHAR(255) DEFAULT NULL'],
    ['phonepay_client_version', "VARCHAR(10) DEFAULT '1'"],
    ['google_maps_key', 'VARCHAR(255) DEFAULT NULL'],
    ['delivery_charge', 'DECIMAL(10,2) DEFAULT 30.00'],
    ['delivery_free_above', 'DECIMAL(10,2) DEFAULT 199.00'],
    ['auto_accept_seconds', 'INT DEFAULT 0'],
    ['online_ordering_enabled', 'TINYINT(1) DEFAULT 1'],
  ];
  for (const [col, def] of cols) {
    try {
      await db.query(`ALTER TABLE restaurant_settings ADD COLUMN ${col} ${def}`);
      console.log(`  ✅ Added column: ${col}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        // Column already exists — expected on subsequent starts
      } else {
        console.error(`  ⚠️  Could not add column ${col}:`, e.message);
      }
    }
  }
}

async function ensureOnlineOrdersColumns() {
  const orderCols = [
    ['gst_amount', 'DECIMAL(10,2) DEFAULT 0.00'],
    ['payment_method', "VARCHAR(30) DEFAULT 'cod'"],
    ['payment_status', "VARCHAR(20) DEFAULT 'pending'"],
    ['payment_ref', 'VARCHAR(100) DEFAULT NULL'],
    ['phonepay_txn_id', 'VARCHAR(100) DEFAULT NULL'],
    ['estimated_minutes', 'INT DEFAULT NULL'],
    ['linked_order_id', 'INT DEFAULT NULL'],
    ['coupon_code', 'VARCHAR(50) DEFAULT NULL'],
    ['discount_amount', 'DECIMAL(10,2) DEFAULT 0.00'],
  ];
  for (const [col, def] of orderCols) {
    try {
      await db.query(`ALTER TABLE online_orders ADD COLUMN ${col} ${def}`);
      console.log(`  ✅ Added column: online_orders.${col}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_NO_SUCH_TABLE') {
        console.error(`  ⚠️  Could not add online_orders.${col}:`, e.message);
      }
    }
  }
  // online_order_items
  try {
    await db.query(`ALTER TABLE online_order_items ADD COLUMN addon_data TEXT DEFAULT NULL`);
    console.log(`  ✅ Added column: online_order_items.addon_data`);
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_NO_SUCH_TABLE') {
      console.error(`  ⚠️  Could not add online_order_items.addon_data:`, e.message);
    }
  }
}

async function startServer() {
  // ── 1. DB connectivity check ───────────────────────────
  try {
    await db.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (err) {
    console.error('⚠️  DB connection failed:', err.message);
    console.error('   → Start XAMPP MySQL and retry.');
    process.exit(1);
  }

  // ── 2. Run pending migrations ──────────────────────────
  await runMigrations();

  // ── 2b. Ensure integration columns exist (resilient, per-column) ──
  await ensureIntegrationColumns();

  // ── 2c. Ensure online_orders columns exist ─────────────
  await ensureOnlineOrdersColumns();

  // ── 3. WebSocket ───────────────────────────────────────
  wsHub.init(server);
  app.set('wsHub', wsHub);

  // ── 4. Routes ──────────────────────────────────────────
  app.use('/api/public', require('./routes/public_menu'));
  app.use('/api/online-orders', require('./routes/online_orders'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/units', require('./routes/units'));
  app.use('/api/inventory', require('./routes/inventory'));
  app.use('/api/recipes', require('./routes/recipes'));
  app.use('/api/courses', require('./routes/courses'));
  app.use('/api/salaries', require('./routes/salaries'));
  app.use('/api/fuels', require('./routes/fuels'));
  app.use('/api/menuitems', require('./routes/menuitems'));
  app.use('/api/purchaseorders', require('./routes/purchaseorders'));
  app.use('/api/vendors', require('./routes/vendors'));
  app.use('/api/tables', require('./routes/tables'));
  app.use('/api/coupons', require('./routes/coupons'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/kot', require('./routes/kot'));
  app.use('/api/zomato', require('./routes/zomato'));
  app.use('/api/staff', require('./routes/staff'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/salary-mgmt', require('./routes/salary_mgmt'));
  app.use('/api/expenses', require('./routes/expenses'));
  app.use('/api/quotations', require('./routes/quotations'));
  app.use('/api/customers', require('./routes/customers'));
  app.use('/api/addons', require('./routes/addons'));
  app.use('/api/phonepay', require('./routes/phonepay'));

  app.get('/api', (req, res) => res.json({ status: 'OK', message: '🍽️ Tasteza API' }));

  // ── 5. Serve React build (production) ─────────────────
  const path = require('path');
  const fs = require('fs');
  const BUILD_DIR = path.join(__dirname, '..', 'build');
  if (fs.existsSync(BUILD_DIR)) {
    app.use(express.static(BUILD_DIR));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api'))
        res.sendFile(path.join(BUILD_DIR, 'index.html'));
    });
    console.log('📦 Serving React build from:', BUILD_DIR);
  } else {
    console.log('ℹ️  No build/ found — React dev server runs on :3000');
  }

  // ── 6. Error handler ───────────────────────────────────
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: err.message || 'Internal error' });
  });

  // ── 7. Listen ──────────────────────────────────────────
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Tasteza  →  http://localhost:${PORT}`);
    console.log(`🔌 WS       →  ws://localhost:${PORT}/ws`);
    console.log(`📱 Tablets  →  http://<your-ip>:${PORT}\n`);
  });
}

// ...existing CORS / middleware setup stays above startServer()...
startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});