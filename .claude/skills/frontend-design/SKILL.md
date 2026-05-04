# Frontend Design Skill — Tasteza

## Overview

This skill covers how to design and implement UI components for the Tasteza Management System, which uses a fully custom inline-CSS design system without any third-party UI framework.

---

## Design System

### Color Tokens (CSS Variables)

All defined in `src/index.css`. Use these in every `style={{}}` prop:

| Token            | Use Case                               |
| ---------------- | -------------------------------------- |
| `var(--bg)`      | Page/app background                    |
| `var(--surface)` | Cards, panels, modals, inputs          |
| `var(--accent)`  | CTAs, active states, brand color       |
| `var(--ink)`     | Body text, headings                    |
| `var(--ink2)`    | Labels, placeholders, muted text       |
| `var(--border)`  | Input borders, dividers, card outlines |

**Never hardcode colors directly.** Always use these tokens.

### Typography Scale

```js
// Page title
style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}

// Section heading
style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)' }}

// Body text
style={{ fontSize: '0.95rem', color: 'var(--ink)' }}

// Label / caption
style={{ fontSize: '0.8rem', color: 'var(--ink2)' }}

// Small badge
style={{ fontSize: '0.7rem', fontWeight: 600 }}
```

### Spacing

Use multiples of `0.25rem` for padding/margin:

- Tight: `0.25rem` / `0.5rem`
- Component: `0.75rem` / `1rem`
- Section: `1.5rem` / `2rem`

### Border Radius

- Inputs, small buttons: `6px`
- Cards, panels: `10px` or `12px`
- Chips/badges: `20px` (pill)
- Round icons: `50%`

---

## Component Recipes

### Card / Panel

```jsx
<div
  style={{
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "1rem",
    marginBottom: "0.75rem",
  }}
>
  {/* content */}
</div>
```

### Page Header with Action Button

```jsx
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
  <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)" }}>Page Title</h2>
  <button
    onClick={handleAdd}
    style={{
      background: "var(--accent)",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "0.5rem 1.25rem",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "0.9rem",
    }}
  >
    + Add New
  </button>
</div>
```

### Form Field with Label

```jsx
<div style={{ marginBottom: "1rem" }}>
  <label style={{ display: "block", fontSize: "0.82rem", color: "var(--ink2)", marginBottom: 4 }}>Field Label</label>
  <input
    type="text"
    value={value}
    onChange={(e) => setValue(e.target.value)}
    style={{
      width: "100%",
      boxSizing: "border-box",
      padding: "0.5rem 0.75rem",
      borderRadius: 6,
      border: "1px solid var(--border)",
      background: "var(--surface)",
      color: "var(--ink)",
      fontSize: "0.95rem",
    }}
  />
</div>
```

### Select Dropdown

```jsx
<select
  value={value}
  onChange={(e) => setValue(e.target.value)}
  style={{
    width: "100%",
    boxSizing: "border-box",
    padding: "0.5rem 0.75rem",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: "0.95rem",
  }}
>
  <option value="">Select...</option>
  {options.map((o) => (
    <option key={o.id} value={o.id}>
      {o.name}
    </option>
  ))}
</select>
```

### Status Badge / Chip

```jsx
const STATUS_COLORS = {
  open: { bg: "#e8f5e9", color: "#2e7d32" },
  kot: { bg: "#fff3e0", color: "#e65100" },
  billed: { bg: "#e3f2fd", color: "#1565c0" },
  paid: { bg: "#f3e5f5", color: "#6a1b9a" },
  cancelled: { bg: "#fce4ec", color: "#c62828" },
};

const { bg, color } = STATUS_COLORS[status] || { bg: "#f5f5f5", color: "#555" };
<span
  style={{
    background: bg,
    color,
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: "0.75rem",
    fontWeight: 600,
  }}
>
  {status.charAt(0).toUpperCase() + status.slice(1)}
</span>;
```

### Table / List Row

```jsx
<div
  style={{
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 80px",
    gap: "0.5rem",
    alignItems: "center",
    padding: "0.75rem 1rem",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
  }}
>
  <span style={{ color: "var(--ink)", fontWeight: 500 }}>{item.name}</span>
  <span style={{ color: "var(--ink2)" }}>₹{item.price}</span>
  <StatusBadge status={item.status} />
  <button onClick={() => handleEdit(item.id)} style={{ ...ghostBtnStyle }}>
    Edit
  </button>
</div>
```

### Modal / Dialog

```jsx
{
  showModal && (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: "1.5rem",
          width: "90%",
          maxWidth: 480,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ margin: "0 0 1rem", color: "var(--ink)" }}>Modal Title</h3>
        {/* content */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button onClick={() => setShowModal(false)} style={{ ...ghostBtnStyle }}>
            Cancel
          </button>
          <button onClick={handleConfirm} style={{ ...primaryBtnStyle }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Loading State

```jsx
{loading ? (
  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink2)' }}>
    Loading…
  </div>
) : data.length === 0 ? (
  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink2)' }}>
    No records found.
  </div>
) : (
  /* render data */
)}
```

### Filter Row

```jsx
<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "center" }}>
  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, width: 140 }} />
  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, width: 140 }} />
  <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle, width: 160 }}>
    <option value="">All Statuses</option>
    <option value="open">Open</option>
    <option value="paid">Paid</option>
  </select>
  <button onClick={load} style={{ ...accentBtnStyle }}>
    Search
  </button>
</div>
```

---

## Layout Patterns

### Full-Page Container

```jsx
<div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto' }}>
```

### Two-Column Split (list + detail)

```jsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1rem", height: "calc(100vh - 120px)" }}>
  <div style={{ overflowY: "auto" }}>{/* list */}</div>
  <div style={{ overflowY: "auto" }}>{/* detail panel */}</div>
</div>
```

### KPI Card Row

```jsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
  {kpis.map((kpi) => (
    <div key={kpi.label} style={{ background: "var(--surface)", borderRadius: 10, padding: "1rem", border: "1px solid var(--border)" }}>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ink2)" }}>{kpi.label}</p>
      <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>{kpi.value}</p>
    </div>
  ))}
</div>
```

---

## Responsive Considerations

This app primarily runs on **tablets (landscape)** and **desktop monitors** in a restaurant setting. Design for:

- Minimum width: 800px (iPad landscape)
- Touch-friendly tap targets: minimum 44px height for interactive elements
- No reliance on hover states for critical functionality
