# ⚡ How to Apply This Update

## Step 1 — DELETE your old project folder completely
```
rm -rf tasteza-react/
```
Or on Windows: just delete the entire `tasteza-react` folder manually.

## Step 2 — Extract this zip
Extract `tasteza-complete.zip` — you get a fresh `tasteza-react/` folder.

## Step 3 — Install dependencies
```bash
cd tasteza-react
npm install

cd server
npm install
cd ..
```

## Step 4 — Run the new migration (IMPORTANT)
Open phpMyAdmin → `auth_system` database → SQL tab → paste and run:

**File:** `server/migrations/salary_expense.sql`

This creates:
- `salary_settlements` table
- `expense_categories` table (with 9 default categories)
- `expenses` table

## Step 5 — Start the app
```bash
# Terminal 1 — Backend
cd tasteza-react/server
npm run dev

# Terminal 2 — Frontend  
cd tasteza-react
npm start
```

## ✅ New Pages You Should Now See in Sidebar

| Icon | Label | What it does |
|------|-------|-------------|
| 🖥️ | **KDS — Kitchen** | Live kitchen display for chefs (under KOT Manager) |
| 💰 | **Salary Manager** | Monthly salary, advances, settlements (under COSTS section) |
| 💸 | **Expense Manager** | Track all business expenses (under COSTS section) |

## ⚠️ If you still don't see them
Your user in the DB might have `page_permissions` set manually.
Go to **Users & Access** → edit your admin user → make sure page_permissions is empty/null.
Admin role automatically gets access to everything.
