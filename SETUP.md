# Tasteza — Setup Guide

## New in This Update
- 📊 **Dashboard** — Live stats, charts, real-time KPIs
- 🔌 **WebSocket** — Instant sync across all devices/apps
- 👥 **Staff Management** — Salary, advances, attendance
- 📈 **Reports** — P&L, Sales, Customers, Salary, Fixed Costs
- 🔐 **Role Permissions** — Per-role and per-user page access

---

## 1. Run SQL Migrations (ONE TIME)

In phpMyAdmin → `auth_system` → SQL tab, run in order:

1. `server/migrations/purchase_orders.sql`
2. `server/migrations/sales.sql`
3. `server/migrations/zomato_menu.sql`
4. `server/migrations/staff_reports.sql`  ← NEW

---

## 2. Install Dependencies

```bash
# Backend
cd tasteza-react/server
npm install        # installs: express, ws, mysql2, bcryptjs, jwt, cors, morgan

# Frontend  
cd tasteza-react
npm install        # installs: react, recharts, axios, etc.
```

---

## 3. Start Servers

```bash
# Terminal 1 — Backend (port 3001 + WebSocket)
cd tasteza-react/server
npm run dev

# Terminal 2 — Frontend (port 3000)
cd tasteza-react
npm start
```

Open: http://localhost:3000

---

## 4. Login

| Role    | Phone        | Password   |
|---------|--------------|------------|
| Admin   | 9999999999   | admin123   |
| Staff   | 8888888888   | staff123   |

---

## 5. WebSocket for Android/Other Apps

See `WEBSOCKET_API.md` for full docs.

Quick start:
```
ws://YOUR_LAN_IP:3001/ws?token=YOUR_JWT
```

Get IP: Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

---

## 6. What Auto-Syncs via WebSocket

| Event              | Triggers update in        |
|--------------------|---------------------------|
| Order created      | Sales, Dashboard           |
| KOT fired          | KOT Manager, Sales         |
| KOT status changed | KOT Manager, Sales         |
| Bill generated     | Sales, Billing display     |
| Order paid         | Sales, Dashboard           |
| Order cancelled    | Sales                      |
