import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { getCustomerOrders } from "../../api";

const CustomerAccount = () => {
  const { customer, token, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    if (!token) { navigate("/menu/login", { state: { from: "/menu/account" } }); return; }
    getCustomerOrders(token)
      .then((d) => { if (d.success) setOrders(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const STATUS_COLORS = {
    pending: "#f59e0b", confirmed: "#3b82f6", preparing: "#f97316",
    ready: "#7c3aed", delivered: "#16a34a", cancelled: "#dc2626",
  };

  const printBill = (order) => {
    const w = window.open("", "_blank");
    const items = order.items || [];
    w.document.write(`
      <html><head><title>Bill #${order.id}</title>
      <style>body{font-family:Courier,monospace;max-width:300px;margin:0 auto;padding:20px;font-size:12px}
      h2{text-align:center}table{width:100%}td{padding:2px 0}hr{border:1px dashed #999}.total{font-size:14px;font-weight:bold}</style>
      </head><body>
      <h2>Tasteza Kitchen</h2>
      <p style="text-align:center">Order #${order.id} &bull; ${new Date(order.created_at).toLocaleString()}</p>
      <hr>
      <table>${items.map(i => `<tr><td>${i.name} x${i.quantity}</td><td style="text-align:right">&#8377;${(i.unit_price * i.quantity).toFixed(2)}</td></tr>`).join("")}</table>
      <hr>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">&#8377;${Number(order.subtotal || order.total).toFixed(2)}</td></tr>
        ${order.delivery_charge > 0 ? `<tr><td>Delivery</td><td style="text-align:right">&#8377;${Number(order.delivery_charge).toFixed(2)}</td></tr>` : ""}
        <tr class="total"><td>Total</td><td style="text-align:right">&#8377;${Number(order.total).toFixed(2)}</td></tr>
      </table>
      <p style="text-align:center;margin-top:20px">Thank you for ordering!</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div style={st.page}>
      <div style={st.topBar}>
        <button style={st.backBtn} onClick={() => navigate("/order")}>&#8592; Menu</button>
        <h1 style={st.title}>My Account</h1>
        <button style={st.logoutBtn} onClick={() => { logout(); navigate("/order"); }}>Logout</button>
      </div>

      <div style={st.content}>
        {/* Profile card */}
        <div style={st.profileCard}>
          <div style={st.avatar}>{(customer?.name || "G").charAt(0).toUpperCase()}</div>
          <div>
            <div style={st.profileName}>{customer?.name || "Guest"}</div>
            <div style={st.profilePhone}>{customer?.phone || ""}</div>
          </div>
        </div>

        <h2 style={st.sectionTitle}>Order History</h2>

        {loading && <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>Loading orders&hellip;</p>}

        {!loading && orders.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 48 }}>&#128722;</p>
            <p style={{ color: "#9ca3af" }}>No orders yet</p>
          </div>
        )}

        {orders.map((order) => (
          <div key={order.id} style={st.orderCard}>
            <div style={st.orderHeader} onClick={() => setActiveOrder(activeOrder === order.id ? null : order.id)}>
              <div>
                <div style={st.orderNum}>Order #{order.id}</div>
                <div style={st.orderDate}>{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...st.statusBadge, color: STATUS_COLORS[order.status] || "#374151", background: (STATUS_COLORS[order.status] || "#374151") + "18" }}>{order.status}</div>
                <div style={st.orderTotal}>&#8377;{Number(order.total).toFixed(2)}</div>
              </div>
            </div>

            {activeOrder === order.id && (
              <div style={st.orderDetail}>
                {(order.items || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6 }}>
                    <span>{item.name} &times; {item.quantity}</span>
                    <span>&#8377;{(item.unit_price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
                <div style={{ paddingTop: 8, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                  <span>Total</span>
                  <span>&#8377;{Number(order.total).toFixed(2)}</span>
                </div>
                <button style={st.printBtn} onClick={() => printBill(order)}>&#128438; Download Bill</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const st = {
  page: { minHeight: "100vh", background: "#f4f4f5" },
  topBar: { background: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", position: "sticky", top: 0 },
  backBtn: { background: "none", border: "none", cursor: "pointer", color: "#e23744", fontWeight: 700, fontSize: 15 },
  title: { margin: 0, fontSize: 18, fontWeight: 900 },
  logoutBtn: { background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#6b7280", fontSize: 13, fontWeight: 600 },
  content: { maxWidth: 540, margin: "0 auto", padding: "16px 14px 40px" },
  profileCard: { background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  avatar: { width: 52, height: 52, borderRadius: "50%", background: "#e23744", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, flexShrink: 0 },
  profileName: { fontWeight: 800, fontSize: 16, color: "#1c1c1c" },
  profilePhone: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 800, color: "#1c1c1c", margin: "8px 0 12px" },
  orderCard: { background: "#fff", borderRadius: 12, marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  orderHeader: { padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" },
  orderNum: { fontWeight: 800, fontSize: 15, color: "#1c1c1c" },
  orderDate: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  statusBadge: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "capitalize" },
  orderTotal: { fontWeight: 800, color: "#e23744", fontSize: 15, marginTop: 4 },
  orderDetail: { padding: "0 16px 16px", borderTop: "1px solid #f4f4f5" },
  printBtn: { marginTop: 12, width: "100%", padding: "10px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#374151" },
};

export default CustomerAccount;
