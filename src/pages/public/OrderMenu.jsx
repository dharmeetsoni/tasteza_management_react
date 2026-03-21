import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useCart } from "../../context/CartContext";
import OrderTypeBanner from "../../components/order/OrderTypeBanner";
import CartDrawer from "../../components/order/CartDrawer";

const SPICE_ICONS = ["", "🌶", "🌶🌶", "🌶🌶🌶"];

// ── Inline quantity stepper used on each card ──────────────
const QtyControl = ({ item, cartItem, onAdd, onUpdate }) => {
  const qty = cartItem?.quantity || 0;

  if (qty === 0) {
    return (
      <button
        style={cs.addBtn}
        onClick={(e) => {
          e.stopPropagation();
          onAdd(item);
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 800 }}>+</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>ADD</span>
      </button>
    );
  }

  return (
    <div style={cs.stepper}>
      <button
        style={cs.stepBtn}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(cartItem.id, qty - 1);
        }}
      >
        {qty === 1 ? "🗑" : "−"}
      </button>
      <span style={cs.stepQty}>{qty}</span>
      <button
        style={cs.stepBtn}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(cartItem.id, qty + 1);
        }}
      >
        +
      </button>
    </div>
  );
};

// ── Single menu card ───────────────────────────────────────
const MenuCard = React.memo(({ item, cartItem, courseColor, courseIcon, onAdd, onUpdate, isDineIn }) => {
  const inCart = (cartItem?.quantity || 0) > 0;

  return (
    <div style={{ ...cs.card, ...(inCart && !isDineIn ? cs.cardInCart : {}) }}>
      {/* Image */}
      <div style={cs.imgWrap}>
        {item.image ? (
          <img src={item.image} alt={item.name} style={cs.img} loading="lazy" />
        ) : (
          <div style={{ ...cs.imgPlaceholder, background: courseColor ? courseColor + "18" : "#fff7ed" }}>
            <span style={{ fontSize: 38 }}>{courseIcon || "🍴"}</span>
          </div>
        )}
        {/* Veg badge on image corner */}
        <div style={{ ...cs.vegCorner, background: item.is_veg ? "#16a34a" : "#dc2626" }}>
          <div style={cs.vegCornerDot} />
        </div>
      </div>

      {/* Card body — all content + button here, no floating */}
      <div style={cs.body}>
        {/* Name + spice */}
        <div style={cs.nameRow}>
          <p style={cs.name}>{item.name}</p>
          {item.spice_level > 0 && <span style={cs.spice}>{SPICE_ICONS[Math.min(item.spice_level, 3)]}</span>}
        </div>

        {/* Description */}
        {item.description && <p style={cs.desc}>{item.description}</p>}

        {/* Price row + ADD button — always at bottom */}
        <div style={cs.footer}>
          <div>
            <span style={cs.price}>₹{Number(item.price).toFixed(0)}</span>
            {item.gst_percent > 0 && <span style={cs.gstNote}> +{item.gst_percent}%</span>}
          </div>
          {/* Hide qty control for Dine In */}
          {!isDineIn && <QtyControl item={item} cartItem={cartItem} onAdd={onAdd} onUpdate={onUpdate} />}
        </div>

        {/* In-cart indicator */}
        {inCart && !isDineIn && <div style={cs.inCartBar} />}
      </div>
    </div>
  );
});

