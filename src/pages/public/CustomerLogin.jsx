import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { verifyCustomerPhone } from "../../api";

// Firebase loaded dynamically from public settings
let firebaseApp = null;
let auth = null;
let confirmationResult = null;

async function initFirebase(config) {
  if (firebaseApp) return;
  const { initializeApp } = await import("firebase/app");
  const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
  firebaseApp = initializeApp(config);
  auth = getAuth(firebaseApp);
  window._fbAuth = auth;
  window._fbSIWP = signInWithPhoneNumber;
  window._fbRV = RecaptchaVerifier;
}

const CustomerLogin = () => {
  const [step, setStep] = useState("phone"); // phone | otp | name
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const recaptchaRef = useRef(null);
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/menu/checkout";

  // Fetch firebase config from settings and init
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !d.data?.firebase_api_key) return;
        initFirebase({
          apiKey: d.data.firebase_api_key,
          authDomain: d.data.firebase_auth_domain,
          projectId: d.data.firebase_project_id,
          appId: d.data.firebase_app_id,
        }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Countdown for resend
  useEffect(() => {
    if (!countdown) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!auth) throw new Error("Firebase not configured. Please contact the restaurant.");
      // Setup invisible recaptcha
      if (!window._recaptchaVerifier) {
        window._recaptchaVerifier = new window._fbRV(auth, "recaptcha-container", { size: "invisible" });
        await window._recaptchaVerifier.render();
      }
      confirmationResult = await window._fbSIWP(auth, `+91${phone.replace(/\D/g, "")}`, window._recaptchaVerifier);
      setStep("otp");
      setCountdown(30);
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please try again.");
      if (window._recaptchaVerifier) {
        window._recaptchaVerifier.clear();
        window._recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await confirmationResult.confirm(otp);
      const firebase_uid = result.user.uid;
      // Register/login with backend
      const d = await verifyCustomerPhone({ phone, firebase_uid, name: name || undefined });
      if (!d.success) throw new Error(d.message || "Verification failed");
      if (!d.data.name && !name) {
        // New user — ask for name
        setStep("name");
        window._pendingUid = firebase_uid;
        return;
      }
      login(d.data.customer || d.data, d.data.token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const d = await verifyCustomerPhone({ phone, firebase_uid: window._pendingUid, name });
      if (!d.success) throw new Error(d.message || "Registration failed");
      login(d.data.customer || d.data, d.data.token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    login({ name: "Guest", phone: "", isGuest: true }, null);
    navigate(from, { replace: true });
  };

  return (
    <div style={st.page}>
      <div id="recaptcha-container" ref={recaptchaRef} />
      <div style={st.card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>🍽️</div>
          <h1 style={st.title}>Sign In</h1>
          <p style={st.sub}>Enter your phone to get an OTP</p>
        </div>

        {error && <div style={st.error}>{error}</div>}

        {step === "phone" && (
          <form onSubmit={handleSendOTP} style={st.form}>
            <div style={st.phoneRow}>
              <div style={st.countryCode}>+91</div>
              <input
                style={{ ...st.input, flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "none" }}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoFocus
              />
            </div>
            <button style={st.btn} type="submit" disabled={loading}>
              {loading ? "Sending OTP…" : "Get OTP"}
            </button>
            <button type="button" style={st.ghostBtn} onClick={handleGuestContinue}>
              Continue as Guest
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOTP} style={st.form}>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, margin: "0 0 16px" }}>OTP sent to +91 {phone}</p>
            <input
              style={{ ...st.input, textAlign: "center", letterSpacing: 10, fontSize: 22, fontWeight: 800 }}
              placeholder="− − − − − −"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
            />
            <button style={st.btn} type="submit" disabled={loading || otp.length < 6}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
            <button
              type="button"
              style={{ ...st.ghostBtn, opacity: countdown > 0 ? 0.5 : 1 }}
              disabled={countdown > 0}
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError("");
              }}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
            </button>
          </form>
        )}

        {step === "name" && (
          <form onSubmit={handleNameSubmit} style={st.form}>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, margin: "0 0 16px" }}>
              Almost there! What should we call you?
            </p>
            <input style={st.input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <button style={st.btn} type="submit" disabled={loading}>
              {loading ? "Saving…" : "Continue"}
            </button>
          </form>
        )}

        <button style={st.backBtn} onClick={() => navigate("/menu/")}>
          &#8592; Back to Menu
        </button>
      </div>
    </div>
  );
};

const st = {
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
    borderRadius: 20,
    padding: "32px 24px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  },
  title: { margin: "8px 0 4px", fontSize: 26, fontWeight: 900 },
  sub: { margin: 0, color: "#9ca3af", fontSize: 13 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  phoneRow: { display: "flex", border: "1.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden" },
  countryCode: {
    padding: "12px 12px",
    background: "#f9fafb",
    borderRight: "1.5px solid #e5e7eb",
    fontWeight: 700,
    color: "#374151",
    fontSize: 15,
    display: "flex",
    alignItems: "center",
  },
  input: {
    padding: "12px 14px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    color: "#111827",
  },
  btn: {
    padding: 13,
    background: "#e23744",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "10px 14px",
    background: "none",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    color: "#6b7280",
    cursor: "pointer",
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 12,
  },
  backBtn: {
    display: "block",
    width: "100%",
    marginTop: 16,
    background: "none",
    border: "none",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 13,
    textAlign: "center",
  },
};

export default CustomerLogin;
