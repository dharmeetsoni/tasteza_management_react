# 🍽️ Tasteza — React + Node.js + MySQL

Full-stack restaurant management system with React frontend and Express API backend.

---

## 📁 Project Structure

```
tasteza-react/
├── server/                    # Express API Backend (port 3001)
│   ├── config/
│   │   └── db.js              # MySQL connection pool
│   ├── middleware/
│   │   └── auth.js            # JWT verify + role check
│   ├── routes/
│   │   ├── auth.js            # Login, logout, /me
│   │   ├── users.js           # User CRUD (admin only)
│   │   ├── categories.js      # Category management
│   │   ├── units.js           # Units of measurement
│   │   ├── inventory.js       # Inventory + purchases + stock
│   │   ├── recipes.js         # Recipe builder + costing
│   │   ├── courses.js         # Menu course types
│   │   ├── salaries.js        # Salary profiles
│   │   ├── fuels.js           # Fuel profiles
│   │   └── menuitems.js       # Menu items
│   ├── schema.sql             # Database schema + seed data
│   ├── seed.js                # Programmatic seeder
│   ├── server.js              # Express app entry
│   ├── package.json
│   └── .env                   # DB + JWT config
│
└── src/                       # React Frontend (port 3000)
    ├── api/
    │   └── index.js           # All API call functions
    ├── context/
    │   ├── AuthContext.js     # Auth state + JWT management
    │   └── ToastContext.js    # Global toast notifications
    ├── utils/
    │   └── index.js           # Date, currency, avatar helpers
    ├── components/
    │   ├── layout/
    │   │   └── AppShell.js    # Topbar + Sidebar + routing
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   ├── InventoryPage.js
    │   │   ├── PurchasesPage.js
    │   │   ├── CategoriesPage.js
    │   │   ├── UnitsPage.js
    │   │   ├── RecipesPage.js
    │   │   ├── MenuItemsPage.js
    │   │   ├── CoursesPage.js
    │   │   ├── SalaryPage.js
    │   │   ├── FuelPage.js
    │   │   ├── UsersPage.js
    │   │   └── ProfilePage.js
    │   └── ui/
    │       ├── Modal.js        # Reusable modal component
    │       └── ConfirmModal.js # Delete confirmation modal
    ├── App.js
    ├── index.js
    └── index.css              # All global styles
```

---

## ⚡ Quick Setup

### 1. Setup Database
- Open XAMPP → Start Apache + MySQL
- Open **phpMyAdmin** → Create database `auth_system`
- Import `server/schema.sql`

### 2. Setup Backend (API Server)
```bash
cd server
npm install
npm run dev   # starts on http://localhost:3001
```

### 3. Setup Frontend (React App)
```bash
# from tasteza-react root
npm install
npm start     # starts on http://localhost:3000
```

The React app proxies API requests to port 3001 automatically.

---

## 🎭 Demo Credentials

| Role  | Phone        | Password  |
|-------|-------------|-----------|
| Admin | 9999999999  | admin123  |
| Staff | 8888888888  | staff123  |

---

## 🔑 How Auth Works

1. Login → API returns JWT token
2. Token stored in `localStorage`
3. Every API request: `Authorization: Bearer <token>`
4. Token expires in 8 hours

---

## 🗂️ Pages & Features

| Page | Description | Access |
|------|-------------|--------|
| Inventory | Stock tracking, grid/table view, adjustments | All |
| Purchase History | Record & view all purchases | All |
| Categories | Inventory categories with icons | All |
| Units | Weight, volume, count units | All |
| Recipes | Recipe builder with cost calculation | All |
| Menu Items | Menu dishes with margin tracking | All |
| Courses | Menu course types (Starter, Main…) | All |
| Salary Manager | Staff cost profiles | All |
| Fuel Manager | Fuel/energy cost profiles | All |
| Users | User CRUD + login logs | Admin only |
| My Profile | Current user info | All |

---

## 🌐 API Endpoints

All routes are on `http://localhost:3001/api/`

```
POST   /auth/login
GET    /auth/me
POST   /auth/logout

GET/POST       /categories
PUT/DELETE     /categories/:id

GET/POST       /units
PUT/DELETE     /units/:id

GET/POST       /inventory
PUT/DELETE     /inventory/:id
POST           /inventory/:id/adjust
GET/POST       /inventory/purchases

GET/POST       /recipes
PUT/DELETE     /recipes/:id
GET            /recipes/:id/ingredients

GET/POST       /courses
PUT/DELETE/PATCH /courses/:id

GET/POST       /salaries
PUT/DELETE     /salaries/:id

GET/POST       /fuels
PUT/DELETE     /fuels/:id

GET/POST       /menuitems
PUT/DELETE/PATCH /menuitems/:id

GET/POST/PUT/DELETE  /users
PATCH                /users/:id/password
GET                  /users/logs/all
```
