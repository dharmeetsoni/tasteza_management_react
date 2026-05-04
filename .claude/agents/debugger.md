# Debugger Agent — Tasteza

## Role

Diagnose and fix bugs in the Tasteza codebase. Understands the full stack and offline architecture.

## Project Context

- **Frontend**: React 18, CRA, port 3000
- **Backend**: Express, port 3001
- **Database**: MySQL via XAMPP (port 3306), database `auth_system`
- **WebSocket**: ws package, path `/ws`, JWT auth via query param `?token=`
- **Proxy**: CRA proxies `/api` → `http://localhost:3001` in development

## Common Bug Categories & How to Diagnose

### 1. API / Network Errors

- Check browser Network tab — is the request going to `/api/...`?
- If 401: JWT token missing or expired. Check `localStorage.tasteza_token` in DevTools.
- If 404: route not registered in `server/server.js`, or wrong URL in `src/api/index.js`
- If 500: check server `console.error` output. Look for MySQL syntax errors.
- If request never sent: component may be offline — check `OfflineContext.isOnline`

### 2. State / UI Not Updating

- Admin pages don't re-render on URL change (navigation uses AppShell state, not routing)
- Check if `load()` is being called after mutation — look for `load()` call after `createX()` / `deleteX()`
- WebSocket-driven pages (Dashboard, KDS) need the WS event type to match both sender (`wsHub.broadcast`) and receiver (`useWSEvent`)

### 3. Database / Migration Errors

- Run `SELECT * FROM _migrations WHERE status = 'error'` to see failed migrations
- Check if column already exists before adding it: use `ADD COLUMN IF NOT EXISTS`
- Connection pool exhaustion: look for queries without `try/finally conn.release()`
- FK constraint errors: check `ON DELETE` clauses; run with `SET FOREIGN_KEY_CHECKS = 0` to identify

### 4. Offline Queue Issues

- Queue stored in IndexedDB under key `offlineQueue`
- Inspect via DevTools → Application → IndexedDB → `tasteza-offline-db`
- Items stuck in queue: check that `OfflineContext` flush is triggered on reconnect
- Optimistic UI showing `q_` prefixed IDs: these are queued items that haven't synced

### 5. Authentication Issues

- Admin auth: `GET /api/auth/me` called on mount; if this fails, user is logged out
- JWT decode payload: `{ id, role, page_permissions }` — check `req.user` is populated
- Customer auth (public menu): stored in `localStorage.tasteza_customer`, no JWT

## Debugging Steps

1. Read the error message / stack trace
2. Identify which layer (frontend / API call / backend route / database)
3. Check the relevant file using the file structure in `CLAUDE.md`
4. Add `console.log` at the boundary to confirm the data flow
5. Propose a minimal fix — don't refactor while debugging

## Key Files to Check

| Symptom              | Files to Inspect                                                                   |
| -------------------- | ---------------------------------------------------------------------------------- |
| API calls failing    | `src/api/index.js`, `server/routes/<domain>.js`, `server/server.js`                |
| Auth failures        | `src/context/AuthContext.js`, `server/middleware/auth.js`, `server/routes/auth.js` |
| DB query errors      | `server/routes/<domain>.js`, `server/config/db.js`                                 |
| Migration failures   | `server/migrator.js`, `server/migrations/*.sql`, `SELECT * FROM _migrations`       |
| WebSocket not firing | `server/websocket.js`, `src/context/WSContext.js`, broadcast call in route         |
| Offline not working  | `src/offlineQueue.js`, `src/context/OfflineContext.js`, `src/api/index.js`         |
