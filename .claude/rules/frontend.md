# Frontend Rules — Tasteza

## Design System

This project uses **zero CSS frameworks**. All styling is done via inline style objects.

### CSS Variables (defined in `src/index.css`)

| Variable         | Usage                                                    |
| ---------------- | -------------------------------------------------------- |
| `var(--accent)`  | Primary brand color (buttons, highlights, active states) |
| `var(--surface)` | Card/panel background                                    |
| `var(--ink)`     | Primary text color                                       |
| `var(--ink2)`    | Secondary/muted text                                     |
| `var(--border)`  | Dividers and input borders                               |
| `var(--bg)`      | Page background                                          |

**Never hardcode colors** like `#fff`, `#333`, `rgba(0,0,0,0.5)`. Use CSS variables.

### Common Style Patterns

```js
// Card / panel
style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem', border: '1px solid var(--border)' }}

// Primary button
style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}

// Ghost/secondary button
style={{ background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 6, padding: '0.5rem 1.25rem', cursor: 'pointer' }}

// Input field
style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}

// Section heading
style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 1rem' }}

// Muted label
style={{ fontSize: '0.8rem', color: 'var(--ink2)' }}
```

---

## Component Rules

### 1. Hooks Pattern for Data Loading

```js
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const { toast } = useToast();

const load = useCallback(async () => {
  setLoading(true);
  try {
    const d = await getXxx(params);
    if (d.success) setData(d.data);
  } catch {
    toast("Failed to load", "er");
  } finally {
    setLoading(false);
  }
}, [params]); // list actual dependencies

useEffect(() => {
  void load();
}, [load]);
```

### 2. API Response Checking

Always check `d.success` before using `d.data`:

```js
// CORRECT
const d = await createMenuItem(form);
if (d.success) {
  toast("Item created", "ok");
  load();
}

// WRONG — don't assume success
const d = await createMenuItem(form);
toast("Item created", "ok"); // could toast even on failure
```

### 3. Navigation

Admin pages are switched via `AppShell.js` internal state.  
To navigate programmatically from within a page component, use the `onNavigate` prop if it's passed down, or use `WSContext`/`ToastContext` patterns.  
**Do NOT use `useNavigate()` for admin-to-admin page transitions.**

### 4. Adding a New Admin Page

1. Create `src/components/pages/NewFeaturePage.js`
2. In `AppShell.js`:
   - Add to the `PAGES` array: `{ id: 'new_feature', label: 'New Feature', icon: '🔧', section: 'section_name' }`
   - Add to `ROLE_DEFAULTS.admin` (and `staff` if applicable)
   - Add to the render switch: `if (page === 'new_feature') return <NewFeaturePage />;`
3. Import the component at the top of `AppShell.js`

### 5. Toast Notifications

```js
const { toast } = useToast();
toast("Success message", "ok"); // green
toast("Info message", "info"); // blue
toast("Error message", "er"); // red
```

### 6. WebSocket Subscriptions

```js
import { useWSEvent } from "../../context/WSContext";

// Subscribe to an event
useWSEvent("order_created", (payload) => {
  setOrders((prev) => [payload.data, ...prev]);
});
```

---

## File Naming

- Page components: `PascalCase` — `InventoryPage.js`, `PurchaseOrderPage.js`
- Utility hooks/functions: `camelCase` — `useDataLoader.js`, `formatCurrency.js`
- Context files: `PascalCase + Context` — `AuthContext.js`, `ToastContext.js`

## Import Order (preferred)

1. React & hooks
2. Context imports
3. API imports
4. Child component imports
5. Utility imports
