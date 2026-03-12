import React, { useState, useEffect, useMemo } from 'react';
import {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  updatePurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder,
  deletePurchaseOrder, getInventory, getUnits
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur, fmtDate } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const STATUS_META = {
  pending:   { label: 'Pending',   color: '#b07a00', bg: 'rgba(244,165,53,.12)',  icon: '🕐' },
  partial:   { label: 'Partial',   color: '#118ab2', bg: 'rgba(17,138,178,.12)',  icon: '📦' },
  received:  { label: 'Received',  color: '#1db97e', bg: 'rgba(29,185,126,.12)', icon: '✅' },
  cancelled: { label: 'Cancelled', color: '#e84a5f', bg: 'rgba(232,74,95,.10)',  icon: '❌' },
};

const EMPTY_FORM = { supplier: '', supplier_phone: '', supplier_address: '', expected_date: '', notes: '' };
const EMPTY_ITEM = { inventory_item_id: '', unit_id: '', quantity: '', unit_price: '', total: 0, notes: '' };

export default function PurchaseOrderPage() {
  const toast = useToast();
  const [orders, setOrders]       = useState([]);
  const [invItems, setInvItems]   = useState([]);
  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState('');
  const [search, setSearch]       = useState('');
  const [view, setView]           = useState('table');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]     = useState(null);  // PO object
  const [viewModal, setViewModal]     = useState(null);  // PO with items
  const [receiveModal, setReceiveModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Create/Edit form
  const [form, setForm]   = useState(EMPTY_FORM);
  const [poItems, setPoItems] = useState([{ ...EMPTY_ITEM }]);

  // Receive form
  const [receiveData, setReceiveData] = useState({ invoice_no: '', bill_amount: '', notes: '', items: [] });

  // ── Load ─────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [o, inv, u] = await Promise.all([getPurchaseOrders(), getInventory(), getUnits()]);
      if (o.success)   setOrders(o.data);
      if (inv.success) setInvItems(inv.data);
      if (u.success)   setUnits(u.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  // ── Filtering ─────────────────────────────────────────
  const filtered = useMemo(() => orders.filter(o => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search && !o.po_number.toLowerCase().includes(search.toLowerCase())
                && !(o.supplier || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [orders, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { pending: 0, partial: 0, received: 0, cancelled: 0 };
    orders.forEach(o => { if (c[o.status] !== undefined) c[o.status]++; });
    return c;
  }, [orders]);

  // ── PO Item helpers ───────────────────────────────────
  const updatePoItem = (idx, field, val) => {
    setPoItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'inventory_item_id') {
        const item = invItems.find(i => i.id === parseInt(val));
        if (item) {
          next[idx].unit_id = item.unit_id || '';
          next[idx].unit_price = item.purchase_price || '';
        }
      }
      const q = parseFloat(field === 'quantity'   ? val : next[idx].quantity)   || 0;
      const p = parseFloat(field === 'unit_price' ? val : next[idx].unit_price) || 0;
      next[idx].total = q * p;
      return next;
    });
  };

  const poTotal = poItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

  // ── Open create modal ─────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setPoItems([{ ...EMPTY_ITEM }]);
    setCreateModal(true);
  };

  // ── Open edit modal ───────────────────────────────────
  const openEdit = async (po) => {
    setViewLoading(true);
    try {
      const d = await getPurchaseOrder(po.id);
      if (d.success) {
        const p = d.data;
        setForm({ supplier: p.supplier || '', supplier_phone: p.supplier_phone || '', supplier_address: p.supplier_address || '', expected_date: p.expected_date?.split('T')[0] || '', notes: p.notes || '' });
        setPoItems(p.items.map(i => ({ id: i.id, inventory_item_id: i.inventory_item_id, unit_id: i.unit_id || '', quantity: i.ordered_qty, unit_price: i.unit_price, total: i.total_price, notes: i.notes || '' })));
        setEditModal(p);
      }
    } finally { setViewLoading(false); }
  };

  // ── Open view modal ───────────────────────────────────
  const openView = async (po) => {
    setViewLoading(true);
    setViewModal({ ...po, items: [] });
    try {
      const d = await getPurchaseOrder(po.id);
      if (d.success) setViewModal(d.data);
    } finally { setViewLoading(false); }
  };

  // ── Open receive modal ────────────────────────────────
  const openReceive = async (po) => {
    setViewLoading(true);
    try {
      const d = await getPurchaseOrder(po.id);
      if (d.success) {
        const p = d.data;
        setReceiveData({
          invoice_no: p.invoice_no || '',
          bill_amount: p.bill_amount || '',
          notes: '',
          items: p.items.map(i => ({
            item_id: i.id,
            item_name: i.item_name,
            unit_abbr: i.unit_abbr,
            ordered_qty: i.ordered_qty,
            already_received: i.received_qty || 0,
            received_qty: Math.max(0, parseFloat(i.ordered_qty) - parseFloat(i.received_qty || 0)),
            unit_price: i.unit_price,
          }))
        });
        setReceiveModal(p);
      }
    } finally { setViewLoading(false); }
  };

  // ── Save create ───────────────────────────────────────
  const saveCreate = async () => {
    if (!poItems.some(i => i.inventory_item_id && i.quantity)) {
      toast('Add at least one item with quantity.', 'er'); return;
    }
    const validItems = poItems.filter(i => i.inventory_item_id && i.quantity);
    try {
      const d = await createPurchaseOrder({ ...form, items: validItems });
      if (d.success) { toast(`Order ${d.data.po_number} created! ✅`, 'ok'); setCreateModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  // ── Save edit ─────────────────────────────────────────
  const saveEdit = async () => {
    const validItems = poItems.filter(i => i.inventory_item_id && i.quantity);
    if (!validItems.length) { toast('Add at least one item.', 'er'); return; }
    try {
      const d = await updatePurchaseOrder(editModal.id, { ...form, items: validItems });
      if (d.success) { toast('Order updated! ✅', 'ok'); setEditModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  // ── Receive order ─────────────────────────────────────
  const doReceive = async () => {
    const hasAny = receiveData.items.some(i => parseFloat(i.received_qty) > 0);
    if (!hasAny) { toast('Enter received quantity for at least one item.', 'er'); return; }
    try {
      const d = await receivePurchaseOrder(receiveModal.id, {
        invoice_no: receiveData.invoice_no,
        bill_amount: receiveData.bill_amount,
        notes: receiveData.notes,
        items: receiveData.items.map(i => ({ item_id: i.item_id, received_qty: i.received_qty }))
      });
      if (d.success) { toast('Stock updated! Inventory adjusted. ✅', 'ok'); setReceiveModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  // ── Cancel / Delete ───────────────────────────────────
  const doCancel = async () => {
    try {
      const d = await cancelPurchaseOrder(cancelModal.id);
      if (d.success) { toast('Order cancelled.', 'ok'); setCancelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const doDelete = async () => {
    try {
      const d = await deletePurchaseOrder(deleteModal.id);
      if (d.success) { toast('Order deleted.', 'ok'); setDeleteModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  // ── Status badge ──────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const m = STATUS_META[status] || STATUS_META.pending;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: m.bg, color: m.color }}>
        {m.icon} {m.label}
      </span>
    );
  };

  // ── PO Form (shared for create & edit) ────────────────
  const PoForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Supplier info */}
      <div className="recipe-section">
        <div className="recipe-section-title">🏪 Supplier Details</div>
        <div className="mgrid">
          <div>
            <label className="mlabel">Supplier Name</label>
            <input className="mfi" placeholder="e.g. Fresh Farms" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Phone</label>
            <input className="mfi" placeholder="Contact number" value={form.supplier_phone} onChange={e => setForm(f => ({ ...f, supplier_phone: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Expected Delivery Date</label>
            <input className="mfi" type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Notes</label>
            <input className="mfi" placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="mfull">
            <label className="mlabel">Supplier Address</label>
            <input className="mfi" placeholder="Optional address" value={form.supplier_address} onChange={e => setForm(f => ({ ...f, supplier_address: e.target.value }))} />
          </div>
        </div>
      </div>

      <hr className="mdiv" />

      {/* Items */}
      <div className="recipe-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="recipe-section-title" style={{ marginBottom: 0 }}>🧺 Order Items *</div>
          <button type="button" className="btn-add-row" onClick={() => setPoItems(p => [...p, { ...EMPTY_ITEM }])}>
            + Add Item
          </button>
        </div>
        <div className="ri-table">
          <div className="ri-thead">
            <div style={{ width: 22 }}>#</div>
            <div style={{ flex: 2 }}>Item</div>
            <div style={{ width: 80 }}>Qty</div>
            <div style={{ width: 88 }}>Unit</div>
            <div style={{ width: 100 }}>₹/Unit</div>
            <div style={{ width: 96, textAlign: 'right' }}>Total</div>
            <div style={{ width: 30 }}></div>
          </div>
          {poItems.map((item, idx) => (
            <div key={idx} className="ri-row2">
              <div style={{ width: 22, fontSize: 11, fontWeight: 700, color: 'var(--ink2)', flexShrink: 0 }}>{idx + 1}</div>
              <select className="ri-sel" style={{ flex: 2 }}
                value={item.inventory_item_id} onChange={e => updatePoItem(idx, 'inventory_item_id', e.target.value)}>
                <option value="">Select item…</option>
                {invItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category_name})</option>)}
              </select>
              <input className="ri-qty" type="number" placeholder="0" value={item.quantity}
                onChange={e => updatePoItem(idx, 'quantity', e.target.value)} style={{ width: 80 }} />
              <select className="ri-sel" style={{ width: 88 }}
                value={item.unit_id} onChange={e => updatePoItem(idx, 'unit_id', e.target.value)}>
                <option value="">Unit</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
              </select>
              <input className="ri-qty" type="number" placeholder="₹0" value={item.unit_price}
                onChange={e => updatePoItem(idx, 'unit_price', e.target.value)} style={{ width: 100 }} />
              <div className="ri-cost2" style={{ width: 96 }}>{fmtCur(item.total)}</div>
              <button type="button" className="ing-remove-btn"
                onClick={() => poItems.length === 1 ? setPoItems([{ ...EMPTY_ITEM }]) : setPoItems(p => p.filter((_, i) => i !== idx))}>
                ✕
              </button>
            </div>
          ))}
          {/* Total row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 16px', gap: 12, borderTop: '2px solid var(--border)', background: 'rgba(232,87,42,.03)' }}>
            <span style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>Order Total</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(poTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────
  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Purchase Orders</div>
          <div className="ps">Create orders, track delivery and receive items to auto-update inventory</div>
        </div>
        <button className="btn-p" onClick={openCreate}>+ New Order</button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>📋</div><div className="scard-text"><div className="sv">{orders.length}</div><div className="sl">Total Orders</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #b07a00' }}><div style={{ fontSize: 20 }}>🕐</div><div className="scard-text"><div className="sv" style={{ color: '#b07a00' }}>{counts.pending}</div><div className="sl">Pending</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #118ab2' }}><div style={{ fontSize: 20 }}>📦</div><div className="scard-text"><div className="sv" style={{ color: '#118ab2' }}>{counts.partial}</div><div className="sl">Partial</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv">{counts.received}</div><div className="sl">Received</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #e84a5f' }}><div style={{ fontSize: 20 }}>❌</div><div className="scard-text"><div className="sv" style={{ color: '#e84a5f' }}>{counts.cancelled}</div><div className="sl">Cancelled</div></div></div>
      </div>

      {/* List card */}
      <div className="card">
        <div className="ch">
          <div className="ct">All Purchase Orders</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vt-wrap">
              <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
              <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search PO# or supplier…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="fsel" value={statusFilter} onChange={e => setStatus(e.target.value)}>
              <option value="">All Status ({orders.length})</option>
              <option value="pending">🕐 Pending ({counts.pending})</option>
              <option value="partial">📦 Partial ({counts.partial})</option>
              <option value="received">✅ Received ({counts.received})</option>
              <option value="cancelled">❌ Cancelled ({counts.cancelled})</option>
            </select>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0 ? (
          <div className="empty"><div className="ei">📋</div><h4>No purchase orders</h4><p>Create your first order</p></div>
        ) : view === 'table' ? (
          <div className="overflow-x">
            <table>
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Expected</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 13 }}>{o.po_number}</strong>
                      <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{fmtDate(o.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.supplier || '—'}</div>
                      {o.supplier_phone && <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{o.supplier_phone}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{o.item_count} item{o.item_count !== 1 ? 's' : ''}</td>
                    <td><strong>{fmtCur(o.total_amount)}</strong></td>
                    <td style={{ fontSize: 13, color: 'var(--ink2)' }}>{o.expected_date ? o.expected_date.split('T')[0] : '—'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ fontSize: 13 }}>{o.created_by_name}</td>
                    <td>
                      <div className="tact">
                        <button className="bsm bo" onClick={() => openView(o)} title="View details">👁️</button>
                        {o.status === 'pending' && <>
                          <button className="bsm be" onClick={() => openEdit(o)} title="Edit">✏️</button>
                          <button className="bsm bt" style={{ background: 'rgba(29,185,126,.1)', color: 'var(--green)' }}
                            onClick={() => openReceive(o)} title="Receive items">📥 Receive</button>
                          <button className="bsm bd" onClick={() => setCancelModal(o)} title="Cancel">✕</button>
                        </>}
                        {o.status === 'partial' && (
                          <button className="bsm bt" style={{ background: 'rgba(29,185,126,.1)', color: 'var(--green)' }}
                            onClick={() => openReceive(o)} title="Receive remaining">📥 Receive</button>
                        )}
                        <button className="bsm bd" onClick={() => setDeleteModal(o)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="inv-grid" style={{ padding: 20 }}>
            {filtered.map(o => {
              const m = STATUS_META[o.status] || STATUS_META.pending;
              return (
                <div key={o.id} className="inv-card" style={{ borderTop: `3px solid ${m.color}` }}>
                  <div className="inv-card-top">
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: m.bg, flexShrink: 0 }}>
                      {m.icon}
                    </div>
                    <div className="inv-card-info">
                      <h4 style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{o.po_number}</h4>
                      <p>{o.supplier || 'No supplier'}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="inv-card-body">
                    <div className="inv-kv">
                      <div className="k">Total</div>
                      <div className="v">{fmtCur(o.total_amount)}</div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Items</div>
                      <div className="v">{o.item_count}</div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Expected</div>
                      <div className="v" style={{ fontSize: 13 }}>{o.expected_date ? o.expected_date.split('T')[0] : '—'}</div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Created</div>
                      <div className="v" style={{ fontSize: 12 }}>{fmtDate(o.created_at)}</div>
                    </div>
                  </div>
                  <div className="inv-card-foot">
                    <button className="bsm bo" onClick={() => openView(o)}>👁️ View</button>
                    {(o.status === 'pending' || o.status === 'partial') && (
                      <button className="bsm bt" style={{ background: 'rgba(29,185,126,.1)', color: 'var(--green)' }}
                        onClick={() => openReceive(o)}>📥 Receive</button>
                    )}
                    {o.status === 'pending' && <button className="bsm be" onClick={() => openEdit(o)}>✏️</button>}
                    <button className="bsm bd" onClick={() => setDeleteModal(o)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ─────────────────────────────────── */}
      <Modal show={createModal} onClose={() => setCreateModal(false)}
        title="New Purchase Order" subtitle="Create an order for inventory items" wide
        footer={<>
          <button className="btn-c" onClick={() => setCreateModal(false)}>Cancel</button>
          <button className="btn-p" onClick={saveCreate}>Create Order</button>
        </>}>
        <PoForm />
      </Modal>

      {/* ── EDIT MODAL ───────────────────────────────────── */}
      <Modal show={!!editModal} onClose={() => setEditModal(null)}
        title={`Edit Order — ${editModal?.po_number}`} subtitle="Edit pending order" wide
        footer={<>
          <button className="btn-c" onClick={() => setEditModal(null)}>Cancel</button>
          <button className="btn-p" onClick={saveEdit}>Save Changes</button>
        </>}>
        <PoForm />
      </Modal>

      {/* ── VIEW MODAL ───────────────────────────────────── */}
      <Modal show={!!viewModal} onClose={() => setViewModal(null)}
        title={viewModal?.po_number || ''} subtitle={`${STATUS_META[viewModal?.status]?.icon || ''} ${viewModal?.supplier || 'No supplier'}`}
        wide>
        {viewLoading || !viewModal?.items ? <div className="loading-wrap">Loading…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Overview */}
            <div className="view-strip">
              <div className="vs-item"><div className="vs-label">Status</div><div className="vs-val"><StatusBadge status={viewModal.status} /></div></div>
              <div className="vs-item"><div className="vs-label">Total</div><div className="vs-val" style={{ color: 'var(--accent)' }}>{fmtCur(viewModal.total_amount)}</div></div>
              {viewModal.bill_amount && <div className="vs-item"><div className="vs-label">Bill Amt</div><div className="vs-val">{fmtCur(viewModal.bill_amount)}</div></div>}
              <div className="vs-item"><div className="vs-label">Items</div><div className="vs-val">{viewModal.items?.length || 0}</div></div>
              <div className="vs-item"><div className="vs-label">Expected</div><div className="vs-val" style={{ fontSize: 14 }}>{viewModal.expected_date?.split('T')[0] || '—'}</div></div>
            </div>

            {/* Supplier */}
            {(viewModal.supplier || viewModal.supplier_phone || viewModal.supplier_address) && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, border: '1.5px solid var(--border)' }}>
                <div className="view-section-title">🏪 Supplier</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  {viewModal.supplier && <div><span style={{ color: 'var(--ink2)' }}>Name: </span><strong>{viewModal.supplier}</strong></div>}
                  {viewModal.supplier_phone && <div><span style={{ color: 'var(--ink2)' }}>Phone: </span><strong>{viewModal.supplier_phone}</strong></div>}
                  {viewModal.invoice_no && <div><span style={{ color: 'var(--ink2)' }}>Invoice: </span><strong>{viewModal.invoice_no}</strong></div>}
                </div>
                {viewModal.supplier_address && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 8 }}>{viewModal.supplier_address}</div>}
              </div>
            )}

            {/* Items table */}
            <div>
              <div className="view-section-title">🧺 Order Items</div>
              <div className="view-table">
                <div className="vt-head">
                  <div style={{ flex: 2 }}>Item</div>
                  <div style={{ width: 100 }}>Ordered</div>
                  <div style={{ width: 100 }}>Received</div>
                  <div style={{ width: 100 }}>₹/Unit</div>
                  <div style={{ width: 110, textAlign: 'right' }}>Total</div>
                </div>
                {(viewModal.items || []).map((item, idx) => {
                  const pending = parseFloat(item.ordered_qty) - parseFloat(item.received_qty || 0);
                  return (
                    <div key={idx} className="vt-row">
                      <div style={{ flex: 2 }}>
                        <strong>{item.item_name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{item.category_name}</div>
                      </div>
                      <div style={{ width: 100 }}>{item.ordered_qty} {item.unit_abbr}</div>
                      <div style={{ width: 100 }}>
                        <span style={{ color: parseFloat(item.received_qty) >= parseFloat(item.ordered_qty) ? 'var(--green)' : parseFloat(item.received_qty) > 0 ? '#118ab2' : 'var(--ink2)' }}>
                          {item.received_qty || 0} {item.unit_abbr}
                        </span>
                        {pending > 0 && <div style={{ fontSize: 10, color: '#b07a00' }}>Pending: {pending}</div>}
                      </div>
                      <div style={{ width: 100 }}>{fmtCur(item.unit_price)}</div>
                      <div style={{ width: 110, textAlign: 'right', fontWeight: 700 }}>{fmtCur(item.total_price)}</div>
                    </div>
                  );
                })}
                <div className="vt-row vt-subtotal">
                  <div style={{ flex: 2 }}>Grand Total</div>
                  <div style={{ width: 100 }}></div>
                  <div style={{ width: 100 }}></div>
                  <div style={{ width: 100 }}></div>
                  <div style={{ width: 110, textAlign: 'right' }}>{fmtCur(viewModal.total_amount)}</div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {(viewModal.notes || viewModal.receive_notes) && (
              <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                {viewModal.notes && <div>📝 {viewModal.notes}</div>}
                {viewModal.receive_notes && <div style={{ marginTop: 4 }}>📥 Receive note: {viewModal.receive_notes}</div>}
              </div>
            )}

            {/* Receive button from view */}
            {(viewModal.status === 'pending' || viewModal.status === 'partial') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-p" onClick={() => { setViewModal(null); openReceive(viewModal); }}>
                  📥 Receive Items
                </button>
              </div>
            )}
          </div>
        )}
        <div className="mft"><button className="btn-c" onClick={() => setViewModal(null)}>Close</button></div>
      </Modal>

      {/* ── RECEIVE MODAL ───────────────────────────────── */}
      <Modal show={!!receiveModal} onClose={() => setReceiveModal(null)}
        title={`Receive Items — ${receiveModal?.po_number}`}
        subtitle="Enter quantities received. Stock will be updated immediately."
        wide
        footer={<>
          <button className="btn-c" onClick={() => setReceiveModal(null)}>Cancel</button>
          <button className="btn-p" style={{ background: 'var(--green)' }} onClick={doReceive}>
            ✅ Confirm Receipt & Update Stock
          </button>
        </>}>
        {receiveModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Bill details */}
            <div className="recipe-section">
              <div className="recipe-section-title">🧾 Bill Details</div>
              <div className="mgrid">
                <div>
                  <label className="mlabel">Invoice / Bill No.</label>
                  <input className="mfi" placeholder="e.g. INV-2024-001" value={receiveData.invoice_no}
                    onChange={e => setReceiveData(d => ({ ...d, invoice_no: e.target.value }))} />
                </div>
                <div>
                  <label className="mlabel">Bill Amount (₹)</label>
                  <input className="mfi" type="number" placeholder="Total billed amount"
                    value={receiveData.bill_amount}
                    onChange={e => setReceiveData(d => ({ ...d, bill_amount: e.target.value }))} />
                </div>
                <div className="mfull">
                  <label className="mlabel">Receive Notes</label>
                  <input className="mfi" placeholder="e.g. Some items damaged…" value={receiveData.notes}
                    onChange={e => setReceiveData(d => ({ ...d, notes: e.target.value }))} />
                </div>
              </div>
            </div>

            <hr className="mdiv" />

            {/* Items to receive */}
            <div className="recipe-section">
              <div className="recipe-section-title">📦 Items Received</div>
              <div className="ri-table">
                <div className="ri-thead">
                  <div style={{ flex: 2 }}>Item</div>
                  <div style={{ width: 90 }}>Ordered</div>
                  <div style={{ width: 90 }}>Already Rcvd</div>
                  <div style={{ width: 110 }}>Receiving Now *</div>
                  <div style={{ width: 100, textAlign: 'right' }}>Value</div>
                </div>
                {receiveData.items.map((item, idx) => {
                  const max = parseFloat(item.ordered_qty) - parseFloat(item.already_received || 0);
                  return (
                    <div key={idx} className="ri-row2">
                      <div style={{ flex: 2 }}>
                        <strong>{item.item_name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{item.unit_abbr}</div>
                      </div>
                      <div style={{ width: 90, fontSize: 13 }}>{item.ordered_qty} {item.unit_abbr}</div>
                      <div style={{ width: 90, fontSize: 13, color: item.already_received > 0 ? '#118ab2' : 'var(--ink2)' }}>
                        {item.already_received || 0}
                      </div>
                      <div style={{ width: 110 }}>
                        <input
                          className="ri-qty"
                          type="number"
                          min="0"
                          max={max}
                          placeholder="0"
                          value={item.received_qty}
                          style={{ width: 100 }}
                          onChange={e => {
                            const val = Math.min(parseFloat(e.target.value) || 0, max);
                            setReceiveData(d => ({
                              ...d,
                              items: d.items.map((x, i) => i === idx ? { ...x, received_qty: val } : x)
                            }));
                          }}
                        />
                        {max > 0 && <div style={{ fontSize: 10, color: 'var(--ink2)', marginTop: 2 }}>max {max}</div>}
                      </div>
                      <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                        {fmtCur((parseFloat(item.received_qty) || 0) * parseFloat(item.unit_price))}
                      </div>
                    </div>
                  );
                })}
                {/* Summary */}
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', background: 'rgba(29,185,126,.04)', borderTop: '2px solid rgba(29,185,126,.2)' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>Stock Value Being Added</span>
                  <strong style={{ color: 'var(--green)', fontSize: 16 }}>
                    {fmtCur(receiveData.items.reduce((s, i) => s + (parseFloat(i.received_qty) || 0) * parseFloat(i.unit_price), 0))}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── CANCEL / DELETE CONFIRMS ─────────────────────── */}
      <ConfirmModal show={!!cancelModal} onClose={() => setCancelModal(null)} onConfirm={doCancel}
        title="Cancel Order" message={`Cancel order ${cancelModal?.po_number}? This cannot be undone.`} />
      <ConfirmModal show={!!deleteModal} onClose={() => setDeleteModal(null)} onConfirm={doDelete}
        title="Delete Order" message={`Permanently delete ${deleteModal?.po_number}?`} />
    </div>
  );
}
