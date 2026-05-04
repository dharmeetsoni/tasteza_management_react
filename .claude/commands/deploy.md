# deploy Command — Tasteza

## Deployment Model
Tasteza runs **locally on XAMPP** — there is no cloud deployment.
"Deploy" means building the React app and serving it through Express on the local restaurant machine.

## Build & Deploy Steps

### 1. Build the React App
```bash
# In project root
npm run build
# Outputs to: build/
```

### 2. Copy Build to Server Location
The Express server serves `../build/` as static files (see `server/server.js`):
```js
app.use(express.static(path.join(__dirname, '../build')));
```
Build output is already in the correct location — no copy needed if running from project root.

### 3. Configure `server/.env`
Ensure these are set on the target machine:
```
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<xampp_mysql_password>
DB_NAME=auth_system
JWT_SECRET=<strong_random_secret>
```

### 4. Start the Server
```bash
cd server
node server.js
# OR with PM2 for persistence:
pm2 start server.js --name tasteza
pm2 save
pm2 startup
```

### 5. Verify
- Open browser to `http://localhost:3001`
- Frontend loads and proxies all `/api` requests to itself
- Check MySQL is running: XAMPP control panel → MySQL → Start

---

## Update Deployment (On-Site)
See `HOW_TO_UPDATE.md` for the step-by-step guide.

Quick version:
1. Pull latest code (or copy files)
2. `npm install` (frontend)
3. `cd server && npm install` (backend)
4. `npm run build`
5. Restart the Node server (or PM2: `pm2 restart tasteza`)
6. DB migrations run automatically on server start

---

## LAN Access (Tablets, Other Devices)
The Express CORS config allows LAN IPs (`192.168.x.x`, `10.x.x.x`).
Devices on the same WiFi can access at: `http://<server-ip>:3001`

Find server IP: `ipconfig` (Windows) / `ifconfig` (macOS/Linux)

---

## Checklist Before Deploying
- [ ] `npm run build` completes without errors
- [ ] `server/.env` has correct `JWT_SECRET` and DB credentials
- [ ] MySQL is running, `auth_system` database exists
- [ ] No pending breaking migrations (check `server/migrations/` for any unreviewed files)
- [ ] Service Worker cache version bumped if significant assets changed (check `public/sw.js` cache name)
