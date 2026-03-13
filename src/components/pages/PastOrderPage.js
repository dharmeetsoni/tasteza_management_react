import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getMenuItemsAll, getCourses, createPastOrder } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

const PAY_OPTS = [
  { v: 'cash',  l: '💵 Cash'  },
  { v: 'upi',   l: '📱 UPI'   },
  { v: 'card',  l: '💳 Card'  },
];
const ORDER_TYPES = [
  { v: 'dine_in', l: '🪑 Dine In' },
  { v: 'parcel',  l: '📦 Parcel'  },
];

export default function PastOrderPage() {
  const toast           = useToast();
  const billRef         = useRef(null);
  const [items, setItems]       = useState([]);
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [courseFilter, setCF]   = useState('all');
  const [cart, setCart]         = useState([]);
  const [saleDate, setSaleDate] = useState(todayStr);
  const [orderType, setOrderType] = useState('dine_in');
  const [payMethod, setPayMethod] = useState('cash');
  const [discType, setDiscType] = useState('none');
  const [discVal, setDiscVal]   = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [notes, setNotes]       = useState('');
  const [placing, setPlacing]   = useState(false);
  const [success, setSuccess]   = useState(null); // last placed order result

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([getMenuItemsAll(), getCourses()]);
      if (m.success) setItems(m.data.filter(i => i.is_active));
      if (c.success) setCourses(c.data.filter(c => c.is_active));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Cart helpers ─────────────────────────────────────────
  const addToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, {
        menu_item_id: item.id,
        name:         item.name,
        price:        parseFloat(item.selling_price),
        gst_pct:      parseFloat(item.gst_percent) || 0,
        is_veg:       item.is_veg,
        qty:          1,
      }];
    });
  };

  const setQty = (menu_item_id, qty) => {
    if (qty < 1) { setCart(prev => prev.filter(c => c.menu_item_id !== menu_item_id)); return; }
    setCart(prev => prev.map(c => c.menu_item_id === menu_item_id ? { ...c, qty } : c));
  };

  const clearCart = () => {
    setCart([]); setDiscType('none'); setDiscVal('');
    setCustName(''); setCustPhone(''); setNotes('');
  };

  // ── Bill calculations ────────────────────────────────────
  const subtotal   = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const totalGst   = cart.reduce((s, c) => s + c.price * c.qty * c.gst_pct / 100, 0);
  const rawTotal   = subtotal + totalGst;
  const discountAmt = discType === 'percentage' && discVal > 0
    ? rawTotal * parseFloat(discVal) / 100
    : discType === 'amount' && discVal > 0
      ? Math.min(parseFloat(discVal), rawTotal)
      : 0;
  const finalTotal = Math.max(0, rawTotal - discountAmt);

  // ── Place order ──────────────────────────────────────────
  const place = async () => {
    if (!cart.length) { toast('Add items to the cart', 'er'); return; }
    if (!saleDate) { toast('Select a date', 'er'); return; }
    if (saleDate > todayStr) { toast('Cannot add future date orders', 'er'); return; }
    setPlacing(true);
    try {
      const r = await createPastOrder({
        sale_date:      saleDate,
        order_type:     orderType,
        payment_method: payMethod,
        items:          cart.map(c => ({ menu_item_id: c.menu_item_id, quantity: c.qty })),
        customer_name:  custName || null,
        customer_phone: custPhone || null,
        discount_type:  discType === 'none' ? null : discType,
        discount_value: parseFloat(discVal) || 0,
        notes:          notes || null,
      });
      if (r.success) {
        setSuccess({ ...r.data, date: saleDate, items: [...cart], payMethod, custName });
        clearCart();
        toast(`Order ${r.data.order_number} saved ✓`);
      } else {
        toast(r.message || 'Failed to place order', 'er');
      }
    } catch (e) { toast('Failed to place order', 'er'); }
    finally { setPlacing(false); }
  };

  // ── Filtered menu ────────────────────────────────────────
  const filtered = items.filter(i => {
    if (courseFilter !== 'all' && i.course_id !== parseInt(courseFilter)) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pc = (v) => v >= 0 ? '#1db97e' : '#e84a5f';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── LEFT: Menu ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1.5px solid var(--border)', overflow: 'hidden' }}>

        {/* Date + Order type bar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>📅 Sale Date</div>
            <input type="date" value={saleDate} max={todayStr}
              onChange={e => setSaleDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--accent)', fontSize: 13, fontWeight: 700, background: 'var(--bg)', color: 'var(--ink)' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Order Type</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ORDER_TYPES.map(o => (
                <button key={o.v} onClick={() => setOrderType(o.v)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: orderType === o.v ? 'var(--accent)' : 'transparent',
                    color: orderType === o.v ? '#fff' : 'var(--ink2)',
                    borderColor: orderType === o.v ? 'var(--accent)' : 'var(--border)' }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          {saleDate < todayStr && (
            <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(232,74,95,.1)', border: '1px solid rgba(232,74,95,.3)', fontSize: 12, fontWeight: 700, color: '#e84a5f' }}>
              📅 Past date: {saleDate}
            </div>
          )}
        </div>

        {/* Search + Course filter */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--bg)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="🔍 Search menu…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setCF('all')}
              style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: courseFilter === 'all' ? 'var(--accent)' : 'transparent',
                color: courseFilter === 'all' ? '#fff' : 'var(--ink2)',
                borderColor: courseFilter === 'all' ? 'var(--accent)' : 'var(--border)' }}>All</button>
            {courses.map(c => (
              <button key={c.id} onClick={() => setCF(courseFilter === c.id ? 'all' : c.id)}
                style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: courseFilter === c.id ? c.color || 'var(--accent)' : 'transparent',
                  color: courseFilter === c.id ? '#fff' : 'var(--ink2)',
                  borderColor: courseFilter === c.id ? c.color || 'var(--accent)' : 'var(--border)' }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, alignContent: 'start' }}>
          {loading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--ink2)' }}>Loading menu…</div>
          ) : filtered.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--ink2)' }}>No items found</div>
          ) : filtered.map(item => {
            const inCart = cart.find(c => c.menu_item_id === item.id);
            return (
              <div key={item.id} onClick={() => addToCart(item)}
                style={{ background: 'var(--surface)', border: `1.5px solid ${inCart ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '10px 10px 8px', cursor: 'pointer', transition: 'all .12s', position: 'relative' }}>
                {/* Image / placeholder */}
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', marginBottom: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 28 }}>🍽️</span>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{fmtCur(item.selling_price)}</div>
                {inCart && (
                  <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                    {inCart.qty}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Cart + Bill ─────────────────────────────── */}
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>

        {/* Cart header */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🛒 Cart {cart.length > 0 && `(${cart.reduce((s,c) => s+c.qty,0)} items)`}</div>
          {cart.length > 0 && <button onClick={clearCart} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: '#e84a5f', fontWeight: 700 }}>Clear</button>}
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink2)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
              <div style={{ fontSize: 13 }}>Tap menu items to add</div>
            </div>
          ) : cart.map(c => (
            <div key={c.menu_item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.is_veg ? '🟢' : '🔴'} {c.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{fmtCur(c.price)} × {c.qty} = {fmtCur(c.price * c.qty)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => setQty(c.menu_item_id, c.qty - 1)}
                  style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, fontWeight: 800, color: '#e84a5f' }}>−</button>
                <span style={{ width: 20, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{c.qty}</span>
                <button onClick={() => setQty(c.menu_item_id, c.qty + 1)}
                  style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, fontWeight: 800, color: '#1db97e' }}>+</button>
              </div>
            </div>
          ))}

          {/* Bill summary */}
          {cart.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 8px', background: 'var(--bg)', borderRadius: 10 }}>
              <Row l="Subtotal"  v={fmtCur(subtotal)} />
              {totalGst > 0 && <Row l="GST" v={fmtCur(totalGst)} />}
              {discountAmt > 0 && <Row l="Discount" v={`−${fmtCur(discountAmt)}`} vc="#e84a5f" />}
              <div style={{ borderTop: '1.5px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                <span>Total</span><span style={{ color: 'var(--accent)' }}>{fmtCur(finalTotal)}</span>
              </div>
            </div>
          )}

          {/* Customer + Discount + Payment */}
          {cart.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Customer (optional)</label>
                <input className="mfi" placeholder="Name" value={custName} onChange={e => setCustName(e.target.value)} style={{ marginBottom: 6 }} />
                <input className="mfi" placeholder="Phone" value={custPhone} onChange={e => setCustPhone(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Discount</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  {[['none','None'],['percentage','%'],['amount','₹']].map(([v,l]) => (
                    <button key={v} onClick={() => { setDiscType(v); setDiscVal(''); }}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: discType === v ? 'var(--accent)' : 'transparent',
                        color: discType === v ? '#fff' : 'var(--ink2)',
                        borderColor: discType === v ? 'var(--accent)' : 'var(--border)' }}>
                      {l}
                    </button>
                  ))}
                </div>
                {discType !== 'none' && (
                  <input className="mfi" type="number" placeholder={discType === 'percentage' ? 'e.g. 10 (%)' : 'e.g. 50 (₹)'}
                    value={discVal} onChange={e => setDiscVal(e.target.value)} />
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Payment Method</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PAY_OPTS.map(o => (
                    <button key={o.v} onClick={() => setPayMethod(o.v)}
                      style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: payMethod === o.v ? '#1db97e' : 'transparent',
                        color: payMethod === o.v ? '#fff' : 'var(--ink2)',
                        borderColor: payMethod === o.v ? '#1db97e' : 'var(--border)' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Notes</label>
                <input className="mfi" placeholder="Optional note…" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Collect button */}
        {cart.length > 0 && (
          <div style={{ padding: '10px 14px', borderTop: '1.5px solid var(--border)' }}>
            <button onClick={place} disabled={placing}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: placing ? 'var(--border)' : '#1db97e', color: '#fff', fontSize: 15, fontWeight: 800, cursor: placing ? 'default' : 'pointer', transition: 'all .15s' }}>
              {placing ? 'Saving…' : `✅ Collect ${fmtCur(finalTotal)}`}
            </button>
          </div>
        )}

        {/* Success receipt */}
        {success && cart.length === 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            <div style={{ background: 'rgba(29,185,126,.08)', border: '1.5px solid rgba(29,185,126,.3)', borderRadius: 14, padding: 16 }} ref={billRef}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 24 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 4 }}>Order Saved</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>{success.order_number} · {success.date}</div>
              </div>
              {success.items.map(i => (
                <div key={i.menu_item_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span>{i.name} × {i.qty}</span>
                  <span>{fmtCur(i.price * i.qty)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                {success.discount_amount > 0 && <Row l="Discount" v={`−${fmtCur(success.discount_amount)}`} vc="#e84a5f" />}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginTop: 4 }}>
                  <span>Total Collected</span><span style={{ color: '#1db97e' }}>{fmtCur(success.total_amount)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>
                  {success.payMethod?.toUpperCase()} {success.custName ? `· ${success.custName}` : ''}
                </div>
              </div>
            </div>
            <button onClick={() => setSuccess(null)}
              style={{ width: '100%', marginTop: 12, padding: '11px 0', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'var(--ink)' }}>
              + New Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ l, v, vc }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: 'var(--ink2)' }}>
      <span>{l}</span><span style={{ color: vc || 'var(--ink)', fontWeight: 600 }}>{v}</span>
    </div>
  );
}
