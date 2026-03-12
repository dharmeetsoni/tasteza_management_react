import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getOrdersList, getOrder, deleteOrder, editOrder } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const STATUS_META = {
  open:      { label:'Open',      color:'#118ab2', bg:'rgba(17,138,178,.12)'  },
  kot:       { label:'KOT Sent',  color:'#b07a00', bg:'rgba(244,165,53,.14)'  },
  billed:    { label:'Billed',    color:'#7c3aed', bg:'rgba(124,58,237,.12)'  },
  paid:      { label:'Paid',      color:'#1db97e', bg:'rgba(29,185,126,.12)'  },
  cancelled: { label:'Cancelled', color:'#e84a5f', bg:'rgba(232,74,95,.1)'   },
};
const PAY_ICON = { cash:'💵', card:'💳', upi:'📱', other:'🔄' };

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.open;
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
      background:m.bg, color:m.color, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  );
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtTime(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}

// ── Quick summary card ──────────────────────────────────────────
function KpiCard({ label, value, color, sub }) {
  return (
    <div className="scard">
      <div className="scard-text">
        <div className="sv small" style={{ color: color||'var(--ink)' }}>{value}</div>
        <div className="sl">{label}</div>
        {sub && <div style={{ fontSize:10, color:'var(--ink2)', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const toast = useToast();

  // Filters
  const [from,           setFrom]           = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; });
  const [to,             setTo]             = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [payFilter,      setPayFilter]      = useState('');
  const [typeFilter,     setTypeFilter]     = useState('');

  // Data
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(false);

  // View/edit/delete
  const [viewOrder,  setViewOrder]  = useState(null);
  const [viewItems,  setViewItems]  = useState([]);
  const [viewLoading,setViewLoading]= useState(false);
  const [editModal,  setEditModal]  = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [delOrder,   setDelOrder]   = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [saving,     setSaving]     = useState(false);

  // ── Load ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getOrdersList({ from, to, status: statusFilter, payment_method: payFilter, order_type: typeFilter, search });
      if (d.success) setOrders(d.data);
    } catch { toast('Failed to load orders', 'er'); }
    finally { setLoading(false); }
  }, [from, to, statusFilter, payFilter, typeFilter, search]);

  useEffect(() => { void load(); }, [load]);

  // ── View order details ──────────────────────────────────
  const openView = async (order) => {
    setViewOrder(order);
    setViewItems([]);
    setViewLoading(true);
    try {
      const d = await getOrder(order.id);
      if (d.success) setViewItems(d.data.items || []);
    } catch {}
    finally { setViewLoading(false); }
  };

  // ── Edit order ─────────────────────────────────────────
  const openEdit = (order) => {
    setEditModal(order);
    setEditForm({
      customer_name:  order.customer_name  || '',
      customer_phone: order.customer_phone || '',
      payment_method: order.payment_method || 'cash',
      notes:          order.notes          || '',
      discount_amount:parseFloat(order.discount_amount||0),
      total_amount:   parseFloat(order.total_amount||0),
      status:         order.status,
    });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const d = await editOrder(editModal.id, editForm);
      if (d.success) {
        toast('Order updated ✅', 'ok');
        setEditModal(null);
        setOrders(prev => prev.map(o => o.id === editModal.id ? { ...o, ...editForm } : o));
        if (viewOrder?.id === editModal.id) setViewOrder(v => ({ ...v, ...editForm }));
      } else toast(d.message || 'Error', 'er');
    } catch { toast('Error saving', 'er'); }
    finally { setSaving(false); }
  };

  // ── Delete order ────────────────────────────────────────
  const doDelete = async () => {
    setDeleting(true);
    try {
      const d = await deleteOrder(delOrder.id);
      if (d.success) {
        toast(`Order ${delOrder.order_number} deleted`, 'ok');
        setOrders(prev => prev.filter(o => o.id !== delOrder.id));
        if (viewOrder?.id === delOrder.id) setViewOrder(null);
      } else toast(d.message || 'Delete failed', 'er');
    } catch { toast('Error', 'er'); }
    finally { setDeleting(false); setDelOrder(null); }
  };

  // ── Quick filter presets ────────────────────────────────
  const setPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setFrom(fmt(start));
    setTo(fmt(end));
  };

  // ── KPIs ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const paid = orders.filter(o => o.status === 'paid');
    return {
      total:    orders.length,
      paid:     paid.length,
      revenue:  paid.reduce((s,o) => s + parseFloat(o.total_amount||0), 0),
      avg:      paid.length ? paid.reduce((s,o) => s + parseFloat(o.total_amount||0), 0) / paid.length : 0,
      cancelled:orders.filter(o => o.status === 'cancelled').length,
      cash:     paid.filter(o => o.payment_method==='cash').reduce((s,o) => s + parseFloat(o.total_amount||0), 0),
      upi:      paid.filter(o => o.payment_method==='upi').reduce((s,o) => s + parseFloat(o.total_amount||0), 0),
      card:     paid.filter(o => o.payment_method==='card').reduce((s,o) => s + parseFloat(o.total_amount||0), 0),
    };
  }, [orders]);

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div className="ph-left">
          <div className="pt">All Orders</div>
          <div className="ps">View, edit and manage every sale entry</div>
        </div>
        <button className="btn-c" onClick={load}>🔄 Refresh</button>
      </div>

      {/* ── KPIs ── */}
      <div className="stats-row">
        <KpiCard label="Total Orders"   value={kpis.total}            color="var(--ink)" />
        <KpiCard label="Paid Orders"    value={kpis.paid}             color="#1db97e" />
        <KpiCard label="Total Revenue"  value={fmtCur(kpis.revenue)}  color="#1db97e" />
        <KpiCard label="Avg Order Value"value={fmtCur(kpis.avg)}      color="#118ab2" />
        <KpiCard label="Cancelled"      value={kpis.cancelled}        color="#e84a5f" />
        <KpiCard label="Cash"           value={fmtCur(kpis.cash)}     color="#b07a00" />
        <KpiCard label="UPI"            value={fmtCur(kpis.upi)}      color="#7c3aed" />
        <KpiCard label="Card"           value={fmtCur(kpis.card)}     color="#118ab2" />
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ padding:'14px 18px', marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>

          {/* Date range */}
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--ink2)' }}>From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg)', fontSize:13 }} />
            <span style={{ fontSize:12, fontWeight:700, color:'var(--ink2)' }}>To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg)', fontSize:13 }} />
          </div>

          {/* Quick presets */}
          <div style={{ display:'flex', gap:4 }}>
            {[['Today',1],['Week',7],['Month',30],['3M',90]].map(([l,d]) => (
              <button key={l} onClick={() => setPreset(d)}
                style={{ padding:'5px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                  background:'var(--bg)', border:'1.5px solid var(--border)', color:'var(--ink2)' }}>{l}</button>
            ))}
          </div>

          {/* Search */}
          <div className="sw2" style={{ flex:'1 1 180px', minWidth:160 }}>
            <span className="si2">🔍</span>
            <input placeholder="Order #, customer name, phone…" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg)', fontSize:13 }}>
            <option value="">All Status</option>
            {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          {/* Payment filter */}
          <select value={payFilter} onChange={e => setPayFilter(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg)', fontSize:13 }}>
            <option value="">All Payments</option>
            <option value="cash">💵 Cash</option>
            <option value="upi">📱 UPI</option>
            <option value="card">💳 Card</option>
            <option value="other">🔄 Other</option>
          </select>

          {/* Order type filter */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg)', fontSize:13 }}>
            <option value="">All Types</option>
            <option value="dine_in">🪑 Dine-In</option>
            <option value="parcel">📦 Parcel</option>
            <option value="takeaway">🥡 Takeaway</option>
          </select>
        </div>

        <div style={{ marginTop:8, fontSize:12, color:'var(--ink2)' }}>
          {loading ? 'Loading…' : `${orders.length} orders found`}
        </div>
      </div>

      {/* ── Orders Table ── */}
      <div className="card" style={{ padding:0 }}>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date / Time</th>
                <th>Type</th>
                <th>Table</th>
                <th>Customer</th>
                <th style={{ textAlign:'right' }}>Amount</th>
                <th style={{ textAlign:'right' }}>Discount</th>
                <th>Payment</th>
                <th>Status</th>
                <th style={{ textAlign:'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10}><div className="loading-wrap" style={{ padding:40 }}>Loading orders…</div></td></tr>
              )}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={10}>
                  <div className="empty" style={{ padding:50 }}>
                    <div className="ei">🧾</div>
                    <p>No orders found for the selected filters</p>
                  </div>
                </td></tr>
              )}
              {!loading && orders.map(order => (
                <tr key={order.id} style={{ cursor:'pointer' }} onClick={() => openView(order)}>
                  <td style={{ fontWeight:800, color:'var(--accent)', fontSize:12 }}>{order.order_number}</td>
                  <td>
                    <div style={{ fontSize:13, fontWeight:600 }}>{fmtDate(order.paid_at || order.created_at)}</div>
                    <div style={{ fontSize:11, color:'var(--ink2)' }}>{fmtTime(order.paid_at || order.created_at)}</div>
                  </td>
                  <td>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:12, background:'var(--bg)', fontWeight:600 }}>
                      {order.order_type === 'dine_in' ? '🪑 Dine-In' : order.order_type === 'parcel' ? '📦 Parcel' : '🥡 Takeaway'}
                    </span>
                  </td>
                  <td style={{ fontSize:13 }}>{order.table_number || '—'}</td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13 }}>{order.customer_name || '—'}</div>
                    {order.customer_phone && <div style={{ fontSize:11, color:'var(--ink2)' }}>{order.customer_phone}</div>}
                  </td>
                  <td style={{ textAlign:'right', fontWeight:800, color:'#1db97e', fontSize:14 }}>{fmtCur(order.total_amount)}</td>
                  <td style={{ textAlign:'right', fontSize:13, color: parseFloat(order.discount_amount)>0 ? '#e84a5f' : 'var(--ink2)' }}>
                    {parseFloat(order.discount_amount)>0 ? `−${fmtCur(order.discount_amount)}` : '—'}
                  </td>
                  <td>
                    {order.payment_method
                      ? <span style={{ fontSize:12, fontWeight:700 }}>{PAY_ICON[order.payment_method]||'🔄'} {order.payment_method?.toUpperCase()}</span>
                      : <span style={{ color:'var(--ink2)', fontSize:12 }}>—</span>}
                  </td>
                  <td><StatusBadge status={order.status} /></td>
                  <td style={{ textAlign:'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                      <button className="bsm" title="View details" onClick={() => openView(order)}
                        style={{ background:'rgba(17,138,178,.1)', color:'#118ab2', border:'1.5px solid #118ab2' }}>👁️</button>
                      <button className="bsm" title="Edit order" onClick={() => openEdit(order)}
                        style={{ background:'rgba(244,165,53,.1)', color:'#b07a00', border:'1.5px solid #b07a00' }}>✏️</button>
                      <button className="bsm" title="Delete order" onClick={() => setDelOrder(order)}
                        style={{ background:'rgba(232,74,95,.1)', color:'#e84a5f', border:'1.5px solid #e84a5f' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Order Modal ── */}
      <Modal show={!!viewOrder} onClose={() => setViewOrder(null)}
        title={viewOrder?.order_number || 'Order Details'}
        subtitle={`${fmtDate(viewOrder?.paid_at || viewOrder?.created_at)} · ${viewOrder?.order_type?.replace('_',' ')}`}
        wide
        footer={
          <div style={{ display:'flex', gap:8, width:'100%' }}>
            <button className="btn-c" onClick={() => setViewOrder(null)}>Close</button>
            <div style={{ flex:1 }}/>
            <button className="bsm" onClick={() => { openEdit(viewOrder); }}
              style={{ padding:'8px 16px', background:'rgba(244,165,53,.1)', color:'#b07a00', border:'1.5px solid #b07a00', borderRadius:8, fontWeight:700, cursor:'pointer' }}>✏️ Edit</button>
            <button className="bsm" onClick={() => setDelOrder(viewOrder)}
              style={{ padding:'8px 16px', background:'rgba(232,74,95,.1)', color:'#e84a5f', border:'1.5px solid #e84a5f', borderRadius:8, fontWeight:700, cursor:'pointer' }}>🗑️ Delete</button>
          </div>
        }>
        {viewOrder && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Info grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
              {[
                ['Status',    <StatusBadge status={viewOrder.status} />],
                ['Payment',   <span style={{fontWeight:700}}>{PAY_ICON[viewOrder.payment_method]||''} {viewOrder.payment_method?.toUpperCase()||'—'}</span>],
                ['Table',     viewOrder.table_number || '—'],
                ['Type',      viewOrder.order_type?.replace('_',' ')],
                ['Customer',  viewOrder.customer_name || '—'],
                ['Phone',     viewOrder.customer_phone || '—'],
                ['Created by',viewOrder.created_by_name || '—'],
                ['Billed by', viewOrder.billed_by_name || '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ background:'var(--bg)', borderRadius:10, padding:'10px 14px' }}>
                  <div style={{ fontSize:10, color:'var(--ink2)', fontWeight:700, marginBottom:4 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Items */}
            <div>
              <div style={{ fontWeight:800, fontSize:13, marginBottom:8 }}>🍽️ Items</div>
              {viewLoading
                ? <div style={{ color:'var(--ink2)', padding:10 }}>Loading items…</div>
                : (
                  <table style={{ width:'100%' }}>
                    <thead><tr>
                      <th>Item</th>
                      <th style={{ textAlign:'center' }}>Qty</th>
                      <th style={{ textAlign:'right' }}>Unit Price</th>
                      <th style={{ textAlign:'right' }}>GST</th>
                      <th style={{ textAlign:'right' }}>Total</th>
                      <th style={{ textAlign:'center' }}>KOT</th>
                    </tr></thead>
                    <tbody>
                      {viewItems.map((item, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{item.item_name}</td>
                          <td style={{ textAlign:'center' }}>{item.quantity}</td>
                          <td style={{ textAlign:'right' }}>{fmtCur(item.unit_price)}</td>
                          <td style={{ textAlign:'right', color:'var(--ink2)', fontSize:12 }}>{item.gst_percent>0 ? `${item.gst_percent}%` : '—'}</td>
                          <td style={{ textAlign:'right', fontWeight:700 }}>{fmtCur(item.total_price)}</td>
                          <td style={{ textAlign:'center' }}>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:700,
                              background: item.kot_sent ? 'rgba(29,185,126,.1)' : 'rgba(232,74,95,.08)',
                              color: item.kot_sent ? '#1db97e' : '#e84a5f' }}>
                              {item.kot_sent ? '✅ Sent' : '⏳ Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {viewItems.length === 0 && <tr><td colSpan={6} style={{ color:'var(--ink2)', padding:12 }}>No items found</td></tr>}
                    </tbody>
                  </table>
                )
              }
            </div>

            {/* Totals */}
            <div style={{ background:'var(--bg)', borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span>Subtotal</span><span>{fmtCur(viewOrder.subtotal)}</span>
              </div>
              {parseFloat(viewOrder.gst_amount)>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--ink2)' }}>
                  <span>GST</span><span>{fmtCur(viewOrder.gst_amount)}</span>
                </div>
              )}
              {parseFloat(viewOrder.discount_amount)>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#1db97e' }}>
                  <span>Discount {viewOrder.coupon_code ? `(${viewOrder.coupon_code})` : ''}</span>
                  <span>−{fmtCur(viewOrder.discount_amount)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:16, borderTop:'1.5px solid var(--border)', paddingTop:8, marginTop:4 }}>
                <span>Total</span><span style={{ color:'#1db97e' }}>{fmtCur(viewOrder.total_amount)}</span>
              </div>
            </div>

            {viewOrder.notes && (
              <div style={{ background:'rgba(244,165,53,.08)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'var(--ink2)' }}>
                📝 {viewOrder.notes}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Edit Order Modal ── */}
      <Modal show={!!editModal} onClose={() => setEditModal(null)}
        title={`Edit Order — ${editModal?.order_number}`}
        subtitle="Update customer, payment or totals"
        footer={<>
          <button className="btn-c" onClick={() => setEditModal(null)}>Cancel</button>
          <button className="btn-p" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : '💾 Save Changes'}</button>
        </>}>
        {editModal && (
          <div className="mgrid">
            <div>
              <label className="mlabel">Customer Name</label>
              <input className="mfi" value={editForm.customer_name}
                onChange={e => setEditForm(f => ({...f, customer_name: e.target.value}))}
                placeholder="Customer name" />
            </div>
            <div>
              <label className="mlabel">Customer Phone</label>
              <input className="mfi" value={editForm.customer_phone}
                onChange={e => setEditForm(f => ({...f, customer_phone: e.target.value}))}
                placeholder="Phone number" />
            </div>
            <div>
              <label className="mlabel">Payment Method</label>
              <select className="mfi" value={editForm.payment_method}
                onChange={e => setEditForm(f => ({...f, payment_method: e.target.value}))}>
                <option value="cash">💵 Cash</option>
                <option value="upi">📱 UPI</option>
                <option value="card">💳 Card</option>
                <option value="other">🔄 Other</option>
              </select>
            </div>
            <div>
              <label className="mlabel">Status</label>
              <select className="mfi" value={editForm.status}
                onChange={e => setEditForm(f => ({...f, status: e.target.value}))}>
                {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mlabel">Total Amount (₹)</label>
              <input className="mfi" type="number" value={editForm.total_amount}
                onChange={e => setEditForm(f => ({...f, total_amount: e.target.value}))} />
            </div>
            <div>
              <label className="mlabel">Discount Amount (₹)</label>
              <input className="mfi" type="number" value={editForm.discount_amount}
                onChange={e => setEditForm(f => ({...f, discount_amount: e.target.value}))} />
            </div>
            <div className="mfull">
              <label className="mlabel">Notes</label>
              <input className="mfi" value={editForm.notes}
                onChange={e => setEditForm(f => ({...f, notes: e.target.value}))}
                placeholder="Any notes…" />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmModal
        show={!!delOrder}
        onClose={() => setDelOrder(null)}
        onConfirm={doDelete}
        title="Delete Order"
        message={`Delete order ${delOrder?.order_number} (${fmtCur(delOrder?.total_amount)})? If this was a paid order, inventory deductions will be reversed. This cannot be undone.`}
      />
    </div>
  );
}
