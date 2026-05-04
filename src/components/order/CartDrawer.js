import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { validatePublicCoupon } from '../../api';

const CartDrawer = ({ open, onClose }) => {
  const { state, updateQuantity, removeItem, subtotal, gstTotal, deliveryCharge, grandTotal, totalItems } = useCart();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, calculated_discount, description }
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const d = await validatePublicCoupon({ code: couponCode.trim(), order_amount: subtotal });
      if (d.success) {
        setCoupon(d.data);
        setCouponError('');
      } else {
        setCoupon(null);
        setCouponError(d.message || 'Invalid coupon');
      }
    } catch (e) {
      setCoupon(null);
      setCouponError(e?.response?.data?.message || 'Invalid coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => { setCoupon(null); setCouponCode(''); setCouponError(''); };

  const discount = coupon ? parseFloat(coupon.calculated_discount) : 0;
  const payableTotal = grandTotal - discount;

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
                <div key={item.cartKey || item.id} style={{ ...s.item, ...(item.isAddon ? { marginLeft: 20, borderLeft: '2px solid #fecaca', paddingLeft: 10, background: '#fff9f9' } : {}) }}>
                  <div style={s.itemLeft}>
                    {item.isAddon ? (
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e23744', flexShrink: 0, marginTop: 3 }} />
                    ) : (
                      <div style={{ ...s.vegBox, borderColor: '#16a34a' }}>
                        <div style={{ ...s.vegDot, background: '#16a34a' }} />
                      </div>
                    )}
                    <div>
                      <p style={{ ...s.itemName, fontSize: item.isAddon ? 12 : 14, color: item.isAddon ? '#e23744' : '#1c1c1c' }}>{item.name}</p>
                      <p style={s.itemUnitPrice}>{item.isAddon ? 'Add-on' : <>&#8377;{Number(item.price).toFixed(0)} each</>}</p>
                    </div>
                  </div>
                  <div style={s.itemRight}>
                    <span style={{ ...s.itemTotal, fontSize: item.isAddon ? 12 : 14 }}>&#8377;{(item.price * item.quantity).toFixed(0)}</span>
                    {!item.isAddon && (
                      <div style={s.stepper}>
                        <button
                          style={s.stepBtn}
                          onClick={() => item.quantity === 1 ? removeItem(item.cartKey || item.id) : updateQuantity(item.cartKey || item.id, item.quantity - 1)}
                        >
                          {item.quantity === 1 ? '\uD83D\uDDD1\uFE0F' : '\u2212'}
                        </button>
                        <span style={s.stepQty}>{item.quantity}</span>
                        <button style={s.stepBtn} onClick={() => updateQuantity(item.cartKey || item.id, item.quantity + 1)}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #ebebeb' }}>
              {coupon ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '10px 12px' }}>
                  <span style={{ fontSize: 18 }}>\ud83c\udf89</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#16a34a' }}>{coupon.code} applied!</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>You save &#8377;{Number(coupon.calculated_discount).toFixed(0)}</div>
                  </div>
                  <button onClick={removeCoupon} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}>&#10005;</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    style={{ flex: 1, padding: '9px 11px', border: `1.5px solid ${couponError ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, outline: 'none' }}
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                  />
                  <button
                    style={{ padding: '9px 14px', background: '#e23744', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: couponLoading ? 0.7 : 1 }}
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                  >
                    {couponLoading ? '\u2026' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{couponError}</div>}
            </div>

            {/* Bill summary */}
            <div style={s.bill}>
              <p style={s.billTitle}>Bill Summary</p>
              <div style={s.billRow}>
                <span>Item Total</span>
                <span>&#8377;{subtotal.toFixed(2)}</span>
              </div>
              {gstTotal > 0 && (
                <div style={s.billRow}>
                  <span>GST</span>
                  <span>&#8377;{gstTotal.toFixed(2)}</span>
                </div>
              )}
              {deliveryCharge > 0 && (
                <div style={s.billRow}>
                  <span>Delivery Fee</span>
                  <span>&#8377;{deliveryCharge.toFixed(2)}</span>
                </div>
              )}
              {deliveryCharge === 0 && state.orderType === 'delivery' && (
                <div style={{ ...s.billRow, color: '#16a34a', fontSize: 12 }}>
                  <span>&#127881; Free Delivery</span>
                  <span>&#8377;0</span>
                </div>
              )}
              {discount > 0 && (
                <div style={{ ...s.billRow, color: '#16a34a' }}>
                  <span>Coupon ({coupon.code})</span>
                  <span>-&#8377;{discount.toFixed(2)}</span>
                </div>
              )}
              <div style={s.billTotal}>
                <span>To Pay</span>
                <span>&#8377;{payableTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* CTA */}
            <div style={s.cta}>
              <button style={s.checkoutBtn} onClick={() => {
                onClose();
                navigate('/menu/checkout', { state: { coupon: coupon || null } });
              }}>
                <span>Proceed to Checkout</span>
                <span>&#8377;{grandTotal.toFixed(0)} &#8594;</span>
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
