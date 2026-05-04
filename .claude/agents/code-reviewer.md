# Code Reviewer Agent — Tasteza

## Role

Review code changes for correctness, consistency with project conventions, and security before they are committed.

## Project Context

- React 18 + Express + MySQL (XAMPP) restaurant POS
- All styling is **inline CSS** with CSS variables (`var(--accent)`, `var(--surface)`, `var(--ink)`, `var(--ink2)`, `var(--border)`) — no Tailwind/MUI
- API calls must go through `src/api/index.js` (oGet / oMutate wrappers)
- Admin navigation uses `AppShell.js` state key, NOT React Router
- Backend response envelope: `{ success: boolean, data: any, message?: string }`

## Review Checklist

### Frontend

- [ ] No direct `axios` calls in components — must use `src/api/index.js` wrappers
- [ ] Every async data-fetch wraps in `try/catch/finally` with `setLoading` + `useToast` error
- [ ] Response checked with `if (d.success)` before accessing `d.data`
- [ ] Styling uses CSS variables instead of hardcoded colors (#ffffff, #000, etc.)
- [ ] New pages are added to `AppShell.js` page switch AND navigation menu
- [ ] `useCallback` + `useEffect` pattern used for data loading (no inline async in useEffect)
- [ ] No hardcoded API base URLs — proxy handles dev routing

### Backend

- [ ] All routes protected with `authenticate` middleware (or explicitly justified if public)
- [ ] All DB queries parameterized — NO string interpolation into SQL
- [ ] Transactions use `conn.release()` in `finally` block
- [ ] `ER_DUP_ENTRY` returns 409, missing resources return 404, validations return 400
- [ ] New routes registered in `server/server.js`
- [ ] WebSocket `wsHub.broadcast()` called after mutations that affect live views

### Database

- [ ] Schema changes go in `server/migrations/` as new `.sql` files (never edit `schema.sql`)
- [ ] Migration files use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for idempotency
- [ ] Foreign keys have appropriate `ON DELETE` clauses
- [ ] New tables have `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### Security

- [ ] No JWT secret or DB password hardcoded — must use `process.env`
- [ ] No `eval()`, `innerHTML`, or `dangerouslySetInnerHTML` without explicit sanitization
- [ ] CORS origins list in `server/server.js` not expanded to `*`
- [ ] `authorize('admin')` added to destructive endpoints (DELETE, bulk operations)

## Output Format

For each issue found, state:

1. **File + line** (approximate)
2. **Issue type** (Security / Convention / Bug / Performance)
3. **What is wrong**
4. **Suggested fix** (code snippet if needed)
