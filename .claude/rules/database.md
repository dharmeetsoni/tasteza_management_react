# Database Rules — Tasteza

## Database

- **Engine**: MySQL (XAMPP)
- **Database name**: `auth_system`
- **Driver**: `mysql2/promise` connection pool
- **Pool config**: `server/config/db.js`

---

## Query Rules

### 1. Always Parameterize

```js
// CORRECT
const [rows] = await db.query("SELECT * FROM orders WHERE id = ? AND status = ?", [id, status]);

// WRONG — SQL injection risk
const [rows] = await db.query(`SELECT * FROM orders WHERE id = ${id}`);
```

### 2. Simple Queries

```js
const [rows] = await db.query("SELECT * FROM menu_items WHERE is_active = 1");
const [result] = await db.query("INSERT INTO menu_items SET ?", [dataObject]);
// result.insertId, result.affectedRows available
```

### 3. Transaction Pattern (Always Use This)

```js
const conn = await db.getConnection();
try {
  await conn.beginTransaction();

  const [r1] = await conn.query("INSERT INTO orders SET ?", [orderData]);
  const orderId = r1.insertId;

  for (const item of items) {
    await conn.query("INSERT INTO order_items SET ?", [{ ...item, order_id: orderId }]);
  }

  await conn.commit();
  res.json({ success: true, data: { id: orderId } });
} catch (err) {
  await conn.rollback();
  res.status(500).json({ success: false, message: err.message });
} finally {
  conn.release(); // CRITICAL — always release, even on error
}
```

---

## Schema Conventions

### Column Naming: `snake_case`

- IDs: `id` (auto-increment PK), foreign keys: `table_name_id` (e.g., `order_id`, `menu_item_id`)
- Timestamps: `created_at`, `updated_at`, `paid_at`, `billed_at`
- Boolean flags: `is_active`, `is_default`, `price_includes_gst`
- Status ENUMs: `status ENUM('open','kot','billed','paid','cancelled')`

### Every Table Should Have

```sql
id INT AUTO_INCREMENT PRIMARY KEY,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Soft Delete Pattern

Prefer `is_active = 0` over `DELETE` for reference data (menu items, staff, vendors).
Use hard `DELETE` only for transactional records where cascade is correct.

### Foreign Keys

```sql
order_id INT NOT NULL,
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
-- Use ON DELETE CASCADE for child records (order_items → orders)
-- Use ON DELETE RESTRICT (default) for reference data (menu_items → menu_courses)
-- Use ON DELETE SET NULL for soft links (staff → salary_records)
```

---

## Migration Rules

### File Location

`server/migrations/YYYYMMDD_description.sql`  
Example: `server/migrations/20241201_add_coupon_history.sql`

### Always Idempotent

```sql
-- Adding a table
CREATE TABLE IF NOT EXISTS new_table (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adding a column
ALTER TABLE existing_table
  ADD COLUMN IF NOT EXISTS new_column VARCHAR(100) DEFAULT NULL;

-- Adding an index
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
```

### Add Comment Header

```sql
-- migration: add_coupon_history_table
-- date: 2024-12-01
-- purpose: Track individual coupon redemptions per customer
```

### NEVER Edit `schema.sql`

`schema.sql` is the initial schema snapshot. All changes go in `migrations/`.

---

## Key Tables Reference

| Table             | Purpose              | Key Columns                                                              |
| ----------------- | -------------------- | ------------------------------------------------------------------------ |
| `orders`          | POS orders           | `order_number`, `status`, `order_type`, `total_amount`, `table_id`       |
| `order_items`     | Line items per order | `order_id`, `menu_item_id`, `quantity`, `unit_price`, `gst_amount`       |
| `menu_items`      | Menu catalog         | `name`, `selling_price`, `price_with_gst`, `gst_percent`, `is_active`    |
| `menu_courses`    | Menu sections        | `name`, `sort_order`                                                     |
| `inventory_items` | Stock items          | `name`, `quantity`, `unit_id`, `reorder_level`, `category_id`            |
| `recipes`         | Recipe → ingredients | linked via `recipe_ingredients` to `inventory_items`                     |
| `staff`           | Employees            | `name`, `role`, `phone`, `salary_type`                                   |
| `users`           | System logins        | `phone` (unique), `password` (bcrypt), `role`, `page_permissions` (JSON) |
| `coupons`         | Discounts            | `code` (unique), `discount_type`, `usage_limit`, `used_count`            |
| `expenses`        | Operational costs    | `amount`, `category_id`, `date`                                          |
| `purchase_orders` | Stock purchase       | `vendor_id`, `status`, `total_amount`                                    |
| `kot_tickets`     | Kitchen tickets      | `order_id`, `kot_number`, `status`                                       |

## Useful Queries

```sql
-- Check migration status
SELECT * FROM _migrations ORDER BY executed_at DESC;

-- Find failed migrations
SELECT * FROM _migrations WHERE status = 'error';

-- Check table structure
DESCRIBE orders;

-- Show all tables
SHOW TABLES;
```
