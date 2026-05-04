import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useCart } from "../../context/CartContext";
import OrderTypeBanner from "../../components/order/OrderTypeBanner";
import CartDrawer from "../../components/order/CartDrawer";

// ── Addon selection bottom sheet ──────────────────────────
const AddonModal = ({ item, addonGroups, onConfirm, onCancel }) => {
  const [selections, setSelections] = React.useState({});

  const toggle = (group, addonItem) => {
    setSelections((prev) => {
      const cur = prev[group.id] || [];
      const exists = cur.find((i) => i.id === addonItem.id);
      if (exists) return { ...prev, [group.id]: cur.filter((i) => i.id !== addonItem.id) };
      if (group.max_select === 1) return { ...prev, [group.id]: [addonItem] };
      if (cur.length >= group.max_select) return prev;
      return { ...prev, [group.id]: [...cur, addonItem] };
    });
  };

  const canConfirm = addonGroups.every((g) => {
    if (!g.is_required) return true;
    return (selections[g.id] || []).length >= (g.min_select || 1);
  });

  const addonTotal = Object.values(selections)
    .flat()
    .reduce((s, a) => s + Number(a.price), 0);
  const totalPrice = Number(item.price) + addonTotal;

  return (
    <div style={am.overlay}>
      <div style={am.sheet}>
        <div style={am.header}>
          <div style={{ flex: 1 }}>
            <p style={am.itemName}>{item.name}</p>
            <p style={am.itemPrice}>&#8377;{Number(item.price).toFixed(0)}</p>
          </div>
          <button style={am.closeBtn} onClick={onCancel}>
            &#10005;
          </button>
        </div>
        <div style={am.body}>
          {addonGroups.map((group) => (
            <div key={group.id} style={{ marginBottom: 20 }}>
              <div style={am.groupTitle}>
                {group.name}
                {group.is_required ? <span style={am.reqBadge}>Required</span> : <span style={am.optBadge}>Optional</span>}
              </div>
              <p style={am.groupHint}>{group.max_select === 1 ? "Choose 1" : `Choose up to ${group.max_select}`}</p>
              {(group.items || []).map((ai) => {
                const selected = (selections[group.id] || []).find((i) => i.id === ai.id);
                return (
                  <div key={ai.id} style={{ ...am.addonItem, ...(selected ? am.addonSelected : {}) }} onClick={() => toggle(group, ai)}>
                    <div style={{ ...am.addonCheck, ...(selected ? am.addonCheckSel : {}) }}>
                      {selected && <span style={{ fontSize: 12 }}>&#10003;</span>}
                    </div>
                    <span style={am.addonName}>{ai.name}</span>
                    {Number(ai.price) > 0 && <span style={am.addonPrice}>+&#8377;{Number(ai.price).toFixed(0)}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={am.footer}>
          <button
            style={{ ...am.confirmBtn, opacity: canConfirm ? 1 : 0.55 }}
            disabled={!canConfirm}
            onClick={() => onConfirm(item, selections)}
          >
            Add to Cart &middot; &#8377;{totalPrice.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
};

const am = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 1000,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    background: "#fff",
    borderRadius: "20px 20px 0 0",
    width: "100%",
    maxWidth: 540,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
  },
  header: { padding: "16px 16px 12px", borderBottom: "1px solid #ebebeb", display: "flex", alignItems: "flex-start", gap: 12 },
  itemName: { margin: 0, fontWeight: 800, fontSize: 16, color: "#1c1c1c" },
  itemPrice: { margin: "4px 0 0", fontSize: 14, color: "#e23744", fontWeight: 700 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1.5px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: { overflowY: "auto", flex: 1, padding: "16px" },
  groupTitle: { fontSize: 14, fontWeight: 800, color: "#1c1c1c", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 },
  reqBadge: { fontSize: 10, background: "#fef2f2", color: "#dc2626", borderRadius: 20, padding: "2px 8px", fontWeight: 700 },
  optBadge: { fontSize: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 20, padding: "2px 8px", fontWeight: 700 },
  addonItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1.5px solid #e5e7eb",
    marginBottom: 8,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  addonSelected: { border: "1.5px solid #e23744", background: "#fff5f5" },
  addonCheck: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: "2px solid #d1d5db",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  addonCheckSel: { background: "#e23744", border: "2px solid #e23744", color: "#fff" },
  addonName: { flex: 1, fontSize: 13, fontWeight: 600, color: "#1c1c1c" },
  addonPrice: { fontSize: 13, fontWeight: 700, color: "#e23744" },
  footer: { padding: "12px 16px", borderTop: "1px solid #ebebeb" },
  confirmBtn: {
    width: "100%",
    padding: "14px",
    background: "#e23744",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
};

// ── Inline quantity stepper ───────────────────────────────
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
          onUpdate(cartItem.cartKey || cartItem.id, qty - 1);
        }}
      >
        {qty === 1 ? "🗑️" : "−"}
      </button>
      <span style={cs.stepQty}>{qty}</span>
      <button
        style={cs.stepBtn}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(cartItem.cartKey || cartItem.id, qty + 1);
        }}
      >
        +
      </button>
    </div>
  );
};

// ── Single menu card ──────────────────────────────────────
const MenuCard = React.memo(({ item, cartItem, courseColor, courseIcon, onAdd, onUpdate, isDineIn }) => {
  const inCart = (cartItem?.quantity || 0) > 0;
  return (
    <div style={{ ...cs.card, ...(inCart && !isDineIn ? cs.cardInCart : {}) }}>
      <div style={cs.imgWrap}>
        {item.image ? (
          <img src={item.image} alt={item.name} style={cs.img} loading="lazy" />
        ) : (
          <div style={{ ...cs.imgPlaceholder, background: courseColor ? courseColor + "18" : "#fff7ed" }}>
            <span style={{ fontSize: 38 }}>{courseIcon || "🍴"}</span>
          </div>
        )}
        <div style={{ ...cs.vegCorner, background: item.is_veg ? "#16a34a" : "#dc2626" }}>
          <div style={cs.vegCornerDot} />
        </div>
        {item.addon_group_ids?.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 7,
              right: 7,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              borderRadius: 6,
              padding: "2px 6px",
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            CUSTOMISABLE
          </div>
        )}
      </div>
      <div style={cs.body}>
        <div style={cs.nameRow}>
          <p style={cs.name}>{item.name}</p>
          {item.spice_level > 0 && (
            <span style={cs.spice}>{item.spice_level >= 3 ? "🌶🌶🌶" : item.spice_level === 2 ? "🌶🌶" : "🌶"}</span>
          )}
        </div>
        {item.description && <p style={cs.desc}>{item.description}</p>}
        <div style={cs.footer}>
          <span style={cs.price}>&#8377;{Number(item.price).toFixed(0)}</span>
          {!isDineIn && <QtyControl item={item} cartItem={cartItem} onAdd={onAdd} onUpdate={onUpdate} />}
        </div>
        {inCart && !isDineIn && <div style={cs.inCartBar} />}
      </div>
    </div>
  );
});

// ── Main page ─────────────────────────────────────────────
const OrderMenu = () => {
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [addonGroups, setAddonGroups] = useState({});
  const [addonModal, setAddonModal] = useState(null);
  const [branding, setBranding] = useState({ name: "Tasteza", sub: "Kitchen & Cafe", logo: null, color: "#e23744" });
  const courseBarRef = useRef(null);

  const { addItem, updateQuantity, state, totalItems, grandTotal } = useCart();
  const isDineIn = state.orderType === "dine_in";
  const cartMap = Object.fromEntries(state.items.map((i) => [i.id, i]));

  // Load restaurant branding
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setBranding({
            name: d.data.restaurant_name || "Tasteza",
            sub: d.data.tagline || "Kitchen & Cafe",
            logo: d.data.logo_base64 || null,
            color: d.data.primary_color || "#e23744",
          });
        }
      })
      .catch(() => {});
  }, []);

  // Load menu + addon groups
  useEffect(() => {
    Promise.all([axios.get("/api/public/menu"), axios.get("/api/public/addon-groups").catch(() => ({ data: { data: [] } }))])
      .then(([menuRes, addonRes]) => {
        const data = Array.isArray(menuRes.data) ? menuRes.data : menuRes.data?.data || [];
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

        const groups = addonRes.data?.data || [];
        const gmap = {};
        groups.forEach((g) => {
          gmap[g.id] = g;
        });
        setAddonGroups(gmap);
      })
      .catch((err) => setError(`Failed to load menu: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = useCallback(
    (item) => {
      const groupIds = item.addon_group_ids || [];
      const linkedGroups = groupIds.map((id) => addonGroups[id]).filter(Boolean);
      if (linkedGroups.length > 0) {
        setAddonModal({ item, groups: linkedGroups });
      } else {
        addItem({
          id: String(item.id),
          name: item.name,
          price: Number(item.price),
          gst_percent: Number(item.gst_percent || item.gst_rate || 0),
          quantity: 1,
          image: item.image,
          category: item.category,
          cartKey: String(item.id),
        });
      }
    },
    [addItem, addonGroups],
  );

  const handleAddonConfirm = useCallback(
    (item, selections) => {
      addItem({
        id: String(item.id),
        name: item.name,
        price: Number(item.price),
        gst_percent: Number(item.gst_percent || item.gst_rate || 0),
        quantity: 1,
        image: item.image,
        category: item.category,
        cartKey: String(item.id),
      });
      Object.values(selections)
        .flat()
        .forEach((addonItem) => {
          const cartKey = `addon_${addonItem.id}_${Date.now()}`;
          addItem({
            id: `addon_${addonItem.id}`,
            name: addonItem.name,
            price: Number(addonItem.price),
            quantity: 1,
            image: null,
            category: "Add-ons",
            cartKey,
            isAddon: true,
          });
        });
      setAddonModal(null);
    },
    [addItem],
  );

  const handleUpdate = useCallback(
    (id, qty) => {
      updateQuantity(id, qty);
    },
    [updateQuantity],
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
      {addonModal && (
        <AddonModal
          item={addonModal.item}
          addonGroups={addonModal.groups}
          onConfirm={handleAddonConfirm}
          onCancel={() => setAddonModal(null)}
        />
      )}

      {/* Top bar */}
      <div style={ps.topBar}>
        <div style={ps.brand}>
          {branding.logo ? (
            <img src={branding.logo} alt="logo" style={{ height: 40, width: "auto", objectFit: "contain", borderRadius: 6 }} />
          ) : (
            <span style={{ fontSize: 28 }}>🍽️</span>
          )}
          <div>
            <div style={{ ...ps.brandName, color: branding.color }}>{branding.name}</div>
            <div style={ps.brandSub}>{branding.sub}</div>
          </div>
        </div>
        {!isDineIn && (
          <button style={ps.cartBtn} onClick={() => setCartOpen(true)}>
            <span style={{ fontSize: 20 }}>🛒</span>
            {totalItems > 0 && <span style={ps.cartBadge}>{totalItems}</span>}
          </button>
        )}
      </div>

      <OrderTypeBanner search={search} onSearchChange={setSearch} />

      {/* Category tabs */}
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
                  ...(isActive ? { ...ps.courseTabActive, background: activeColor, boxShadow: `0 2px 10px ${activeColor}55` } : {}),
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

      {/* Menu content */}
      <div style={ps.content}>
        {loading && (
          <div style={ps.centerMsg}>
            <div style={ps.spinner} />
            <p style={{ color: "#9ca3af", marginTop: 14, fontSize: 15 }}>Loading menu&hellip;</p>
          </div>
        )}
        {!loading && error && (
          <div style={ps.centerMsg}>
            <p style={{ fontSize: 48 }}>&#128533;</p>
            <p style={{ color: "#ef4444", fontSize: 14, textAlign: "center", maxWidth: 280 }}>{error}</p>
            <button style={ps.retryBtn} onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={ps.centerMsg}>
            <p style={{ fontSize: 48 }}>&#127853;</p>
            <p style={{ color: "#9ca3af", fontSize: 15 }}>No dishes found</p>
          </div>
        )}
        {!loading &&
          !error &&
          grouped.map(({ course, items: groupItems }) => (
            <div key={course.name} style={ps.section}>
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

      {/* Sticky bottom cart bar */}
      {!isDineIn && totalItems > 0 && (
        <div style={ps.stickyBar} onClick={() => setCartOpen(true)}>
          <div style={ps.stickyLeft}>
            <div style={ps.stickyBadge}>{totalItems}</div>
            <span style={ps.stickyItemsText}>item{totalItems > 1 ? "s" : ""} added</span>
          </div>
          <span style={ps.stickyTitle}>View Cart</span>
          <span style={ps.stickyPrice}>&#8377;{grandTotal.toFixed(0)} &#8594;</span>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
};

// ── Card styles ───────────────────────────────────────────
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
  cardInCart: { border: "2px solid #e23744", boxShadow: "0 4px 16px rgba(226,55,68,0.15)" },
  imgWrap: { position: "relative", width: "100%", paddingBottom: "65%", overflow: "hidden", background: "#f5f5f5", flexShrink: 0 },
  img: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  imgPlaceholder: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" },
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
  vegCornerDot: { width: 9, height: 9, borderRadius: "50%", background: "#fff" },
  body: { padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  nameRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 },
  name: { margin: 0, fontWeight: 700, fontSize: 13, color: "#1c1c1c", lineHeight: 1.3, flex: 1 },
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
  footer: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 6 },
  price: { fontWeight: 800, fontSize: 15, color: "#1c1c1c" },
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
  stepper: { display: "flex", alignItems: "center", border: "2px solid #e23744", borderRadius: 10, overflow: "hidden", flexShrink: 0 },
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
  inCartBar: { height: 3, borderRadius: 2, background: "#e23744", marginTop: 6 },
};

// ── Page styles ───────────────────────────────────────────
const ps = {
  page: { minHeight: "100vh", background: "#f4f4f5", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' },
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
  brandName: { fontSize: 21, fontWeight: 900, lineHeight: 1.1, letterSpacing: -0.5 },
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
  courseBarWrap: { background: "#fff", borderBottom: "1px solid #ebebeb", position: "sticky", top: 56, zIndex: 200 },
  courseBar: { display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px", scrollbarWidth: "none" },
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
  courseTabActive: { color: "#fff", border: "1.5px solid transparent", fontWeight: 800 },
  content: { padding: "16px 12px 0" },
  centerMsg: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 10 },
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
  sectionHeader: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, paddingLeft: 4 },
  sectionAccent: { width: 5, height: 42, borderRadius: 8, flexShrink: 0, marginTop: 2 },
  sectionTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: "#1c1c1c", letterSpacing: -0.3 },
  sectionCount: { margin: "2px 0 0", fontSize: 12, color: "#93959f", fontWeight: 500 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 },
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
