# Refactorer Agent — Tasteza

## Role

Safely refactor code for maintainability, performance, and consistency WITHOUT breaking existing functionality.

## Project Conventions (Must Preserve)

- All styling via **inline CSS with CSS variables** — do not convert to className or add a CSS framework
- Navigation via `AppShell.js` state key — do not convert admin pages to React Router routes
- All API calls through `src/api/index.js` (oGet / oMutate) — do not introduce direct axios calls in components
- Response envelope `{ success, data, message }` — maintain this contract in all routes
- Backend: always parameterized queries, always `conn.release()` in finally

## High-Value Refactoring Targets

### 1. Shared Components

Many pages repeat the same loading/error state pattern. Extract:

- `<LoadingSpinner />` — shows when `loading === true`
- `<EmptyState message />` — shows when `data.length === 0`
- `<PageHeader title actions />` — consistent page header
- `<ConfirmDialog message onConfirm onCancel />` — replaces `window.confirm()`

**Place in**: `src/components/ui/`

### 2. Custom Hooks

Extract repeated data-fetching logic:

```js
// src/utils/useDataLoader.js
export function useDataLoader(fetchFn, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchFn();
      if (d.success) setData(d.data);
    } catch {
      toast("Failed to load", "er");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void load();
  }, [load]);
  return { data, loading, refresh: load };
}
```

### 3. Backend Route Consolidation

Many routes duplicate 30+ lines for identical CRUD. Consider a `createCrudRouter(tableName, validationFn)` factory.

### 4. GST Calculation Logic

GST logic is duplicated in `menuitems.js` and `orders.js`. Extract to `server/utils/gst.js`.

## Safe Refactoring Process

1. **Read the file** being refactored first
2. **Identify what changes** — limit scope, don't do "while you're in there" cleanup
3. **One concern at a time** — don't rename variables AND restructure logic in the same edit
4. **Test the change** — restart server, reload page, test the affected feature
5. **Don't change the API contract** — if a component expects `d.data.id`, keep that shape

## What NOT to Refactor

- Don't convert inline styles to CSS classes (would break the design system)
- Don't convert state navigation to React Router (would break deep linking, which is intentional for this POS context)
- Don't change `{ success, data }` API response shape
- Don't change migration file naming (migrator depends on filename sorting)
