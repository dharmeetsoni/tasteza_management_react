import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

const CartDrawer = ({ open, onClose }) => {
  const { state, updateQuantity, removeItem, subtotal, deliveryCharge, grandTotal, totalItems } = useCart();
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.drawer}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>Your Cart</h2>
            {totalItems > 0 && (
              <p style={s.subtitle}>{totalItems} item{totalItems > 1 ? 's' : ''}</p>
            )}
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {state.items.length === 0 ? (
          <div style={s.empty}>
            <span style={{ fontSize: 56 }}>🛒</span>
            <p style={{ fontWeight: 700, fontSize: 16, color: '#1c1c1c', marginTop: 12 }}>Your cart is empty</p>
            <p style={{ fontSize: 13, color: '#93959f', margin: '4px 0 20px' }}>Add items to get started</p>
            <button style={s.browseBtn} onClick={onClose}>Browse Menu</button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div style={s.items}>
              {state.items.map((item) => (
                <div key={item.id} style={s.item}>
                  <div style={s.itemLeft}>
                    {/* Veg indicator */}
                    <div style={{ ...s.vegBox, borderColor: '#16a34a' }}>
                      <div style={{ ...s.vegDot, background: '#16a34a' }} />
                    </div>
                    <div>
                      <p style={s.itemName}>{item.name}</p>
                      <p style={s.itemUnitPrice}>₹{Number(item.price).toFixed(0)} each</p>
                    </div>
                  </div>
                  <div style={s.itemRight}>
                    <span style={s.itemTotal}>₹{(item.price * item.quantity).toFixed(0)}</span>
                    {/* Stepper */}
                    <div style={s.stepper}>
                      <button
                        style={s.stepBtn}
                        onClick={() => item.quantity === 1 ? removeItem(item.id) : updateQuantity(item.id, item.quantity - 1)}
                      >
                        {item.quantity === 1 ? '🗑' : '−'}
                      </button>
                      <span style={s.stepQty}>{item.quantity}</span>
                      <button style={s.stepBtn} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bill summary */}
            <div style={s.bill}>
              <p style={s.billTitle}>Bill Summary</p>
              <div style={s.billRow}>
                <span>Item Total</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {deliveryCharge > 0 && (
                <div style={s.billRow}>
                  <span>Delivery Fee</span>
                  <span>₹{deliveryCharge.toFixed(2)}</span>
                </div>
              )}
              {deliveryCharge === 0 && state.orderType === 'delivery' && (
                <div style={{ ...s.billRow, color: '#16a34a', fontSize: 12 }}>
                  <span>🎉 Free Delivery</span>
                  <span>₹0</span>
                </div>
              )}
              <div style={s.billTotal}>
                <span>To Pay</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* CTA */}
            <div style={s.cta}>
              <button style={s.checkoutBtn} onClick={() => { onClose(); navigate('/order/checkout'); }}>
                <span>Proceed to Checkout</span>
                <span>₹{grandTotal.toFixed(0)} →</span>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(2px)' },
  drawer: {
    position: 'fixed', top: 0, right: 0, height: '100%',
    width: 380, maxWidth: '92vw', background: '#fff',
    zIndex: 1001, display: 'flex', flexDirection: 'column',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 20px 16px', borderBottom: '1px solid #ebebeb',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 900, color: '#1c1c1c' },
  subtitle: { margin: '3px 0 0', fontSize: 12, color: '#93959f', fontWeight: 500 },
  closeBtn: {
    background: '#f4f4f5', border: 'none', width: 32, height: 32,
    borderRadius: 8, cursor: 'pointer', fontSize: 16, color: '#1c1c1c',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  browseBtn: {
    padding: '12px 28px', background: '#e23744', color: '#fff',
    border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15,
  },
  items: { flex: 1, overflowY: 'auto', padding: '8px 16px' },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', borderBottom: '1px solid #f4f4f5', gap: 8,
  },
  itemLeft: { display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 },
  vegBox: {
    width: 14, height: 14, border: '1.5px solid', borderRadius: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  vegDot: { width: 7, height: 7, borderRadius: '50%' },
  itemName: { margin: 0, fontWeight: 700, fontSize: 14, color: '#1c1c1c', lineHeight: 1.3 },
  itemUnitPrice: { margin: '2px 0 0', fontSize: 12, color: '#93959f' },
  itemRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  itemTotal: { fontWeight: 800, fontSize: 14, color: '#1c1c1c' },
  stepper: {
    display: 'flex', alignItems: 'center',
    border: '1.5px solid #e23744', borderRadius: 8, overflow: 'hidden',
  },
  stepBtn: {
    width: 30, height: 30, background: '#fff', border: 'none',
    color: '#e23744', fontSize: 16, fontWeight: 800, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stepQty: {
    minWidth: 28, textAlign: 'center', background: '#e23744',
    color: '#fff', fontWeight: 900, fontSize: 13,
    height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  bill: { padding: '16px 20px', background: '#fafafa', borderTop: '1px solid #ebebeb' },
  billTitle: { margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#1c1c1c' },
  billRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#5c5c5c', marginBottom: 6 },
  billTotal: {
    display: 'flex', justifyContent: 'space-between',
    fontWeight: 900, fontSize: 16, color: '#1c1c1c',
    borderTop: '1px dashed #d1d5db', paddingTop: 10, marginTop: 6,
  },
  cta: { padding: '14px 16px', borderTop: '1px solid #ebebeb' },
  checkoutBtn: {
    width: '100%', padding: '15px 20px', background: '#e23744',
    color: '#fff', border: 'none', borderRadius: 12, fontSize: 16,
    fontWeight: 800, cursor: 'pointer', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
};

export default CartDrawer;
