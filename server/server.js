const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const http     = require('http');
const wsHub    = require('./websocket');
require('dotenv').config();

const app    = express();
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

// ── DB check ──────────────────────────────────────────────
const db = require('./config/db');
db.query('SELECT 1')
  .then(() => console.log('✅ Database connected'))
  .catch(err => {
    console.error('⚠️  DB failed:', err.message);
    console.error('   → Start XAMPP MySQL + run migrations in phpMyAdmin');
  });

// ── WebSocket Hub ─────────────────────────────────────────
wsHub.init(server);

// Attach broadcast helper to app so routes can use it
app.set('wsHub', wsHub);

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/categories',     require('./routes/categories'));
app.use('/api/units',          require('./routes/units'));
app.use('/api/inventory',      require('./routes/inventory'));
app.use('/api/recipes',        require('./routes/recipes'));
app.use('/api/courses',        require('./routes/courses'));
app.use('/api/salaries',       require('./routes/salaries'));
app.use('/api/fuels',          require('./routes/fuels'));
app.use('/api/menuitems',      require('./routes/menuitems'));
app.use('/api/purchaseorders', require('./routes/purchaseorders'));
app.use('/api/vendors',        require('./routes/vendors'));
app.use('/api/tables',         require('./routes/tables'));
app.use('/api/coupons',        require('./routes/coupons'));
app.use('/api/orders',         require('./routes/orders'));
app.use('/api/kot',            require('./routes/kot'));
app.use('/api/zomato',         require('./routes/zomato'));
app.use('/api/staff',          require('./routes/staff'));
app.use('/api/reports',        require('./routes/reports'));
app.use('/api/settings',       require('./routes/settings'));
app.use('/api/salary-mgmt',    require('./routes/salary_mgmt'));
app.use('/api/expenses',       require('./routes/expenses'));
app.use('/api/quotations',     require('./routes/quotations'));

app.get('/api', (req, res) => res.json({ status:'OK', message:'🍽️ Tasteza API' }));

// ── Serve built React app ─────────────────────────────────
// Run `npm run build` in tasteza-react/ first, then the server
// serves everything from one port — tablets just open http://192.168.x.x:3001
const path = require('path');
const fs   = require('fs');
const BUILD_DIR = path.join(__dirname, '..', 'build');
if (fs.existsSync(BUILD_DIR)) {
  app.use(express.static(BUILD_DIR));
  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(BUILD_DIR, 'index.html'));
    }
  });
  console.log('📦 Serving React build from:', BUILD_DIR);
} else {
  console.log('ℹ️  No build/ folder found. Run: cd tasteza-react && npm run build');
  console.log('   (Dev mode: React runs separately on port 3000)');
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success:false, message: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Tasteza  →  http://localhost:${PORT}`);
  console.log(`🔌 WS       →  ws://localhost:${PORT}/ws`);
  console.log(`📱 Tablets  →  http://<your-ip>:${PORT}\n`);
});