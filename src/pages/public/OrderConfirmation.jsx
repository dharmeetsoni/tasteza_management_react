import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getOnlineOrder } from "../../api";

const STEPS = [
  { key: "pending", label: "Order Placed", icon: "📋" },
  { key: "confirmed", label: "Confirmed", icon: "✅" },
  { key: "preparing", label: "Preparing", icon: "🍳" },
  { key: "ready", label: "Ready", icon: "🔔" },
  { key: "delivered", label: "Done", icon: "🏁" },
];

const stepIndex = (status) => {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
};

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);
  const pollRef = useRef(null);

  const fetchOrder = async () => {
    try {
      const d = await getOnlineOrder(orderId);
      if (d.success) setOrder(d.data);
    } catch {}
  };

  useEffect(() => {
    if (!orderId || orderId === "NEW") {
      setLoading(false);
      return;
    }
    fetchOrder().finally(() => setLoading(false));
  }, [orderId]);

  // WebSocket live tracking
  useEffect(() => {
    if (!orderId || orderId === "NEW") return;
    const try_ws = () => {
      try {
        const ws = new WebSocket(`ws://${window.location.hostname}:3001/ws`);
        wsRef.current = ws;
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "order_status_updated" && String(msg.data?.id) === String(orderId)) {
              setOrder((prev) => ({ ...prev, status: msg.data.status }));
            }
          } catch {}
        };
        ws.onclose = () => {
          // Fall back to polling
          pollRef.current = setInterval(fetchOrder, 15000);
        };
      } catch {
        pollRef.current = setInterval(fetchOrder, 15000);
      }
    };
    try_ws();
    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId]);

  const curStep = order ? stepIndex(order.status) : 0;
  const isDelivery = order?.order_type === "delivery";

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>🎉</div>
        <h1 style={st.title}>Order Placed!</h1>
        {orderId && orderId !== "NEW" && <p style={st.orderId}>Order #{orderId}</p>}
        <p style={{ color: "#9ca3af", margin: "0 0 24px", fontSize: 13 }}>Thank you for your order</p>

        {/* Status tracker */}
        <div style={st.tracker}>
          {STEPS.filter((s, i) => i <= (isDelivery ? STEPS.length - 1 : STEPS.length - 2)).map((step, i) => {
            const done = i <= curStep;
            const active = i === curStep;
            return (
              <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div style={{ ...st.dot, ...(active ? st.dotActive : done ? st.dotDone : {}) }}>{done || active ? step.icon : ""}</div>
                <span style={{ ...st.dotLabel, fontWeight: active ? 800 : 500, color: active ? "#e23744" : done ? "#16a34a" : "#9ca3af" }}>
                  {step.label}
                </span>
                {i < STEPS.length - 2 && <div style={{ ...st.connector, background: done ? "#16a34a" : "#e5e7eb" }} />}
              </div>
            );
          })}
        </div>

        {order && (
          <div style={st.details}>
            <div style={st.detailRow}>
              <span>Type</span>
              <span style={{ textTransform: "capitalize" }}>{(order.order_type || "").replace("_", " ")}</span>
            </div>
            {order.table_number && (
              <div style={st.detailRow}>
                <span>Table</span>
                <span>{order.table_number}</span>
              </div>
            )}
            {order.customer_name && (
              <div style={st.detailRow}>
                <span>Name</span>
                <span>{order.customer_name}</span>
              </div>
            )}
            <div style={st.detailRow}>
              <span>Total</span>
              <span style={{ fontWeight: 800, color: "#e23744" }}>&#8377;{Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        )}

        {loading && <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading details&hellip;</p>}

        <div style={st.infoBox}>&#128241; We&rsquo;ll update the status above in real time!</div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={st.primaryBtn} onClick={() => navigate("/order")}>
            Order More
          </button>
          <button style={st.secondaryBtn} onClick={() => window.print()}>
            &#128438; Print
          </button>
        </div>
      </div>
    </div>
  );
};

const st = {
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
    padding: "32px 24px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
    textAlign: "center",
  },
  title: { margin: "8px 0 2px", fontSize: 26, fontWeight: 900, color: "#1c1c1c" },
  orderId: { margin: "0 0 8px", fontWeight: 800, fontSize: 20, color: "#e23744" },
  tracker: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 4,
    position: "relative",
  },
  dot: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#f4f4f5",
    border: "2px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    marginBottom: 4,
    zIndex: 1,
  },
  dotActive: { background: "#fff5f5", border: "2px solid #e23744", boxShadow: "0 0 0 4px rgba(226,55,68,0.15)" },
  dotDone: { background: "#f0fdf4", border: "2px solid #16a34a" },
  dotLabel: { fontSize: 10, marginTop: 2 },
  connector: { height: 2, width: "60%", marginTop: -22, marginLeft: "50%", position: "relative" },
  details: { background: "#f9fafb", borderRadius: 10, padding: "12px 16px", marginBottom: 16, textAlign: "left" },
  detailRow: { display: "flex", justifyContent: "space-between", fontSize: 14, color: "#374151", padding: "4px 0" },
  infoBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    color: "#92400e",
    marginBottom: 16,
  },
  primaryBtn: {
    flex: 1,
    padding: "11px 0",
    background: "#e23744",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  secondaryBtn: {
    flex: 1,
    padding: "11px 0",
    background: "#f9fafb",
    color: "#374151",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
};

export default OrderConfirmation;
