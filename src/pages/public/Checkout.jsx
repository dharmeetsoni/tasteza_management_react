import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useCart } from "../../context/CartContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";

const Checkout = () => {
  const { state, subtotal, deliveryCharge, grandTotal, clearCart } = useCart();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePlaceOrder = async () => {
    if (state.orderType === "delivery" && !address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/api/online-orders", {
        items: state.items.map((i) => ({ menu_item_id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        order_type: state.orderType,
        table_number: state.tableNumber || null,
        delivery_address: address || null,
        notes,
        subtotal,
        delivery_charge: deliveryCharge,
        total: grandTotal,
        customer_name: customer?.name || "Guest",
        customer_phone: customer?.phone || null,
        customer_id: customer?.id || null,
      });
      const orderId = res.data.order_id || res.data.id || res.data.orderId || "NEW";
      clearCart();
      navigate(`/order/confirmation/${orderId}`);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (state.items.length === 0)
    return (
      <div style={styles.page}>
        <div style={styles.empty}>
          <p style={{ fontSize: 64 }}>🛒</p>
          <h2>Your cart is empty</h2>
          <button style={styles.primaryBtn} onClick={() => navigate("/order")}>
            Browse Menu
          </button>
        </div>
      </div>
    );

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button style={styles.backLink} onClick={() => navigate("/order")}>
          ← Menu
        </button>
        <h1 style={styles.pageTitle}>Checkout</h1>
        <div />
      </div>
      <div style={styles.content}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Order Type</h3>
          <div style={styles.badge}>{(state.orderType || "").replace("_", " ")}</div>
          {state.tableNumber && (
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6b7280" }}>
              Table: <strong>{state.tableNumber}</strong>
            </p>
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Items</h3>
          {state.items.map((item) => (
            <div key={item.id} style={styles.itemRow}>
              <span style={styles.itemQty}>{item.quantity}×</span>
              <span style={{ flex: 1, fontSize: 14 }}>{item.name}</span>
              <span style={{ fontWeight: 600, color: "#f97316", fontSize: 14 }}>₹{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {state.orderType === "delivery" && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Delivery Address *</h3>
            <textarea
              style={styles.textarea}
              rows={3}
              placeholder="Enter your full delivery address…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        )}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Special Instructions</h3>
          <textarea
            style={styles.textarea}
            rows={2}
            placeholder="Any special requests? (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div style={styles.summaryBox}>
          <div style={styles.summaryRow}>
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {deliveryCharge > 0 && (
            <div style={styles.summaryRow}>
              <span>Delivery</span>
              <span>₹{deliveryCharge.toFixed(2)}</span>
            </div>
          )}
          <div
            style={{
              ...styles.summaryRow,
              fontWeight: 700,
              fontSize: 16,
              color: "#111827",
              paddingTop: 8,
              borderTop: "1px solid #e5e7eb",
              marginTop: 4,
            }}
          >
            <span>Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={{ ...styles.primaryBtn, width: "100%", padding: 15, fontSize: 17, opacity: loading ? 0.7 : 1 }}
          onClick={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? "Placing Order…" : `Place Order · ₹${grandTotal.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: { minHeight: "100vh", background: "#f9fafb" },
  topBar: {
    background: "#fff",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  backLink: { background: "none", border: "none", cursor: "pointer", color: "#f97316", fontWeight: 600, fontSize: 15 },
  pageTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
  content: { maxWidth: 540, margin: "0 auto", padding: "16px 16px 32px" },
  section: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  sectionTitle: { margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#374151" },
  badge: {
    display: "inline-block",
    background: "#fff7ed",
    color: "#ea580c",
    border: "1px solid #fed7aa",
    borderRadius: 6,
    padding: "4px 12px",
    fontWeight: 600,
    fontSize: 14,
    textTransform: "capitalize",
  },
  itemRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  itemQty: { background: "#f3f4f6", borderRadius: 4, padding: "2px 6px", fontWeight: 700, fontSize: 13 },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },
  summaryBox: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  summaryRow: { display: "flex", justifyContent: "space-between", fontSize: 14, color: "#374151", marginBottom: 8 },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 12,
  },
  primaryBtn: { background: "#f97316", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 8 },
};

export default Checkout;
