import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { placeOnlineOrder, initPhonePePayment } from "../../api";

const Checkout = () => {
  const { state, subtotal, deliveryCharge, grandTotal, clearCart } = useCart();
  const { customer, token } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const coupon = location.state?.coupon || null;
  const discountAmount = coupon ? parseFloat(coupon.calculated_discount || 0) : 0;

  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState("phonepay"); // phonepay only
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapsKey, setMapsKey] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [publicConfig, setPublicConfig] = useState({});
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  const isDelivery = state.orderType === "delivery";
  const gstTotal = state.items.reduce((s, i) => {
    const gst = Number(i.gst_percent || 0);
    return s + (Number(i.price) * i.quantity * gst) / 100;
  }, 0);

  // Load public config for delivery charge, maps key
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setPublicConfig(d.data);
          if (d.data.google_maps_key) setMapsKey(d.data.google_maps_key);
        }
      })
      .catch(() => {});
  }, []);

  // Load Google Maps API when key is available
  useEffect(() => {
    if (!mapsKey || !isDelivery || window.google) {
      if (window.google) setMapReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`;
    script.async = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
    return () => {};
  }, [mapsKey, isDelivery]);

  // Initialize Places Autocomplete
  useEffect(() => {
    if (!mapReady || !inputRef.current || autocompleteRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: "in" } });
    autocompleteRef.current = ac;
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry) return;
      setAddress(place.formatted_address || place.name || "");
      setLat(place.geometry.location.lat());
      setLng(place.geometry.location.lng());
    });
  }, [mapReady]);

  const buildPayload = () => ({
    items: state.items.map((i) => ({
      menu_item_id: i.isAddon ? null : i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      gst_percent: i.gst_percent || 0,
      addon_data: i.isAddon ? JSON.stringify({ addonId: i.id.replace("addon_", "") }) : null,
    })),
    order_type: state.orderType,
    table_number: state.tableNumber || null,
    delivery_address: address || null,
    delivery_lat: lat,
    delivery_lng: lng,
    notes,
    subtotal,
    gst_amount: gstTotal,
    discount_amount: discountAmount,
    coupon_code: coupon?.code || null,
    delivery_charge: deliveryCharge,
    total: Math.max(0, grandTotal + gstTotal - discountAmount),
    customer_name: customer?.name || "Guest",
    customer_phone: customer?.phone || null,
    customer_id: customer?.id || null,
    payment_method: payMethod,
  });

  const handlePhonePe = async () => {
    if (isDelivery && !address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Step 1: Create the online order
      const orderPayload = buildPayload();
      const orderRes = await placeOnlineOrder(orderPayload);
      if (!orderRes.success) throw new Error(orderRes.message || "Failed to create order");
      const orderId = orderRes.order_id;

      // Step 2: Initiate PhonePe payment
      const redirectUrl = `${window.location.origin}/menu/payment-callback`;
      const ppRes = await initPhonePePayment({
        order_id: orderId,
        customer_phone: customer?.phone || "",
        amount_paise: Math.round((grandTotal + gstTotal) * 100),
        redirect_url: redirectUrl,
      });
      if (!ppRes.success) throw new Error(ppRes.message || "Payment initiation failed");
      clearCart();
      // Redirect to PhonePe payment page
      window.location.href = ppRes.redirectUrl;
    } catch (err) {
      setError(err.message || "Failed to initiate payment. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = async () => {
    if (isDelivery && !address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const orderRes = await placeOnlineOrder(buildPayload());
      if (!orderRes.success) throw new Error(orderRes.message || "Failed to place order");
      clearCart();
      navigate(`/menu/order-confirmation/${orderRes.order_id}`);
    } catch (err) {
      setError(err.message || "Failed to place order. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => payMethod === "counter" ? handleCounter() : handlePhonePe();

  if (state.items.length === 0) {
    return (
      <div style={st.page}>
        <div style={st.empty}>
          <p style={{ fontSize: 56 }}>&#128722;</p>
          <h2 style={{ color: "#1c1c1c", margin: "8px 0" }}>Cart is empty</h2>
          <button style={st.primaryBtn} onClick={() => navigate("/menu/")}>
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  const orderTotal = Math.max(0, grandTotal + gstTotal - discountAmount);

  return (
    <div style={st.page}>
      {/* Top bar */}
      <div style={st.topBar}>
        <button style={st.backBtn} onClick={() => navigate("/menu/")}>
          &#8592; Menu
        </button>
        <h1 style={st.pageTitle}>Checkout</h1>
        <div />
      </div>

      <div style={st.content}>
        {/* Order type */}
        <div style={st.section}>
          <h3 style={st.sectionTitle}>Order Type</h3>
          <div style={st.badge}>{(state.orderType || "").replace("_", " ")}</div>
          {state.tableNumber && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
              Table: <strong>{state.tableNumber}</strong>
            </p>
          )}
        </div>

        {/* Items */}
        <div style={st.section}>
          <h3 style={st.sectionTitle}>Your Items</h3>
          {state.items.map((item) => (
            <div key={item.cartKey || item.id} style={st.itemRow}>
              <div style={st.itemQtyBadge}>{item.quantity}&times;</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, color: "#1c1c1c" }}>{item.name}</span>
                {item.isAddon && <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 6 }}>Add-on</span>}
              </div>
              <span style={{ fontWeight: 700, color: "#e23744", fontSize: 14 }}>&#8377;{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>

        {/* Delivery address */}
        {isDelivery && (
          <div style={st.section}>
            <h3 style={st.sectionTitle}>Delivery Address *</h3>
            <input
              ref={inputRef}
              style={st.input}
              placeholder="Start typing your address&hellip;"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {!mapsKey && (
              <textarea
                style={{ ...st.input, marginTop: 8, resize: "vertical" }}
                rows={2}
                placeholder="Enter your full delivery address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            )}
            {lat && <p style={{ fontSize: 12, color: "#16a34a", margin: "6px 0 0" }}>&#10003; Location pinned</p>}
          </div>
        )}

        {/* Notes */}
        <div style={st.section}>
          <h3 style={st.sectionTitle}>Special Instructions</h3>
          <textarea
            style={{ ...st.input, resize: "vertical" }}
            rows={2}
            placeholder="Allergy notes, extra sauce, etc. (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Sign in prompt if not logged in */}
        {!customer && (
          <div style={{ ...st.section, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Sign in for order tracking & history</span>
            <button
              style={{
                background: "none",
                border: "1.5px solid #e23744",
                color: "#e23744",
                borderRadius: 8,
                padding: "6px 14px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
              onClick={() => navigate("/menu/login", { state: { from: "/menu/checkout" } })}
            >
              Sign In
            </button>
          </div>
        )}
        {customer && !customer.isGuest && (
          <div style={{ ...st.section, display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#fff5f5",
                border: "2px solid #fecaca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                color: "#e23744",
                fontSize: 15,
              }}
            >
              {(customer.name || "G")[0].toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{customer.name}</p>
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>+91 {customer.phone}</p>
            </div>
          </div>
        )}

        {/* Payment method */}
        <div style={st.section}>
          <h3 style={st.sectionTitle}>Payment</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              onClick={() => setPayMethod("phonepay")}
              style={{ ...st.payOption, flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: 10, ...(payMethod === "phonepay" ? st.payOptionActive : {}) }}
            >
              <span style={{ fontSize: 20 }}>&#128241;</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: payMethod === "phonepay" ? "#e23744" : "#374151" }}>PhonePe</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>UPI / Cards</p>
              </div>
            </div>
            <div
              onClick={() => setPayMethod("counter")}
              style={{ ...st.payOption, flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: 10, ...(payMethod === "counter" ? st.payOptionActive : {}) }}
            >
              <span style={{ fontSize: 20 }}>&#128176;</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: payMethod === "counter" ? "#e23744" : "#374151" }}>Pay at Counter</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Cash / UPI at store</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bill summary */}
        <div style={st.summaryBox}>
          <div style={st.summaryRow}>
            <span>Subtotal</span>
            <span>&#8377;{subtotal.toFixed(2)}</span>
          </div>
          {gstTotal > 0 && (
            <div style={st.summaryRow}>
              <span>GST</span>
              <span>&#8377;{gstTotal.toFixed(2)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div style={{ ...st.summaryRow, color: "#16a34a", fontWeight: 700 }}>
              <span>Coupon ({coupon.code})</span>
              <span>-&#8377;{discountAmount.toFixed(2)}</span>
            </div>
          )}
          {deliveryCharge > 0 && (
            <div style={st.summaryRow}>
              <span>Delivery</span>
              <span>&#8377;{deliveryCharge.toFixed(2)}</span>
            </div>
          )}
          {deliveryCharge === 0 && isDelivery && publicConfig.delivery_free_above > 0 && (
            <div style={{ ...st.summaryRow, color: "#16a34a", fontWeight: 600 }}>
              <span>Free Delivery</span>
              <span>&#10003;</span>
            </div>
          )}
          <div
            style={{
              ...st.summaryRow,
              fontWeight: 800,
              fontSize: 17,
              color: "#1c1c1c",
              paddingTop: 10,
              borderTop: "1.5px solid #e5e7eb",
              marginTop: 6,
            }}
          >
            <span>Total</span>
            <span>&#8377;{orderTotal.toFixed(2)}</span>
          </div>
        </div>

        {error && <div style={st.error}>{error}</div>}

        <button
          style={{ ...st.primaryBtn, width: "100%", padding: 15, fontSize: 17, opacity: loading ? 0.7 : 1, marginBottom: 32 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Processing\u2026" : payMethod === "counter" ? `Place Order \u20b9${orderTotal.toFixed(0)}` : `Pay \u20b9${orderTotal.toFixed(0)} via PhonePe`}
        </button>
      </div>
    </div>
  );
};

const st = {
  page: { minHeight: "100vh", background: "#f4f4f5" },
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
  backBtn: { background: "none", border: "none", cursor: "pointer", color: "#e23744", fontWeight: 700, fontSize: 15 },
  pageTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  content: { maxWidth: 540, margin: "0 auto", padding: "16px 14px 32px" },
  section: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  sectionTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: "#374151" },
  badge: {
    display: "inline-block",
    background: "#fff7ed",
    color: "#ea580c",
    border: "1px solid #fed7aa",
    borderRadius: 6,
    padding: "4px 12px",
    fontWeight: 700,
    fontSize: 13,
    textTransform: "capitalize",
  },
  itemRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  itemQtyBadge: { background: "#f4f4f5", borderRadius: 6, padding: "3px 8px", fontWeight: 800, fontSize: 12, color: "#374151" },
  input: {
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    color: "#111827",
    background: "#fff",
  },
  payOption: {
    flex: 1,
    padding: "12px 10px",
    border: "2px solid #e5e7eb",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center",
    color: "#6b7280",
    transition: "all 0.15s",
  },
  payOptionActive: { border: "2px solid #e23744", background: "#fff5f5", color: "#e23744" },
  summaryBox: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  summaryRow: { display: "flex", justifyContent: "space-between", fontSize: 14, color: "#374151", marginBottom: 6 },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 10,
  },
  primaryBtn: { background: "#e23744", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, cursor: "pointer" },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "70vh",
    gap: 8,
    textAlign: "center",
    padding: 20,
  },
};

export default Checkout;
