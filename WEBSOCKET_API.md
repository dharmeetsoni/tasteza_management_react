# Tasteza WebSocket API
## Real-Time Sync for Android / iOS / External Apps

**Endpoint:** `ws://YOUR_SERVER_IP:3001/ws`

---

## 1. Connection & Authentication

Connect with JWT token in query string (recommended):
```
ws://192.168.1.100:3001/ws?token=YOUR_JWT_TOKEN
```

Or send auth message after connecting:
```json
{ "type": "auth", "token": "YOUR_JWT_TOKEN" }
```

Get token by calling REST API first:
```
POST http://192.168.1.100:3001/api/auth/login
{ "phone": "9999999999", "password": "admin123" }
→ { "token": "eyJ..." }
```

---

## 2. Subscribe to Rooms

After auth, subscribe to one or more rooms:
```json
{ "type": "subscribe", "rooms": ["sales", "kot", "billing", "dashboard"] }
```

**Available Rooms:**
| Room        | Who should subscribe          |
|-------------|-------------------------------|
| `sales`     | POS terminals, cashier apps   |
| `kot`       | Kitchen display, KOT printers |
| `billing`   | Bill display / customer screen|
| `dashboard` | Manager dashboards            |

Server confirms:
```json
{ "type": "subscribed", "rooms": ["sales", "kot"] }
```

---

## 3. Events You Will Receive

### Room: `sales`
```json
// New order created
{ "type": "order_created", "payload": { "id": 42, "order_number": "ORD-12345678", "table_id": 3 } }

// Order status changed (kot sent, billed)
{ "type": "order_updated", "payload": { "id": 42, "status": "kot" } }

// Order fully paid
{ "type": "order_paid",    "payload": { "id": 42, "payment_method": "upi" } }

// Order cancelled
{ "type": "order_cancelled","payload": { "id": 42 } }

// KOT status changed (from KOT manager)
{ "type": "kot_status",    "payload": { "id": 7, "status": "ready" } }
```

### Room: `kot`
```json
// New KOT fired from POS
{ "type": "kot_new",    "payload": { "kot_number": "KOT-123456", "order_id": 42, "table_id": 3 } }

// KOT status updated from kitchen
{ "type": "kot_status", "payload": { "id": 7, "status": "preparing" } }
```

### Room: `billing`
```json
// Bill generated (discounts applied)
{ "type": "bill_generated", "payload": { "order_id": 42, "total": 850.00 } }
```

### Room: `dashboard`
```json
// Trigger a stats refresh (no payload needed - just re-fetch /api/reports/dashboard)
{ "type": "stats_update", "payload": {} }
```

---

## 4. Keep-Alive Ping

Send every 30s to keep connection alive:
```json
{ "type": "ping" }
```
Server responds:
```json
{ "type": "pong" }
```

---

## 5. Android Example (Java/Kotlin)

```kotlin
// build.gradle: implementation 'org.java-websocket:Java-WebSocket:1.5.4'

class TastezaWSClient(
    serverUri: URI,
    private val token: String
) : WebSocketClient(serverUri) {

    override fun onOpen(handshakedata: ServerHandshake?) {
        // Subscribe to relevant rooms
        val msg = JSONObject().apply {
            put("type", "subscribe")
            put("rooms", JSONArray(listOf("kot", "sales")))
        }
        send(msg.toString())
    }

    override fun onMessage(message: String?) {
        val msg = JSONObject(message ?: return)
        when (msg.getString("type")) {
            "kot_new" -> {
                val payload = msg.getJSONObject("payload")
                // Show notification / print KOT
                onNewKOT(payload.getString("kot_number"))
            }
            "order_paid" -> {
                // Refresh orders list
                refreshOrders()
            }
            "stats_update" -> {
                // Re-fetch dashboard stats
                fetchDashboard()
            }
        }
    }

    override fun onClose(code: Int, reason: String?, remote: Boolean) {
        // Reconnect after 3 seconds
        Handler(Looper.getMainLooper()).postDelayed({ reconnect() }, 3000)
    }

    override fun onError(ex: Exception?) { ex?.printStackTrace() }
}

// Usage:
val wsUri = URI("ws://192.168.1.100:3001/ws?token=$jwtToken")
val client = TastezaWSClient(wsUri, jwtToken)
client.connect()
```

---

## 6. React Native Example

```javascript
import { useEffect, useRef } from 'react';

function useTastezaWS(token, onEvent) {
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://192.168.1.100:3001/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        rooms: ['sales', 'kot', 'billing', 'dashboard']
      }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      onEvent(msg);
    };

    ws.onclose = () => {
      setTimeout(() => {
        // reconnect
      }, 3000);
    };

    // Ping every 30s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => { clearInterval(ping); ws.close(); };
  }, [token]);

  return wsRef;
}
```

---

## 7. REST API Quick Reference

Base URL: `http://YOUR_IP:3001/api`

All requests (except login) need header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

| Endpoint                        | Method | Description              |
|---------------------------------|--------|--------------------------|
| `/auth/login`                   | POST   | Get JWT token            |
| `/orders`                       | GET    | All active orders        |
| `/orders`                       | POST   | Create order             |
| `/orders/:id/kot`               | POST   | Fire KOT                 |
| `/orders/:id/bill`              | POST   | Generate bill            |
| `/orders/:id/pay`               | POST   | Mark as paid             |
| `/kot`                          | GET    | All KOT tickets          |
| `/kot/:id/status`               | PATCH  | Update KOT status        |
| `/reports/dashboard`            | GET    | Dashboard stats          |
| `/tables`                       | GET    | All tables + status      |
| `/menuitems`                    | GET    | Full menu                |

---

## 8. Recommended App Roles

| App               | Subscribe Rooms         | Permissions  |
|-------------------|-------------------------|--------------|
| Waiter App        | `sales`                 | waiter role  |
| Kitchen Display   | `kot`                   | staff role   |
| Manager Dashboard | `dashboard`, `sales`    | manager role |
| Cashier / POS     | `sales`, `billing`      | staff role   |
| Customer Display  | `billing`               | read-only    |
