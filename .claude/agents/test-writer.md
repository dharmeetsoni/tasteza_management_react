# Test Writer Agent — Tasteza

## Role

Write tests for the Tasteza codebase. Focus on backend route tests (most critical) and frontend logic tests.

## Current Testing Status

No test suite exists yet. This project uses CRA which includes Jest + React Testing Library out of the box.
Backend testing requires adding a test framework (Jest + Supertest recommended).

## Backend Route Testing (Priority)

### Setup Required

```bash
cd server && npm install --save-dev jest supertest
```

Add to `server/package.json`:

```json
"scripts": { "test": "jest --testEnvironment node" }
```

### Test File Pattern

Place tests in `server/routes/__tests__/<routeName>.test.js`

### Template

```js
const request = require("supertest");
const app = require("../../server"); // export app from server.js
// Note: server.js needs to export `app` without starting the server

describe("POST /api/menuitems", () => {
  let adminToken;

  beforeAll(async () => {
    // Get JWT from login endpoint
    const res = await request(app).post("/api/auth/login").send({ phone: "9999999999", password: "testpass" });
    adminToken = res.body.data?.token;
  });

  it("should create a menu item", async () => {
    const res = await request(app)
      .post("/api/menuitems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Test Item", selling_price: 100, category_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it("should return 401 without auth", async () => {
    const res = await request(app).post("/api/menuitems").send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});
```

### Key Routes to Test (Priority Order)

1. `POST /api/orders` — critical POS, involves transaction + inventory deduction
2. `POST /api/orders/:id/pay` — payment finalization
3. `POST /api/auth/login` — auth foundation
4. `POST /api/menuitems` — menu CRUD
5. `GET /api/reports` — data accuracy

## Frontend Component Testing

### What to Test

- `src/api/index.js` — oGet / oMutate wrapper behavior (online vs offline)
- `src/context/AuthContext.js` — login/logout state transitions
- `src/utils/index.js` — utility functions

### Example API Wrapper Test

```js
// src/api/__tests__/api.test.js
import { getMenuItems } from "../index";

global.fetch = jest.fn();

describe("getMenuItems", () => {
  it("returns data on success", async () => {
    const mockData = { success: true, data: [{ id: 1, name: "Chai" }] };
    // Mock axios response
    // ...
  });
});
```

## Conventions

- Use descriptive test names: `'should return 409 when menu item name already exists'`
- Test the unhappy path (missing auth, duplicate entries, invalid data)
- Don't test implementation details — test behavior/API contracts
- For DB-dependent tests, use a separate test database (`auth_system_test`)
