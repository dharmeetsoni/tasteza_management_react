import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { checkPhonePeStatus } from "../../api";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | success | failed

  useEffect(() => {
    const txnId = searchParams.get("transactionId") || searchParams.get("merchantTransactionId");
    if (!txnId) {
      setStatus("failed");
      return;
    }
    checkPhonePeStatus(txnId)
      .then((d) => {
        if (d.success && d.data?.payment_status === "paid") {
          setStatus("success");
          setTimeout(() => navigate(`/menu/confirmation/${d.data.order_id}`), 1500);
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, [searchParams, navigate]);

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f5", padding: 20 }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "40px 24px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        }}
      >
        {status === "checking" && (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                border: "4px solid #fecaca",
                borderTopColor: "#e23744",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <h2>Verifying Payment&hellip;</h2>
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Please wait while we confirm your payment</p>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ fontSize: 64, marginBottom: 12 }}>&#10004;</div>
            <h2 style={{ color: "#16a34a" }}>Payment Successful!</h2>
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Redirecting to your order&hellip;</p>
          </>
        )}
        {status === "failed" && (
          <>
            <div style={{ fontSize: 64, marginBottom: 12 }}>&#10006;</div>
            <h2 style={{ color: "#dc2626" }}>Payment Failed</h2>
            <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 20 }}>Your payment could not be processed.</p>
            <button
              style={{
                padding: "12px 28px",
                background: "#e23744",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => navigate("/menu/checkout")}
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
