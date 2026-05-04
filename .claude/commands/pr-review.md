# pr-review Command — Tasteza

## Usage
Run this when reviewing a set of changes before committing or merging.

## Review Process

### Step 1: Identify Changed Files
```bash
git diff --name-only HEAD
# or for staged changes:
git diff --staged --name-only
```

### Step 2: Run the Code Reviewer Checklist
See `.claude/agents/code-reviewer.md` for the full checklist.

Quick version:
- [ ] No direct `axios` in components
- [ ] All SQL queries parameterized
- [ ] New routes registered in `server/server.js`
- [ ] New pages added to `AppShell.js`
- [ ] Transaction `conn.release()` in `finally`
- [ ] Schema changes are migrations, not edits to `schema.sql`
- [ ] No hardcoded secrets or colors

### Step 3: Check for Security Issues
See `.claude/agents/security-auditor.md`.

Critical checks:
- [ ] No SQL injection via string template literals in queries
- [ ] No new routes without `authenticate` middleware
- [ ] No `JWT_SECRET` or DB credentials in code

### Step 4: Verify the Diff Makes Sense
For each changed file:
- Is the change minimal (does it only address the stated issue/feature)?
- Does it follow naming conventions (`snake_case` for DB, `camelCase` for JS, `PascalCase` for components)?
- Does the response envelope match `{ success, data, message }`?

### Step 5: Test Checklist
- [ ] Backend restarted and affected endpoint tested manually
- [ ] Frontend page loads and relevant feature works
- [ ] If DB migration added: `SELECT * FROM _migrations` shows it as `applied`
- [ ] No console errors in browser DevTools

---

## Output Format
For each issue found, state:
1. **File** (relative path)
2. **Line** (approximate)
3. **Category**: Bug / Security / Convention / Performance
4. **Issue**: what is wrong
5. **Fix**: what change to make
