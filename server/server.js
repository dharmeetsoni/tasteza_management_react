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