// ── Main page ──────────────────────────────────────────────
const OrderMenu = () => {
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const courseBarRef = useRef(null);

  const { addItem, updateQuantity, state, totalItems, grandTotal } = useCart();
  const isDineIn = state.orderType === "dine_in";

  // Build a quick lookup: itemId → cartItem
  const cartMap = Object.fromEntries(state.items.map((i) => [i.id, i]));

  useEffect(() => {
    axios
      .get("/api/public/menu")
      .then((res) => {
        console.log("[OrderMenu] API response:", res.data);
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setItems(data);

        const seen = new Set();
        const cats = [];
        data.forEach((i) => {
          const cat = i.category || i.course_name || i.course;
          if (cat && !seen.has(cat)) {
            seen.add(cat);
            cats.push({ name: cat, icon: i.course_icon, color: i.course_color, sort: i.course_sort ?? 99 });
          }
        });
        cats.sort((a, b) => a.sort - b.sort);
        setCourses(cats);
      })
      .catch((err) => {
        console.error("[OrderMenu] API error:", err.response?.status, err.response?.data || err.message);
        setError(`Failed to load menu: ${err.response?.data?.message || err.message}`);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = useCallback(
    (item) => {
      addItem({ id: String(item.id), name: item.name, price: Number(item.price), quantity: 1, image: item.image, category: item.category });
    },
    [addItem]
  );

  const handleUpdate = useCallback(
    (id, qty) => {
      updateQuantity(id, qty);
    },
    [updateQuantity]
  );

  const filtered = items.filter((item) => {
    const itemCat = item.category || item.course_name || item.course || "";
    const matchCourse = activeCourse === "All" || itemCat === activeCourse;
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase());
    return matchCourse && matchSearch;
  });

  const grouped =
    activeCourse === "All"
      ? courses.reduce((acc, c) => {
          const courseItems = filtered.filter((i) => (i.category || i.course_name || i.course) === c.name);
          if (courseItems.length) acc.push({ course: c, items: courseItems });
          return acc;
        }, [])
      : [{ course: courses.find((c) => c.name === activeCourse) || { name: activeCourse }, items: filtered }];

  const allTabs = [{ name: "All", icon: null, color: null }, ...courses];

  return (
    <div style={ps.page}>
      {/* ── Top bar ── */}
      <div style={ps.topBar}>
        <div style={ps.brand}>
          <span style={{ fontSize: 28 }}>🍽️</span>
          <div>
            <div style={ps.brandName}>Tasteza</div>
            <div style={ps.brandSub}>Kitchen &amp; Cafe</div>
          </div>
        </div>
        {/* Cart icon hidden for Dine In */}
        {!isDineIn && (
          <button style={ps.cartBtn} onClick={() => setCartOpen(true)}>
            <span style={{ fontSize: 20 }}>🛒</span>
            {totalItems > 0 && <span style={ps.cartBadge}>{totalItems}</span>}
          </button>
        )}
      </div>

      {/* ── Compact strip: order type pills + inline search ── */}
      <OrderTypeBanner search={search} onSearchChange={setSearch} />

      {/* ── Category tabs — pill style, only ONE can be active ── */}
      <div style={ps.courseBarWrap} ref={courseBarRef}>
        <div style={ps.courseBar}>
          {allTabs.map((c) => {
            const isActive = activeCourse === c.name;
            const activeColor = c.color || "#e23744";
            return (
              <button
                key={c.name}
                style={{
                  ...ps.courseTab,
                  ...(isActive
                    ? {
                        ...ps.courseTabActive,
                        background: activeColor,
                        boxShadow: `0 2px 10px ${activeColor}55`,
                      }
                    : {}),
                }}
                onClick={() => setActiveCourse(c.name)}
              >
                {c.icon && <span style={{ marginRight: 4 }}>{c.icon}</span>}
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Menu content ── */}
      <div style={ps.content}>
        {loading && (
          <div style={ps.centerMsg}>
            <div style={ps.spinner} />
            <p style={{ color: "#9ca3af", marginTop: 14, fontSize: 15 }}>Loading menu…</p>
          </div>
        )}

        {!loading && error && (
          <div style={ps.centerMsg}>
            <p style={{ fontSize: 48 }}>😕</p>
            <p style={{ color: "#ef4444", fontSize: 14, textAlign: "center", maxWidth: 280 }}>{error}</p>
            <button style={ps.retryBtn} onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={ps.centerMsg}>
            <p style={{ fontSize: 48 }}>🍽️</p>
            <p style={{ color: "#9ca3af", fontSize: 15 }}>No dishes found</p>
          </div>
        )}

        {!loading &&
          !error &&
          grouped.map(({ course, items: groupItems }) => (
            <div key={course.name} style={ps.section}>
              {/* Section header */}
              <div style={ps.sectionHeader}>
                <div style={{ ...ps.sectionAccent, background: course.color || "#e23744" }} />
                <div>
                  <h2 style={ps.sectionTitle}>
                    {course.icon && <span style={{ marginRight: 6 }}>{course.icon}</span>}
                    {course.name}
                  </h2>
                  <p style={ps.sectionCount}>
                    {groupItems.length} item{groupItems.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Cards grid */}
              <div style={ps.grid}>
                {groupItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    cartItem={cartMap[String(item.id)]}
                    courseColor={course.color}
                    courseIcon={course.icon}
                    onAdd={handleAdd}
                    onUpdate={handleUpdate}
                    isDineIn={isDineIn}
                  />
                ))}
              </div>
            </div>
          ))}

        <div style={{ height: 100 }} />
      </div>

      {/* ── Sticky bottom cart bar ── */}
      {!isDineIn && totalItems > 0 && (
        <div style={ps.stickyBar} onClick={() => setCartOpen(true)}>
          <div style={ps.stickyLeft}>
            <div style={ps.stickyBadge}>{totalItems}</div>
            <span style={ps.stickyItemsText}>item{totalItems > 1 ? "s" : ""} added</span>
          </div>
          <span style={ps.stickyTitle}>View Cart</span>
          <span style={ps.stickyPrice}>₹{grandTotal.toFixed(0)} →</span>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
};

// ── Card styles ────────────────────────────────────────────
const cs = {
  card: {
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    border: "2px solid transparent",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  cardInCart: {
    border: "2px solid #e23744",
    boxShadow: "0 4px 16px rgba(226,55,68,0.15)",
  },
  imgWrap: {
    position: "relative",
    width: "100%",
    paddingBottom: "65%",
    overflow: "hidden",
    background: "#f5f5f5",
    flexShrink: 0,
  },
  img: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  imgPlaceholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  vegCorner: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 18,
    height: 18,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
  },
  vegCornerDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "#fff",
  },
  body: {
    padding: "10px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: 1,
  },
  nameRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 4,
  },
  name: {
    margin: 0,
    fontWeight: 700,
    fontSize: 13,
    color: "#1c1c1c",
    lineHeight: 1.3,
    flex: 1,
  },
  spice: { fontSize: 11, flexShrink: 0, marginTop: 1 },
  desc: {
    margin: 0,
    fontSize: 11,
    color: "#93959f",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 6,
  },
  price: { fontWeight: 800, fontSize: 15, color: "#1c1c1c" },
  gstNote: { fontSize: 10, color: "#93959f" },

  // ADD button
  addBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    background: "#fff",
    border: "2px solid #e23744",
    borderRadius: 10,
    cursor: "pointer",
    color: "#e23744",
    gap: 1,
    flexShrink: 0,
  },
  // Stepper (already in cart)
  stepper: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #e23744",
    borderRadius: 10,
    overflow: "hidden",
    flexShrink: 0,
  },
  stepBtn: {
    width: 30,
    height: 48,
    background: "#fff",
    border: "none",
    color: "#e23744",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stepQty: {
    minWidth: 28,
    textAlign: "center",
    background: "#e23744",
    color: "#fff",
    fontWeight: 900,
    fontSize: 14,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
  inCartBar: {
    height: 3,
    borderRadius: 2,
    background: "#e23744",
    marginTop: 6,
  },
};

// ── Page-level styles ──────────────────────────────────────
const ps = {
  page: {
    minHeight: "100vh",
    background: "#f4f4f5",
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  },
  topBar: {
    background: "#fff",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    position: "sticky",
    top: 0,
    zIndex: 300,
  },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandName: { fontSize: 21, fontWeight: 900, color: "#e23744", lineHeight: 1.1, letterSpacing: -0.5 },
  brandSub: { fontSize: 10, color: "#93959f", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 500 },
  cartBtn: {
    position: "relative",
    width: 44,
    height: 44,
    background: "#fff5f5",
    border: "1.5px solid #fecaca",
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    background: "#e23744",
    color: "#fff",
    borderRadius: "50%",
    width: 20,
    height: 20,
    fontSize: 11,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  courseBarWrap: {
    background: "#fff",
    borderBottom: "1px solid #ebebeb",
    position: "sticky",
    top: 56,
    zIndex: 200,
  },
  courseBar: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    padding: "10px 12px",
    scrollbarWidth: "none",
  },
  courseTab: {
    whiteSpace: "nowrap",
    padding: "8px 16px",
    borderRadius: 20,
    border: "1.5px solid #e5e7eb",
    background: "#f4f4f5",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#6b7280",
    transition: "all 0.15s",
    flexShrink: 0,
  },
  courseTabActive: {
    color: "#fff",
    border: "1.5px solid transparent",
    fontWeight: 800,
  },

  content: { padding: "16px 12px 0" },
  centerMsg: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    gap: 10,
  },
  spinner: {
    width: 38,
    height: 38,
    border: "3px solid #fecaca",
    borderTopColor: "#e23744",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  retryBtn: {
    marginTop: 8,
    padding: "10px 28px",
    background: "#e23744",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  section: { marginBottom: 28 },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    paddingLeft: 4,
  },
  sectionAccent: {
    width: 5,
    height: 42,
    borderRadius: 8,
    flexShrink: 0,
    marginTop: 2,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#1c1c1c",
    letterSpacing: -0.3,
  },
  sectionCount: {
    margin: "2px 0 0",
    fontSize: 12,
    color: "#93959f",
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 16,
  },
  stickyBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#e23744",
    color: "#fff",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 400,
    cursor: "pointer",
    boxShadow: "0 -4px 20px rgba(226,55,68,0.35)",
  },
  stickyLeft: { display: "flex", alignItems: "center", gap: 10 },
  stickyBadge: {
    background: "#fff",
    color: "#e23744",
    borderRadius: 6,
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 13,
  },
  stickyItemsText: { fontSize: 13, fontWeight: 600, opacity: 0.9 },
  stickyTitle: { fontSize: 16, fontWeight: 900, letterSpacing: 0.2 },
  stickyPrice: { fontSize: 15, fontWeight: 800 },
};

export default OrderMenu;
