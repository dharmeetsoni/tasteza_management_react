import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const STATUS_MAP = {
  pending: { label: "Pending ⏳", color: "#f59e0b", bg: "#fef3c7" },
  confirmed: { label: "Confirmed ✓", color: "#16a34a", bg: "#dcfce7" },
  preparing: { label: "Preparing 🍳", color: "#f97316", bg: "#fff7ed" },
  ready: { label: "Ready! 🎉", color: "#7c3aed", bg: "#f5f3ff" },
  delivered: { label: "Delivered ✓", color: "#16a34a", bg: "#dcfce7" },
};

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || orderId === "NEW") {
      setLoading(false);
      return;
    }
    axios
      .get(`/api/online-orders/${orderId}`)
      .then((res) => setOrder(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  const status = STATUS_MAP[order?.status] || STATUS_MAP.pending;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <h1 style={styles.title}>Order Placed!</h1>
        <p style={{ color: "#6b7280", margin: "0 0 20px" }}>Thank you for your order</p>

        {orderId && orderId !== "NEW" && (
          <div style={styles.idBox}>
            <span style={{ color: "#6b7280", fontSize: 13 }}>Order ID</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#f97316" }}>#{orderId}</span>
          </div>
        )}

        {order && (
          <>
            <div style={{ ...styles.statusBadge, background: status.bg, color: status.color }}>{status.label}</div>
            <div style={styles.details}>
              <div style={styles.detailRow}>
                <span>Type</span>
                <span style={{ textTransform: "capitalize" }}>{(order.order_type || "").replace("_", " ")}</span>
              </div>
              {order.table_number && (
                <div style={styles.detailRow}>
                  <span>Table</span>
                  <span>{order.table_number}</span>
                </div>
              )}
              <div style={styles.detailRow}>
                <span>Total</span>
                <span style={{ fontWeight: 700, color: "#f97316" }}>₹{Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {loading && <p style={{ color: "#6b7280", fontSize: 14 }}>Loading details…</p>}

        <div style={styles.info}>📱 Your order is being prepared. We'll notify you when it's ready!</div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={styles.primaryBtn} onClick={() => navigate("/order")}>
            Order More
          </button>
          <button style={styles.secondaryBtn} onClick={() => window.print()}>
            🖨️ Print
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#fff7ed,#fef9f0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
    textAlign: "center",
  },
  title: { margin: "8px 0 4px", fontSize: 28, fontWeight: 800, color: "#111827" },
  idBox: {
    background: "#f9fafb",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: { display: "inline-block", borderRadius: 20, padding: "6px 20px", fontWeight: 700, fontSize: 15, marginBottom: 20 },
  details: { background: "#f9fafb", borderRadius: 10, padding: "12px 16px", marginBottom: 16, textAlign: "left" },
  detailRow: { display: "flex", justifyContent: "space-between", fontSize: 14, color: "#374151", padding: "4px 0" },
  info: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 20,
    fontSize: 14,
    color: "#92400e",
  },
  primaryBtn: {
    flex: 1,
    padding: 12,
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "12px 16px",
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
};

export default OrderConfirmation;
