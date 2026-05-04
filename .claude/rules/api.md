# API Rules — Tasteza

## Architecture

- **Base URL**: `/api` (proxied to `http://localhost:3001` in dev via CRA proxy)
- **Auth**: `Authorization: Bearer <jwt>` header — auto-injected by Axios interceptor in `src/api/index.js`
- **Envelope**: All responses use `{ success: boolean, data: any, message?: string }`

---

## Frontend — API Call Rules

### Rule 1: Never Use Axios Directly in Components

All API calls must be exported named functions from `src/api/index.js`.

```js
// CORRECT — add this to src/api/index.js
export const getVendors = (params) => oGet("/vendors", params);
export const createVendor = (data) => oMutate("post", "/vendors", data);
export const updateVendor = (id, data) => oMutate("put", `/vendors/${id}`, data);
export const deleteVendor = (id) => oMutate("delete", `/vendors/${id}`);
```

```js
// WRONG — direct axios in component
import axios from "axios";
const res = await axios.get("/api/vendors");
```

### Rule 2: Use oMutate with queueable=true for Critical POS Operations

```js
// queueable=true — will queue to IndexedDB if offline
export const createOrder = (data) => oMutate("post", "/orders", data, true);
export const markPaid = (id, data) => oMutate("post", `/orders/${id}/pay`, data, true);

// queueable=false (default) — will fail loudly when offline
export const createMenuItem = (data) => oMutate("post", "/menuitems", data, false);
```

Operations that are POS-critical (orders, KOT, payments) should use `queueable=true`.
Admin config changes should use `queueable=false`.

### Rule 3: Always Check d.success

```js
const d = await getOrders({ date: today });
if (d.success) {
  setOrders(d.data);
} else {
  toast(d.message || "Failed to load orders", "er");
}
```

---

## Backend — Route Rules

### Route File Template

```js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate); // protect all routes in this module

// GET all (with optional filters)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM table WHERE is_active = 1");
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Name is required" });
  try {
    const [result] = await db.query("INSERT INTO table (name) VALUES (?)", [name]);
    res.json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "Already exists" });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update
router.put("/:id", async (req, res) => {
  try {
    await db.query("UPDATE table SET ? WHERE id = ?", [req.body, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE
router.delete("/:id", authorize("admin"), async (req, res) => {
  try {
    await db.query("DELETE FROM table WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
```

### Registering a New Route

In `server/server.js`, add:

```js
const newFeatureRoutes = require("./routes/newfeature");
// ... in the route registration block:
app.use("/api/newfeature", newFeatureRoutes);
```

### HTTP Status Codes

| Situation                       | Status                                       |
| ------------------------------- | -------------------------------------------- |
| Success                         | 200                                          |
| Created                         | 200 (this codebase uses 200 for creates too) |
| Bad request / missing fields    | 400                                          |
| Unauthorized (no/invalid token) | 401                                          |
| Forbidden (wrong role)          | 403                                          |
| Not found                       | 404                                          |
| Duplicate entry                 | 409                                          |
| Server error                    | 500                                          |

### WebSocket Broadcast After Mutations

After any mutation affecting live views:

```js
const wsHub = req.app.get("wsHub");
wsHub.broadcast("sales", { type: "order_created", data: { id: orderId } });
```

**Rooms and their consumers:**
| Room | Who listens |
|---|---|
| `sales` | OrdersPage, DashboardPage |
| `kot` | KOTPage |
| `kds` | KDSPage |
| `billing` | PaymentPage |
| `dashboard` | DashboardPage (stats_update) |

### Auth Middleware

```js
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate); // require valid JWT
router.delete("/:id", authorize("admin"), handler); // require admin role
```

`req.user` is set to `{ id, role, page_permissions }` after `authenticate`.

---

## Naming Conventions

### API Function Names (Frontend)

Verb-first, camelCase:

```
getOrders, getMenuItems, getDashboard
createOrder, createMenuItem
updateOrder, updateMenuItem
deleteOrder, deleteMenuItem
toggleMenuItem  (for enable/disable)
```

### Route Paths (Backend)

Plural nouns, kebab-case:

```
/api/menu-items      → menuitems.js
/api/purchase-orders → purchaseorders.js
/api/salary-mgmt     → salary_mgmt.js
/api/online-orders   → online_orders.js
```
