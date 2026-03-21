import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getMenuItemsAll, zomatoImport, fixZomatoOrderItem, getOrdersList } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur, fmtDate } from '../../utils';
import Modal from '../ui/Modal';

// ── Parse Zomato CSV text → array of row objects ─────────────────────────────
function parseCSVLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  cols.push(cur.trim());
  return cols;
}

function parseZomatoCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return {
      zomato_order_id:  row['Order ID'],
      order_placed_at:  row['Order Placed At'],
      order_status:     row['Order Status'],
      items_str:        row['Items in order'],
      bill_subtotal:    parseFloat(row['Bill subtotal']) || 0,
      total_received:   parseFloat(row['Total']) || 0,
      rating:           row['Rating'],
      instructions:     row['Instructions'],
      discount_promo:   parseFloat(row['Restaurant discount (Promo)']) || 0,
      packaging:        parseFloat(row['Packaging charges']) || 0,
    };
  }).filter(r => r.zomato_order_id && r.order_status === 'Delivered');
}

// ── Parse item string "2 x Full Thali, 1 x Paneer Chilli Dry" ────────────────
function parseItems(itemsStr) {
  return (itemsStr || '').split(',').map(part => {
    const m = part.trim().match(/^(\d+)\s*x\s*(.+)$/i);
    if (!m) return null;
    return { qty: parseInt(m[1]), item_name: m[2].trim() };
  }).filter(Boolean);
}

// ── Spice/veg badge ──────────────────────────────────────────────────────────
const VegBadge = ({ is_veg }) => (
  <span style={{ fontSize: 10, marginLeft: 4 }}>{is_veg ? '🟢' : '🔴'}</span>
);

