import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "../../context/CartContext";
import { CustomerAuthProvider } from "../../context/CustomerAuthContext";
import OrderMenu from "./OrderMenu";
import Checkout from "./Checkout";
import CustomerLogin from "./CustomerLogin";
import OrderConfirmation from "./OrderConfirmation";
import CustomerAccount from "./CustomerAccount";
import PaymentCallback from "./PaymentCallback";

const PublicOrderApp = () => (
  <CustomerAuthProvider>
    <CartProvider>
      <Routes>
        <Route index element={<OrderMenu />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="login" element={<CustomerLogin />} />
        <Route path="confirmation/:orderId" element={<OrderConfirmation />} />
        <Route path="account" element={<CustomerAccount />} />
        <Route path="payment-callback" element={<PaymentCallback />} />
        <Route path="*" element={<Navigate to="/menu/" replace />} />
      </Routes>
    </CartProvider>
  </CustomerAuthProvider>
);

export default PublicOrderApp;
