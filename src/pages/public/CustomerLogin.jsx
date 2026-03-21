import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useCustomerAuth } from "../../context/CustomerAuthContext";

const CustomerLogin = () => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/order/checkout";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "guest") {
        login({ name: form.name || "Guest", phone: form.phone, isGuest: true });
        navigate(from, { replace: true });
        return;
      }
      const endpoint = mode === "register" ? "/api/customers/register" : "/api/customers/login";
      const res = await axios.post(endpoint, form);
      login(res.data.customer || res.data);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 48 }}>🍽️</span>
          <h1 style={styles.title}>Tasteza</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Sign in to continue your order</p>
        </div>

        <div style={styles.tabs}>
          {["login", "register", "guest"].map((m) => (
            <button
              key={m}
              style={{ ...styles.tab, ...(mode === m ? styles.activeTab : {}) }}
              onClick={() => {
                setMode(m);
                setError("");
              }}
            >
              {m === "login" ? "Login" : m === "register" ? "Register" : "Guest"}
            </button>
          ))}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(mode === "register" || mode === "guest") && (
            <input
              style={styles.input}
              name="name"
              placeholder="Full Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
          {mode !== "guest" && (
            <>
              <input
                style={styles.input}
                name="email"
                type="email"
                placeholder="Email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                style={styles.input}
                name="password"
                type="password"
                placeholder="Password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </>
          )}
          {(mode === "guest" || mode === "register") && (
            <input
              style={styles.input}
              name="phone"
              placeholder={mode === "register" ? "Phone Number" : "Phone (optional)"}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          )}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "guest" ? "Continue as Guest" : mode === "register" ? "Create Account" : "Login"}
          </button>
        </form>

        <button
          style={{
            display: "block",
            width: "100%",
            marginTop: 16,
            background: "none",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 14,
          }}
          onClick={() => navigate("/order")}
        >
          ← Back to Menu
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#fff7ed,#ffedd5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  },
  title: { margin: "8px 0 4px", fontSize: 28, fontWeight: 800, color: "#f97316" },
  tabs: { display: "flex", gap: 4, marginBottom: 20, background: "#f3f4f6", borderRadius: 10, padding: 4 },
  tab: {
    flex: 1,
    padding: "8px 4px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    background: "transparent",
    fontWeight: 500,
    fontSize: 13,
    color: "#6b7280",
  },
  activeTab: { background: "#fff", color: "#f97316", fontWeight: 700, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    padding: 13,
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 4,
  },
};

export default CustomerLogin;
