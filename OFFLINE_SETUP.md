# Tasteza — Offline Setup Guide

## How offline works

Tasteza uses a **Service Worker** + **IndexedDB** to work when the server is unreachable:

| Situation | What happens |
|---|---|
| WiFi down on tablet | App loads from SW cache, shows cached menu/tables |
| Server unreachable | POS operations (orders, KOT, payments) saved to local queue |
| Connection restored | Queue auto-syncs to server within 1–2 seconds |
| App opened offline | Last logged-in user stays logged in |

### What works offline
- ✅ Full app UI loads
- ✅ View cached menu items, tables, staff
- ✅ Create orders, send KOTs, mark paid (queued, synced later)
- ✅ Update KOT status on KDS screen

### What requires connection
- ❌ Login (first time)
- ❌ Reports (need live data)
- ❌ Admin changes (staff, inventory, settings)

---

## Production setup (recommended for tablets)

Instead of running React dev server separately, build once and serve from Express:

```bash
# 1. Build the React app
cd tasteza-react
npm run build:prod     # outputs to tasteza-react/../build/

# 2. Start only the server (serves both API + React app)
cd server
npm run dev

# 3. Open on any device on your network
#    http://192.168.1.XX:3001   (replace XX with your PC's IP)
```

**Find your PC's IP:**
- Mac: System Settings → Wi-Fi → Details
- Windows: `ipconfig` in Command Prompt → IPv4 Address

---

## Development setup (two terminals)

```bash
# Terminal 1 — Backend
cd tasteza-react/server && npm run dev

# Terminal 2 — Frontend dev server  
cd tasteza-react && npm start
# Open http://localhost:3000
```

---

## Offline banner

A banner appears at the bottom of the screen when offline or when there are pending sync items:

- 🔴 Red = no connection
- ⏳ Dark = online but items waiting to sync
- **Sync Now** button = manually trigger sync