// ── Single order preview card ─────────────────────────────────────────────────
function OrderPreviewCard({ row, menuMap }) {
  const items    = parseItems(row.items_str);
  const allMatch = items.every(it => menuMap[it.item_name.toLowerCase()]);
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12, overflow: 'hidden',
      border: `1.5px solid ${allMatch ? 'var(--border)' : 'rgba(232,74,95,.3)'}`,
    }}>
      <div style={{ height: 3, background: allMatch ? 'var(--green)' : '#e84a5f' }} />
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: 'var(--accent)' }}>
              ZOM-{row.zomato_order_id.slice(-8)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 1 }}>{row.order_placed_at}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>₹{row.total_received}</div>
            {row.discount_promo > 0 && (
              <div style={{ fontSize: 10, color: '#e84a5f' }}>-₹{row.discount_promo} discount</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((it, i) => {
            const mi = menuMap[it.item_name.toLowerCase()];
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '3px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink2)', minWidth: 18 }}>{it.qty}×</span>
                  <span style={{ fontWeight: 600 }}>{it.item_name}</span>
                  {mi ? <VegBadge is_veg={mi.is_veg} /> : null}
                </div>
                {mi ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    background: 'rgba(29,185,126,.1)', color: 'var(--green)' }}>✓ Matched</span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    background: 'rgba(232,74,95,.1)', color: '#e84a5f' }}>⚠ Unmatched</span>
                )}
              </div>
            );
          })}
        </div>
        {!allMatch && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#e84a5f', fontWeight: 600 }}>
            ⚠ Unmatched items will be imported without inventory deduction
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post-import order edit modal ──────────────────────────────────────────────
function EditOrderModal({ order, menuItems, onSave, onClose }) {
  const toast = useToast();
  const [items, setItems]   = useState(order.items || []);
  const [saving, setSaving] = useState({});

  const fixItem = async (oi, menuItemId) => {
    setSaving(s => ({ ...s, [oi.id]: true }));
    try {
      const r = await fixZomatoOrderItem(oi.id, { menu_item_id: menuItemId });
      if (r.success) {
        const mi = menuItems.find(m => m.id === parseInt(menuItemId));
        setItems(prev => prev.map(it => it.id === oi.id
          ? { ...it, menu_item_id: mi?.id, item_name: mi?.name || it.item_name }
          : it));
        toast('Item updated & inventory adjusted ✅', 'ok');
        onSave();
      } else toast(r.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
    setSaving(s => ({ ...s, [oi.id]: false }));
  };

  return (
    <Modal show onClose={onClose}
      title={`Edit Zomato Order — ${order.order_number}`}
      subtitle="Fix unmatched items to enable inventory deduction"
      wide
      footer={<button className="btn-p" onClick={onClose}>Done</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(oi => {
          const matched = !!oi.menu_item_id;
          return (
            <div key={oi.id} style={{
              padding: '12px 14px', borderRadius: 10,
              border: `1.5px solid ${matched ? 'rgba(29,185,126,.25)' : 'rgba(232,74,95,.3)'}`,
              background: matched ? 'rgba(29,185,126,.04)' : 'rgba(232,74,95,.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: matched ? 0 : 10 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{oi.quantity}× {oi.item_name}</span>
                  {matched && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700,
                      color: 'var(--green)', padding: '2px 7px', borderRadius: 20,
                      background: 'rgba(29,185,126,.12)' }}>✓ Matched</span>
                  )}
                </div>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtCur(oi.total_price)}</span>
              </div>
              {!matched && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#e84a5f', fontWeight: 600, flexShrink: 0 }}>⚠ Unmatched — select menu item:</span>
                  <select className="mfi" style={{ flex: 1, margin: 0 }}
                    disabled={saving[oi.id]}
                    defaultValue=""
                    onChange={e => e.target.value && fixItem(oi, e.target.value)}>
                    <option value="">— Select menu item —</option>
                    {menuItems.map(mi => (
                      <option key={mi.id} value={mi.id}>{mi.is_veg ? '🟢' : '🔴'} {mi.name} — {fmtCur(mi.selling_price)}</option>
                    ))}
                  </select>
                  {saving[oi.id] && <span style={{ fontSize: 12, color: 'var(--ink2)' }}>⏳</span>}
                </div>
              )}
              {matched && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink2)', flexShrink: 0 }}>Change item:</span>
                  <select className="mfi" style={{ flex: 1, margin: 0, fontSize: 12 }}
                    disabled={saving[oi.id]}
                    value={oi.menu_item_id || ''}
                    onChange={e => e.target.value && fixItem(oi, e.target.value)}>
                    <option value="">— Keep current —</option>
                    {menuItems.map(mi => (
                      <option key={mi.id} value={mi.id}>{mi.is_veg ? '🟢' : '🔴'} {mi.name} — {fmtCur(mi.selling_price)}</option>
                    ))}
                  </select>
                  {saving[oi.id] && <span style={{ fontSize: 12, color: 'var(--ink2)' }}>⏳</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ZomatoImportPage() {
  const toast = useToast();
  const fileRef = useRef(null);

  const [menuItems, setMenuItems]     = useState([]);
  const [loading, setLoading]         = useState(true);

  // CSV parse step
  const [csvRows, setCsvRows]         = useState([]);         // parsed but not imported
  const [csvError, setCsvError]       = useState('');

  // Import flow
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState(null);    // { imported, skipped }

  // History tab
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo]     = useState('');
  const [activeTab, setActiveTab]     = useState('import'); // 'import' | 'history'

  // Edit modal
  const [editOrder, setEditOrder]     = useState(null);
  const [editOrderItems, setEditOrderItems] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getMenuItemsAll();
      if (r.success) setMenuItems(r.data.filter(i => i.is_active));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Build exact match map
  const menuMap = useMemo(() => {
    const m = {};
    menuItems.forEach(mi => { m[mi.name.toLowerCase().trim()] = mi; });
    return m;
  }, [menuItems]);

  // ── Load history ────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const from  = historyFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to    = historyTo   || today;
      const r = await getOrdersList({ from, to, limit: 500 });
      if (r.success) {
        setHistoryOrders(r.data.filter(o => o.source === 'zomato'));
      }
    } finally { setHistoryLoading(false); }
  }, [historyFrom, historyTo]);

  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  // ── CSV file parse ───────────────────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setCsvError('Please upload a .csv file'); return; }
    setCsvError('');
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseZomatoCsv(e.target.result);
      if (!rows.length) { setCsvError('No valid delivered orders found in CSV.'); return; }
      setCsvRows(rows);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  // ── Import ───────────────────────────────────────────────────────────────
  const doImport = async () => {
    if (!csvRows.length) return;
    setImporting(true);
    try {
      const r = await zomatoImport({ orders: csvRows });
      if (r.success) {
        setImportResult(r.data);
        setCsvRows([]);
        toast(`✅ Imported ${r.data.imported.length} orders!`, 'ok');
        loadHistory();
        setActiveTab('history');
      } else toast(r.message || 'Import failed', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Import failed', 'er'); }
    setImporting(false);
  };

  // ── Open edit for a history order ────────────────────────────────────────
  const openEdit = async (order) => {
    // Fetch full order with items
    try {
      const { getOrder } = await import('../../api');
      const r = await getOrder(order.id);
      if (r.success) {
        setEditOrderItems(r.data.items || []);
        setEditOrder(r.data);
      }
    } catch { toast('Could not load order', 'er'); }
  };

  // ── Stats computed from csvRows preview ──────────────────────────────────
  const previewStats = useMemo(() => {
    let totalRevenue = 0, totalOrders = csvRows.length, unmatchedItems = 0;
    csvRows.forEach(row => {
      totalRevenue += row.total_received;
      parseItems(row.items_str).forEach(it => {
        if (!menuMap[it.item_name.toLowerCase()]) unmatchedItems++;
      });
    });
    return { totalRevenue, totalOrders, unmatchedItems };
  }, [csvRows, menuMap]);

  // ── History stats ────────────────────────────────────────────────────────
  const historyStats = useMemo(() => {
    const total   = historyOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
    const orders  = historyOrders.length;
    const avgOrder = orders ? total / orders : 0;
    return { total, orders, avgOrder };
  }, [historyOrders]);

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">🍊 Zomato Import</div>
          <div className="ps">Import Zomato CSV exports — auto-matches menu items & deducts inventory</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
          <button className="btn-p"
            style={{ background: '#e84b3a' }}
            onClick={() => { fileRef.current.value = ''; fileRef.current.click(); }}>
            📂 Upload Zomato CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {[['import', '📥 Import'], ['history', '📋 History']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ padding: '10px 22px', fontWeight: 700, fontSize: 13, border: 'none',
              background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              color: activeTab === id ? 'var(--accent)' : 'var(--ink2)',
              borderBottom: activeTab === id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, transition: 'all .12s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── IMPORT TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div>
          {/* Import result banner */}
          {importResult && (
            <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12,
              background: 'rgba(29,185,126,.08)', border: '1.5px solid rgba(29,185,126,.25)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--green)', marginBottom: 4 }}>
                ✅ Import Complete
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                <strong style={{ color: 'var(--ink)' }}>{importResult.imported.length}</strong> orders imported &nbsp;·&nbsp;
                <strong style={{ color: 'var(--ink)' }}>{importResult.skipped.length}</strong> skipped (duplicates) &nbsp;·&nbsp;
                Check <strong>History</strong> tab to edit unmatched items
              </div>
            </div>
          )}

          {/* Drop zone — shown when no CSV loaded */}
          {csvRows.length === 0 && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => { fileRef.current.value = ''; fileRef.current.click(); }}
              style={{ border: '2.5px dashed var(--border)', borderRadius: 16, padding: '52px 32px',
                textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
                background: 'var(--surface)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🍊</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Drop Zomato CSV here</div>
              <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 16 }}>
                Download from Zomato Partner Dashboard → Reports → Order History → Export CSV
              </div>
              <button className="btn-p" style={{ background: '#e84b3a' }} type="button"
                onClick={e => { e.stopPropagation(); fileRef.current.value = ''; fileRef.current.click(); }}>
                📂 Browse File
              </button>
              {csvError && (
                <div style={{ marginTop: 12, color: '#e84a5f', fontSize: 13, fontWeight: 600 }}>{csvError}</div>
              )}
            </div>
          )}

          {/* Preview */}
          {csvRows.length > 0 && (
            <div>
              {/* Stats row */}
              <div className="stats-row" style={{ marginBottom: 16 }}>
                <div className="scard">
                  <div style={{ fontSize: 22 }}>📋</div>
                  <div className="scard-text"><div className="sv">{previewStats.totalOrders}</div><div className="sl">Orders</div></div>
                </div>
                <div className="scard accent-card">
                  <div style={{ fontSize: 22 }}>💰</div>
                  <div className="scard-text"><div className="sv">{fmtCur(previewStats.totalRevenue)}</div><div className="sl">Total Revenue</div></div>
                </div>
                <div className="scard" style={{ borderTop: previewStats.unmatchedItems > 0 ? '3px solid #e84a5f' : '3px solid var(--green)' }}>
                  <div style={{ fontSize: 22 }}>{previewStats.unmatchedItems > 0 ? '⚠️' : '✅'}</div>
                  <div className="scard-text">
                    <div className="sv" style={{ color: previewStats.unmatchedItems > 0 ? '#e84a5f' : 'var(--green)' }}>
                      {previewStats.unmatchedItems}
                    </div>
                    <div className="sl">Unmatched Items</div>
                  </div>
                </div>
              </div>

              {previewStats.unmatchedItems > 0 && (
                <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 10,
                  background: 'rgba(245,158,11,.08)', border: '1.5px solid rgba(245,158,11,.3)',
                  fontSize: 13, color: '#b07a00' }}>
                  ⚠️ <strong>{previewStats.unmatchedItems}</strong> item(s) not found in your menu.
                  They will be imported but <strong>inventory won't be deducted</strong> for them.
                  You can fix them after import from the History tab.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Preview — {csvRows.length} orders</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-c" onClick={() => { setCsvRows([]); setImportResult(null); }}>✕ Clear</button>
                  <button className="btn-p" style={{ background: '#e84b3a' }}
                    disabled={importing} onClick={doImport}>
                    {importing ? '⏳ Importing…' : `🍊 Import ${csvRows.length} Orders`}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {csvRows.map(row => (
                  <OrderPreviewCard key={row.zomato_order_id} row={row} menuMap={menuMap} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div>
          {/* Filters */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="ch">
              <div className="ct">Zomato Order History</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--ink2)' }}>From</span>
                  <input type="date" className="mfi" style={{ margin: 0, padding: '6px 10px', fontSize: 13, width: 140 }}
                    value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} />
                  <span style={{ color: 'var(--ink2)' }}>To</span>
                  <input type="date" className="mfi" style={{ margin: 0, padding: '6px 10px', fontSize: 13, width: 140 }}
                    value={historyTo} onChange={e => setHistoryTo(e.target.value)} />
                </div>
                <button className="btn-c" onClick={loadHistory}>🔄 Refresh</button>
              </div>
            </div>

            {/* Stats */}
            {!historyLoading && historyOrders.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: 'Zomato Orders', value: historyStats.orders, icon: '📋' },
                  { label: 'Total Revenue', value: fmtCur(historyStats.total), icon: '💰' },
                  { label: 'Avg Order Value', value: fmtCur(historyStats.avgOrder), icon: '📊' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px', background: 'var(--bg)', borderRadius: 10 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {historyLoading ? (
              <div className="loading-wrap">Loading…</div>
            ) : historyOrders.length === 0 ? (
              <div className="empty">
                <div className="ei">🍊</div>
                <h4>No Zomato orders found</h4>
                <p>Import a CSV to see orders here</p>
              </div>
            ) : (
              <div className="overflow-x">
                <table>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date & Time</th>
                      <th>Items</th>
                      <th>Subtotal</th>
                      <th>Discount</th>
                      <th>Received</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOrders.map(o => {
                      const hasUnmatched = false; // we detect from items when editing
                      return (
                        <tr key={o.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14 }}>🍊</span>
                              <div>
                                <strong style={{ fontFamily: 'monospace', color: '#e84b3a', fontSize: 12 }}>
                                  {o.order_number}
                                </strong>
                                {o.zomato_order_id && (
                                  <div style={{ fontSize: 10, color: 'var(--ink2)' }}>#{o.zomato_order_id}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink2)' }}>
                            {o.paid_at_fmt || fmtDate(o.created_at)}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {o.item_count || '—'} item{o.item_count !== 1 ? 's' : ''}
                          </td>
                          <td>{fmtCur(o.subtotal)}</td>
                          <td style={{ color: '#e84a5f' }}>
                            {o.discount_amount > 0 ? `-${fmtCur(o.discount_amount)}` : '—'}
                          </td>
                          <td><strong style={{ color: 'var(--green)' }}>{fmtCur(o.total_amount)}</strong></td>
                          <td>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                              background: 'rgba(232,75,58,.1)', color: '#e84b3a',
                              border: '1px solid rgba(232,75,58,.3)' }}>
                              🍊 Zomato
                            </span>
                          </td>
                          <td>
                            <button className="bsm be" onClick={() => openEdit(o)} title="Edit items">✏️ Fix Items</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ───────────────────────────────────────────────────── */}
      {editOrder && (
        <EditOrderModal
          order={{ ...editOrder, items: editOrderItems }}
          menuItems={menuItems}
          onSave={() => { loadHistory(); }}
          onClose={() => { setEditOrder(null); setEditOrderItems([]); }}
        />
      )}
    </div>
  );
}