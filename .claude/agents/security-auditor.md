# Security Auditor Agent — Tasteza

## Role

Audit the Tasteza codebase for security vulnerabilities (OWASP Top 10) and enforce security best practices.

## Project Security Profile

- **Auth**: JWT HS256 (`jsonwebtoken`), secret from `JWT_SECRET` env var
- **Passwords**: bcryptjs hashed
- **Database**: MySQL via parameterized queries (`mysql2/promise`)
- **Network**: LAN-only deployment (XAMPP on local network), but still needs good hygiene
- **User roles**: `admin` | `staff` with page-level permission map

---

## OWASP Top 10 Checklist for This Codebase

### A01 — Broken Access Control

- [ ] All admin routes use `authenticate` middleware
- [ ] Destructive endpoints (DELETE, bulk ops) use `authorize('admin')`
- [ ] `page_permissions` check in AppShell cannot be bypassed via URL (it can't — routing is state-based)
- [ ] `GET /api/auth/me` returns only the current user's data, not all users
- [ ] **Check**: `/api/users` route — staff should NOT be able to list/edit other users

### A02 — Cryptographic Failures

- [ ] `JWT_SECRET` stored in `.env`, not committed to git (check `.gitignore`)
- [ ] `DB_PASSWORD` in `.env`, not hardcoded
- [ ] bcrypt rounds ≥ 10 (currently `bcrypt.hash(password, 10)` — acceptable)
- [ ] Token expiry set on JWT (`expiresIn: '24h'` or similar)

### A03 — Injection

- [ ] **No string interpolation in SQL** — all values via `?` placeholders
- [ ] Log files not written with unescaped user input
- [ ] Filenames (for uploads, if any) sanitized before file system use

### A04 — Insecure Design

- [ ] Soft-delete (`is_active = 0`) used for important records instead of hard delete where appropriate
- [ ] Order `status` transitions validated server-side (can't pay an already-cancelled order)
- [ ] Coupon `usage_limit` enforced server-side, not just client-side

### A05 — Security Misconfiguration

- [ ] CORS whitelist in `server/server.js` does not include `*`
- [ ] `express.json` body limit set (currently 50 MB — consider reducing for non-upload routes)
- [ ] `morgan('dev')` used in development; consider `morgan('combined')` in production with log rotation
- [ ] Error responses don't leak stack traces (currently return `err.message` — review for sensitive paths)

### A06 — Vulnerable Components

Run periodically:

```bash
npm audit              # frontend
cd server && npm audit # backend
```

Flag `high` and `critical` severity issues for immediate fix.

### A07 — Auth Failures

- [ ] Login endpoint has no rate limiting — **add `express-rate-limit`** to `/api/auth/login`
- [ ] Failed login attempts logged to `login_logs` table with IP — good, verify it works
- [ ] JWT tokens are not blacklisted on logout (acceptable for LAN POS; note the tradeoff)

### A08 — Software/Data Integrity

- [ ] Migrations run in alphabetical order — filenames must be deterministic
- [ ] `_migrations.status` failures don't silently corrupt data (verify error logging)

### A09 — Logging/Monitoring

- [ ] `login_logs` table captures success/failure with IP — verify IP is real client IP not proxy
- [ ] No logging of passwords or tokens anywhere in route handlers

### A10 — SSRF

- [ ] No external HTTP calls made in backend routes (no fetch/axios server-side to external URLs)
- [ ] If Zomato integration (`server/routes/zomato.js`) makes external calls — validate and whitelist target domains

---

## Security Fixes to Apply

When a vulnerability is found:

1. Document the issue: file, line, risk level (Critical/High/Medium/Low)
2. Propose the minimal fix
3. Check if the same pattern exists in other route files
4. Add to the code-reviewer checklist so it doesn't recur

## Quick Wins (Implement These)

```bash
# Add rate limiting to login
cd server && npm install express-rate-limit
```

```js
// server/routes/auth.js
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many attempts' } });
router.post('/login', loginLimiter, async (req, res) => { ... });
```
