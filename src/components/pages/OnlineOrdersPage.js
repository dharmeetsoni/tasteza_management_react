import React, { useState, useEffect, useCallback } from 'react';
import { getOnlineOrders, updateOnlineOrderStatus } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useWSEvent } from '../../context/WSContext';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
const STATUS_LABELS = {
  pending: { label: 'Pending', color: '#f59e0b', bg: '#fffbeb', icon: '🕐' },
  confirmed: { label: 'Confirmed', color: '#3b82f6', bg: '#eff6ff', icon: '✅' },
  preparing: { label: 'Preparing', color: '#8b5cf6', bg: '#f5f3ff', icon: '🍳' },
  ready: { label: 'Ready', color: '#1db97e', bg: '#f0fdf4', icon: '🔔' },
  delivered: { label: 'Delivered', color: '#6b7280', bg: '#f9fafb', icon: '🏁' },
  cancelled: { label: 'Cancelled', color: '#e84a5f', bg: '#fef2f2', icon: '✕' },
  payment_failed: { label: 'Pay Failed', color: '#dc2626', bg: '#fef2f2', icon: '⚠️' },
};

const NEXT_ACTION = {
  pending: { label: 'Accept Order', next: 'confirmed', style: { background: '#1db97e', color: '#fff' } },
  confirmed: { label: 'Start Preparing', next: 'preparing', style: { background: '#8b5cf6', color: '#fff' } },
  preparing: { label: 'Mark Ready', next: 'ready', style: { background: '#f59e0b', color: '#fff' } },
  ready: { label: 'Mark Delivered', next: 'delivered', style: { background: '#1db97e', color: '#fff' } },
};

