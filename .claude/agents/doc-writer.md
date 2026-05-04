# Documentation Writer Agent — Tasteza

## Role

Write and maintain project documentation that is accurate, concise, and useful for developers working on the Tasteza codebase.

## Existing Documentation Files

| File               | Purpose                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `README.md`        | High-level project intro                                          |
| `SETUP.md`         | Local development setup guide                                     |
| `OFFLINE_SETUP.md` | XAMPP + offline deployment guide                                  |
| `HOW_TO_UPDATE.md` | How to update the system on-site                                  |
| `WEBSOCKET_API.md` | WebSocket message types and rooms                                 |
| `CLAUDE.md`        | Claude-specific project guide (architecture, patterns, templates) |

## Documentation Standards

### API Endpoint Documentation

Format for documenting an endpoint:

```
### POST /api/orders

Creates a new order. Requires authentication.

**Body:**
| Field | Type | Required | Description |
|---|---|---|---|
| table_id | int | No | Null for parcel/takeaway |
| order_type | string | Yes | 'dine_in' \| 'parcel' \| 'takeaway' |
| items | array | Yes | [{menu_item_id, quantity, unit_price}] |

**Response:** `{ success: true, data: { id, order_number } }`

**Side effects:**
- Broadcasts `order_created` to `sales` WebSocket room
- Deducts inventory for linked recipe ingredients
```

### Component Documentation

Only add JSDoc when the component's purpose is non-obvious:

```js
/**
 * Renders the KDS (Kitchen Display System) live order board.
 * Subscribes to 'kot_update' WebSocket events for real-time updates.
 * Does NOT poll — purely event-driven.
 */
export default function KDSPage() { ... }
```

Avoid redundant comments like `// sets loading to true`.

### Migration Documentation

When creating a migration file, add a comment at the top:

```sql
-- migration: add_coupon_usage_history
-- date: 2024-12-01
-- purpose: Track per-customer coupon redemptions for analytics
```

## What to Document

- New API endpoints (add to `WEBSOCKET_API.md` if WS-related, otherwise in a new `API.md`)
- New WebSocket event types
- Non-obvious business logic (GST back-calculation, inventory deduction rules)
- Setup steps for new dependencies
- Known gotchas (e.g., "migrations run alphabetically — prefix with date")

## What NOT to Document

- Self-evident code (avoid `// loop through items`)
- Internal implementation details that change frequently
- Replicate what `CLAUDE.md` already covers
