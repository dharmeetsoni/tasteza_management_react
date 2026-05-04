# fix-issue Command — Tasteza

## Usage
Run this when given a bug report, error message, or broken feature.

## Process

### Step 1: Understand the Issue
Identify which layer the bug is in:
- **Frontend UI** → `src/components/pages/` or `src/components/layout/AppShell.js`
- **API call** → `src/api/index.js`
- **Backend route** → `server/routes/<domain>.js`
- **Database** → query in route file or `server/migrations/`
- **Auth** → `server/middleware/auth.js`, `src/context/AuthContext.js`
- **WebSocket** → `server/websocket.js`, `src/context/WSContext.js`
- **Offline/Queue** → `src/offlineQueue.js`, `src/context/OfflineContext.js`

### Step 2: Read the Relevant File(s)
Do NOT guess — read the file first:
```
src/components/pages/<PageName>.js       ← for UI bugs
server/routes/<domain>.js                ← for API/logic bugs
src/api/index.js                         ← for API call issues
server/config/db.js                      ← for DB connection issues
```

### Step 3: Check Common Causes
- Missing `if (d.success)` check → silent failure
- `conn.release()` missing in transaction → pool exhaustion
- New route not registered in `server/server.js`
- New page not added to `AppShell.js` switch + nav
- SQL string interpolation instead of `?` params
- `useEffect` dep array missing → stale closure

### Step 4: Apply the Fix
- Minimal change — fix the root cause only
- Follow conventions in `.claude/rules/`
- For DB changes: create a migration file in `server/migrations/`

### Step 5: Verify
- Backend: restart `nodemon` and test the endpoint
- Frontend: `npm start` and test the affected page
- If DB schema changed: check `SELECT * FROM _migrations` to confirm migration ran

---

## Error Reference

| Error / Symptom | Likely Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Missing/expired JWT | Check `localStorage.tasteza_token`; re-login |
| `403 Forbidden` | Wrong role | Add `authorize('admin')` or check user role |
| `404 Not Found` | Route not registered | Add to `server/server.js` |
| `409 Conflict` | Duplicate DB entry | Handle `ER_DUP_ENTRY` in route |
| `Cannot read properties of undefined` | `d.data` accessed without success check | Add `if (d.success)` guard |
| Page shows old data | `load()` not called after mutation | Call `load()` after `createX()`/`deleteX()` |
| `Too many connections` | `conn.release()` missing | Add `finally { conn.release() }` |
| Migration not applying | Not using `IF NOT EXISTS` / duplicate filename | Check `_migrations` table |
