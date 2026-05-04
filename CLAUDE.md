# Tasteza Management System — Claude Project Guide

## Project Overview
Full-stack restaurant management system (POS + Kitchen + Inventory + Reports) for **Tasteza Kitchen & Cafe**.
Designed for **offline-capable** operation on LAN tablets running XAMPP (MySQL locally).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Axios, Recharts |
| Backend | Node.js, Express 4, mysql2/promise, JWT, bcryptjs, ws |
| Database | **MySQL** (XAMPP), database name: `auth_system` |
| Build | Create React App (react-scripts 5) |
| Realtime | WebSocket (`ws` package) — path `/ws` |
| Offline | IndexedDB queue (`offlineQueue.js`) + Service Worker |

No Tailwind, no MUI, no Ant Design. **All styling is inline CSS** using CSS variables (`var(--accent)`, `var(--surface)`, `var(--ink)`, `var(--ink2)`, `var(--border)`).

---

## Directory Structure

```
tasteza_management_react/
├── CLAUDE.md            ← this file
├── package.json         ← CRA frontend
├── public/
│   ├── index.htmlÏ
│   └── sw.js            ← Service Worker (offline caching)
├── server/              ← Express backend
│   ├── server.js        ← entry point, route registration, migration runner
│   ├── schema.sql       ← initial DB schema
│   ├── migrator.js      ← file-based migration runner
│   ├── seed.js          ← dev seed data
│   ├── config/db.js     ← mysql2 pool (env vars)
│   ├── middleware/auth.js  ← authenticate() + authorize() middleware
│   ├── migrations/      ← incremental ALTER TABLE / CREATE TABLE files
│   ├── routes/          ← one file per domain, ~26 route modules
│   └── utils/
│       └── inventoryDeduct.js
└── src/                 ← React frontend
    ├── App.js           ← routes: /menu/* (public) and /* (admin)
    ├── api/index.js     ← ALL API calls via oGet / oMutate wrappers
    ├── context/
    │   ├── AuthContext.js         ← admin JWT auth
    │   ├── CustomerAuthContext.js ← customer session (localStorage)
    │   ├── WSContext.js           ← WebSocket + useWSEvent hook
    │   ├── OfflineContext.js      ← online/offline + queue flush
    │   └── ToastContext.js        ← global toasts
    ├── components/
    │   ├── layout/AppShell.js     ← admin nav; page rendered by state key, NOT URL
    │   ├── order/
    │   └── pages/                 ← all admin + public pages
    └── utils/index.js
```

---

## Architecture — Critical Facts

### 1. Admin Navigation (NOT URL-Based)
`AppShell` uses `useState('dashboard')` to track current page.  
**Do NOT add `<Route>` entries for admin pages.** Add a new `if (page === 'mypage') return <MyPage />` block in `AppShell.js` instead.

### 2. API Calls — Always Use the Wrappers
All API calls must go through `src/api/index.js`:
- `oGet(path, params)` — for GETs, automatic offline IndexedDB fallback
- `oMutate(method, path, body, queueable)` — for POST/PUT/PATCH/DELETE

**Never use `axios` directly in a component.** Add new named exports to `src/api/index.js`.

### 3. Response Envelope
Every backend endpoint returns `{ success: boolean, data: any, message?: string }`.  
Frontend always checks `if (d.success) { ... }` before accessing `d.data`.

### 4. Auth
- Admin: JWT in `Authorization: Bearer <token>` header (auto-injected by Axios interceptor)
- Add `authenticate` middleware to every protected route. Add `authorize('admin')` for admin-only endpoints.
- Token stored in `localStorage.tasteza_token`

### 5. Database
- **MySQL**, accessed via `db.query(sql, params)` for simple queries, or `db.getConnection()` for transactions.
- Always use parameterized queries: `db.query('SELECT * FROM foo WHERE id = ?', [id])`
- Transactions must call `conn.release()` in a `finally` block.

### 6. Adding a New Feature (checklist)
- [ ] DB: add migration file in `server/migrations/YYYYMMDD_feature_name.sql` using `IF NOT EXISTS`
- [ ] Backend: create/update route file in `server/routes/`, register in `server/server.js`
- [ ] API: add named export in `src/api/index.js` using `oGet` or `oMutate`
- [ ] Frontend: create `src/components/pages/FeaturePage.js`, add to `AppShell.js` page switch + nav
- [ ] Permissions: if role-gated, add page key to `ROLE_DEFAULTS` in `AppShell.js`

### 7. WebSocket Events
After any mutation that affects live views, broadcast via:
```js
const wsHub = req.app.get('wsHub');
wsHub.broadcast('sales', { type: 'order_created', data: { ... } });
```
Rooms: `sales`, `kot`, `billing`, `dashboard`, `kds`

---

## Development

```bash
# Install dependencies
npm install             # frontend (CRA)
cd server && npm install # backend

# Start backend (port 3001)
cd server && npm run dev   # nodemon server.js

# Start frontend (port 3000, proxies /api to :3001)
npm start

# Build for production
npm run build           # outputs to build/, served by Express
```

**Prerequisites:** XAMPP running MySQL on port 3306, database `auth_system` created, `server/.env` configured.

---

## Environment Variables (`server/.env`)
```
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=auth_system
JWT_SECRET=your_secret_here
```

---

## Key Patterns

### Backend Route Template
```js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);  // protect all routes

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM table_name WHERE is_active = 1');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
```

### Frontend Page Template
```js
import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { getSomething, createSomething } from '../../api';

export default function FeaturePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getSomething();
      if (d.success) setData(d.data);
    } catch { toast('Failed to load', 'er'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: '1rem' }}>
      {loading ? <p>Loading…</p> : data.map(item => (
        <div key={item.id} style={{ background: 'var(--surface)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

### Transaction Template
```js
const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  const [result] = await conn.query('INSERT INTO ...', [...]);
  await conn.query('UPDATE ... WHERE id = ?', [result.insertId]);
  await conn.commit();
  res.json({ success: true, data: { id: result.insertId } });
} catch (err) {
  await conn.rollback();
  res.status(500).json({ success: false, message: err.message });
} finally {
  conn.release();
}
```