const fmt = (n) => `\u20b9${Number(n || 0).toFixed(0)}`;
const timeAgo = (dt) => {
  if (!dt) return '';
  const diff = Math.floor((Date.now() - new Date(dt)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

function OrderCard({ order, onStatusChange }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(order.items || []);
  const [loadingItems, setLoadingItems] = useState(false);
  const [actioning, setActioning] = useState(false);

  const st = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
  const nextAction = NEXT_ACTION[order.status];

  const loadItems = useCallback(async () => {
    if (items.length || loadingItems) return;
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/online-orders/${order.id}`);
      const d = await res.json();
      if (d.success && d.data.items) setItems(d.data.items);
    } catch { }
    finally { setLoadingItems(false); }
  }, [order.id, items.length, loadingItems]);

  const handleExpand = () => {
    if (!expanded) loadItems();
    setExpanded(e => !e);
  };

  const handleAction = async (newStatus, label) => {
    if (!window.confirm(`${label}?`)) return;
    setActioning(true);
    try {
      const d = await updateOnlineOrderStatus(order.id, { status: newStatus });
      if (d.success) {
        toast(`Order #${order.id} — ${label}`, 'ok');
        onStatusChange(order.id, newStatus);
      } else toast(d.message || 'Update failed', 'er');
    } catch { toast('Error updating status', 'er'); }
    finally { setActioning(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1.5px solid ${st.color}33`, marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Header row */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={handleExpand}>
        <div style={{ fontSize: 20 }}>{st.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: 15 }}>Order #{order.id}</span>
            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: st.bg, color: st.color }}>{st.label}</span>
            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#f4f4f5', color: '#6b7280', textTransform: 'capitalize' }}>
              {(order.order_type || '').replace('_', ' ')}
            </span>
            {order.payment_method === 'phonepay' && (
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: '#fff7ed', color: '#ea580c' }}>
                PhonePe {order.payment_status === 'paid' ? '✓' : order.payment_status || ''}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {order.customer_name || 'Guest'}{order.customer_phone ? ` · +91${order.customer_phone}` : ''} · {timeAgo(order.created_at)}
          </div>
          {order.delivery_address && (
            <div style={{ fontSize: 11, color: '#e23744', marginTop: 2 }}>📍 {order.delivery_address}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: '#1c1c1c' }}>{fmt(order.total)}</div>
          {order.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{order.notes}"</div>}
        </div>
        <span style={{ fontSize: 18, color: '#9ca3af', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f4f4f5', padding: '12px 16px', background: '#fafafa' }}>
          {/* Items */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 }}>ORDER ITEMS</div>
            {loadingItems ? (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>No items found</div>
            ) : items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>{item.quantity}×</span> {item.name}
                  {item.addon_data && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>+ addons</span>}
                </span>
                <span style={{ fontWeight: 700 }}>{fmt(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Bill breakdown */}
          <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 12, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
            </div>
            {Number(order.gst_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                <span>GST</span><span>{fmt(order.gst_amount)}</span>
              </div>
            )}
            {Number(order.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#1db97e', marginBottom: 4 }}>
                <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span><span>-{fmt(order.discount_amount)}</span>
              </div>
            )}
            {Number(order.delivery_charge) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                <span>Delivery</span><span>{fmt(order.delivery_charge)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 13, borderTop: '1px dashed #e5e7eb', paddingTop: 6, marginTop: 4 }}>
              <span>Total</span><span>{fmt(order.total)}</span>
            </div>
          </div>

          {/* Actions */}
          {order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'payment_failed' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {nextAction && (
                <button
                  style={{ ...nextAction.style, padding: '9px 18px', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: actioning ? 0.7 : 1 }}
                  onClick={() => handleAction(nextAction.next, nextAction.label)}
                  disabled={actioning}
                >
                  {actioning ? 'Updating…' : nextAction.label}
                </button>
              )}
              {order.status === 'pending' && (
                <button
                  style={{ padding: '9px 18px', background: '#fef2f2', color: '#e84a5f', border: '1.5px solid #fecaca', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  onClick={() => handleAction('cancelled', 'Cancel Order')}
                  disabled={actioning}
                >
                  Reject
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TABS = ['all', 'pending', 'active', 'delivered', 'cancelled'];
const TAB_LABEL = { all: 'All', pending: 'Pending', active: 'Active', delivered: 'Done', cancelled: 'Cancelled' };

export default function OnlineOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('pending');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await getOnlineOrders();
      if (d.success) setOrders(d.data);
      else toast(d.message || 'Load failed', 'er');
    } catch { toast('Failed to load orders', 'er'); }
    finally { if (!silent) setLoading(false); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // Real-time updates
  useWSEvent('new_online_order', () => load(true));
  useWSEvent('online_order_status', () => load(true));

  const handleStatusChange = (id, newStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const filtered = orders.filter(o => {
    if (tab === 'all') return true;
    if (tab === 'pending') return o.status === 'pending';
    if (tab === 'active') return ['confirmed', 'preparing', 'ready'].includes(o.status);
    if (tab === 'delivered') return o.status === 'delivered';
    if (tab === 'cancelled') return ['cancelled', 'payment_failed'].includes(o.status);
    return true;
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const activeCount = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length;

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="ph" style={{ marginBottom: 16 }}>
        <div className="ph-left">
          <div className="pt">🛵 Online Orders</div>
          <div className="ps">Manage and track all incoming online orders</div>
        </div>
        <button className="btn-c" onClick={() => load()} style={{ fontSize: 13 }}>
          🔄 Refresh
        </button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Pending', count: pendingCount, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Active', count: activeCount, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Total Today', count: orders.length, color: '#6b7280', bg: '#f9fafb' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} style={{ padding: '8px 20px', background: bg, borderRadius: 20, border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 900, fontSize: 18, color }}>{count}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '2px solid var(--border)', paddingBottom: 6 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--ink2)',
            }}
          >
            {TAB_LABEL[t]}
            {t === 'pending' && pendingCount > 0 && (
              <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink2)', fontSize: 15 }}>Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ color: 'var(--ink2)', fontSize: 15 }}>No {TAB_LABEL[tab].toLowerCase()} orders</div>
        </div>
      ) : (
        filtered.map(order => (
          <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
        ))
      )}
    </div>
  );
}
