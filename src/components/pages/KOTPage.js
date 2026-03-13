import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getKOTs, getKOT, updateKOTStatus, deleteKOT } from '../../api';
import ConfirmModal from '../ui/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import Modal from '../ui/Modal';
import { useWS, useWSEvent } from '../../context/WSContext';

const STATUS_META = {
  pending:   { label: 'Pending',   color: '#b07a00', bg: 'rgba(244,165,53,.12)', icon: '🕐' },
  preparing: { label: 'Preparing', color: '#118ab2', bg: 'rgba(17,138,178,.12)', icon: '👨‍🍳' },
  ready:     { label: 'Ready',     color: '#1db97e', bg: 'rgba(29,185,126,.12)', icon: '✅' },
  served:    { label: 'Served',    color: '#888',    bg: 'rgba(150,150,150,.1)', icon: '🍽️' },
};

// KOT Print slip component
const KOTPrint = React.forwardRef(({ kot }, ref) => {
  if (!kot) return null;
  const items = kot.items || [];
  const dt = new Date(kot.created_at);
  const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return (
    <div ref={ref} style={{ fontFamily: 'monospace', fontSize: 13, width: 280, padding: 16, background: '#fff', color: '#000' }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 4, marginBottom: 2 }}>KITCHEN ORDER TICKET</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1 }}>{kot.kot_number}</div>
        <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }} />
      </div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Table:</strong> {kot.table_number || (kot.order_type === 'parcel' ? '📦 PARCEL' : 'TAKEAWAY')}</span>
          <span>{timeStr}</span>
        </div>
        <div><strong>Order:</strong> {kot.order_number}</div>
        <div style={{ fontSize: 11, color: '#555' }}>{dateStr}</div>
      </div>
      <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }} />
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px dashed #000' }}>
            <th style={{ textAlign: 'left', paddingBottom: 4, fontSize: 11 }}>ITEM</th>
            <th style={{ textAlign: 'center', width: 40, fontSize: 11 }}>QTY</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              <tr>
                <td style={{ paddingTop: 5, fontWeight: 700 }}>{item.item_name}</td>
                <td style={{ textAlign: 'center', fontWeight: 900, fontSize: 16 }}>{item.quantity}</td>
              </tr>
              {(item.kot_instructions || item.notes) && (
                <tr>
                  <td colSpan={2} style={{ paddingBottom: 4, paddingLeft: 8, fontSize: 11, fontStyle: 'italic', color: '#444' }}>
                    ↳ {item.kot_instructions || item.notes}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {kot.instructions && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ fontSize: 12 }}><strong>⚠️ Instructions:</strong></div>
          <div style={{ fontSize: 12, fontStyle: 'italic', marginTop: 3 }}>{kot.instructions}</div>
        </>
      )}
      <div style={{ borderTop: '2px dashed #000', margin: '10px 0 4px', textAlign: 'center', fontSize: 10 }}>
        — END OF KOT —
      </div>
    </div>
  );
});

export default function KOTPage() {
  const toast = useToast();
  const { connected } = useWS() || { connected: false };
  const printRef = useRef(null);

  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewKOT, setViewKOT] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await getKOTs();
      if (d.success) setKots(d.data);
    } finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // ── Real-time WS sync ─────────────────────────────────
  useWSEvent('kot_new',        () => { void load(true); });
  useWSEvent('kot_status',     () => { void load(true); });
  useWSEvent('order_created',  () => { void load(true); });
  useWSEvent('order_updated',  () => { void load(true); });
  useWSEvent('order_paid',     () => { void load(true); });

  const counts = useMemo(() => {
    const c = { pending: 0, preparing: 0, ready: 0, served: 0 };
    kots.forEach(k => { if (c[k.status] !== undefined) c[k.status]++; });
    return c;
  }, [kots]);

  const filtered = useMemo(() => kots.filter(k => {
    if (statusFilter && k.status !== statusFilter) return false;
    if (search && !k.kot_number.toLowerCase().includes(search.toLowerCase())
      && !(k.table_number || '').toLowerCase().includes(search.toLowerCase())
      && !(k.order_number || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [kots, statusFilter, search]);

  const openView = async (kot) => {
    setViewLoading(true);
    setViewKOT({ ...kot, items: [] });
    try {
      const d = await getKOT(kot.id);
      if (d.success) setViewKOT(d.data);
    } finally { setViewLoading(false); }
  };

  const [delKOT, setDelKOT] = useState(null);

  const changeStatus = async (id, status) => {
    try {
      await updateKOTStatus(id, status);
      toast(`Status → ${STATUS_META[status]?.label}`, 'ok');
      setKots(prev => prev.map(k => k.id === id ? { ...k, status } : k));
      if (viewKOT?.id === id) setViewKOT(v => ({ ...v, status }));
    } catch { toast('Error', 'er'); }
  };

  const doDeleteKOT = async () => {
    if (!delKOT) return;
    try {
      const d = await deleteKOT(delKOT.id);
      if (d.success) {
        toast(`KOT ${delKOT.kot_number} deleted`, 'ok');
        setKots(prev => prev.filter(k => k.id !== delKOT.id));
        if (viewKOT?.id === delKOT.id) setViewKOT(null);
      } else toast(d.message || 'Delete failed', 'er');
    } catch { toast('Error', 'er'); }
    finally { setDelKOT(null); }
  };

  const printKOT = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=360,height=600');
    win.document.write(`<html><head><title>KOT</title><style>body{margin:0;font-family:monospace}@media print{body{margin:0}}</style></head><body>${content}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    win.document.close();
  };

  const timeSince = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ${m % 60}m ago`;
  };

  const StatusBadge = ({ status, small }) => {
    const m = STATUS_META[status] || STATUS_META.pending;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: small ? '3px 8px' : '4px 10px', borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 700, background: m.bg, color: m.color }}>
        {m.icon} {m.label}
      </span>
    );
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">🍳 KOT Manager</div>
          <div className="ps">Track kitchen orders · {connected ? <span style={{color:'#1db97e',fontWeight:700}}>● Live sync ON</span> : <span style={{color:'#e84a5f',fontWeight:700}}>● Offline</span>}</div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:700,background:connected?'rgba(29,185,126,.1)':'rgba(232,74,95,.08)',color:connected?'#1db97e':'#e84a5f',border:`1.5px solid ${connected?'#1db97e':'#e84a5f'}`}}>
            {connected ? '🔴 LIVE' : '⚫ OFFLINE'}
          </div>
          <button className="btn-c" onClick={load}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="scard" style={{ borderTop: '3px solid #b07a00' }}><div style={{ fontSize: 20 }}>🕐</div><div className="scard-text"><div className="sv" style={{ color: '#b07a00' }}>{counts.pending}</div><div className="sl">Pending</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #118ab2' }}><div style={{ fontSize: 20 }}>👨‍🍳</div><div className="scard-text"><div className="sv" style={{ color: '#118ab2' }}>{counts.preparing}</div><div className="sl">Preparing</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #1db97e' }}><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv" style={{ color: '#1db97e' }}>{counts.ready}</div><div className="sl">Ready</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>🍽️</div><div className="scard-text"><div className="sv">{counts.served}</div><div className="sl">Served</div></div></div>
      </div>

      {/* Filter tabs */}
      <div className="card">
        <div className="ch">
          <div className="ct">All KOT Tickets</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search KOT#, table, order…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="fsel" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status ({kots.length})</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label} ({counts[k]})</option>
              ))}
            </select>
          </div>
        </div>

        {/* KOT cards grid */}
        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0 ?
          <div className="empty"><div className="ei">🍳</div><h4>No KOT tickets</h4><p>KOTs will appear here when sent from POS</p></div>
          : (
            <div className="kot-grid">
              {filtered.map(kot => {
                const m = STATUS_META[kot.status] || STATUS_META.pending;
                return (
                  <div key={kot.id} className="kot-card" style={{ borderTop: `3px solid ${m.color}` }}>
                    <div className="kotc-header">
                      <div className="kotc-num">{kot.kot_number}</div>
                      <StatusBadge status={kot.status} small />
                    </div>
                    <div className="kotc-meta">
                      <span>🪑 {kot.table_number || (kot.order_type === 'parcel' ? '📦 Parcel' : 'Takeaway')}</span>
                      <span style={{ color: 'var(--ink2)', fontSize: 11 }}>{timeSince(kot.created_at)}</span>
                    </div>
                    <div className="kotc-order">{kot.order_number}</div>
                    {/* Items preview with per-item notes */}
                    {kot.items && kot.items.length > 0 && (
                      <div className="kotc-items">
                        {kot.items.map((item, i) => (
                          <div key={i} className="kotc-item-row">
                            <span className="kotci-name">{item.item_name}</span>
                            <span className="kotci-qty">×{item.quantity}</span>
                            {(item.kot_instructions || item.notes) && (
                              <div className="kotci-note">🍳 {item.kot_instructions || item.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {kot.instructions && (
                      <div className="kotc-inst">⚠️ {kot.instructions}</div>
                    )}
                    {/* Status action buttons + delete */}
                    <div className="kotc-status-row" style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                      <button className="bsm" onClick={() => setDelKOT(kot)}
                        style={{ marginLeft:'auto', background:'rgba(232,74,95,.1)', color:'#e84a5f', border:'1.5px solid #e84a5f', fontSize:11 }}
                        title="Delete KOT">🗑️ Delete</button>
                      {Object.entries(STATUS_META).map(([s, sm]) => (
                        <button key={s}
                          className={'kotc-sbtn' + (kot.status === s ? ' active' : '')}
                          style={kot.status === s ? { background: sm.bg, color: sm.color, borderColor: sm.color } : {}}
                          onClick={() => changeStatus(kot.id, s)}>
                          {sm.icon}
                        </button>
                      ))}
                    </div>
                    <div className="kotc-actions">
                      <button className="bsm bo" onClick={() => openView(kot)}>👁️ View</button>
                      <button className="bsm be" onClick={() => openView(kot).then(() => setTimeout(printKOT, 400))}>🖨️ Reprint</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* KOT Detail + Reprint Modal */}
      <Modal show={!!viewKOT} onClose={() => setViewKOT(null)}
        title={viewKOT?.kot_number || 'KOT Details'}
        subtitle={viewKOT ? `${viewKOT.table_number || viewKOT.order_type} · ${viewKOT.order_number}` : ''}
        wide>
        {viewLoading ? <div className="loading-wrap">Loading…</div> : viewKOT && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {/* Print preview */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 12, background: '#fff', display: 'inline-block' }}>
                <KOTPrint ref={printRef} kot={viewKOT} />
              </div>
            </div>
            {/* Info + actions */}
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600, marginBottom: 8 }}>STATUS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(STATUS_META).map(([s, sm]) => (
                    <button key={s}
                      style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                        background: viewKOT.status === s ? sm.bg : 'transparent',
                        color: viewKOT.status === s ? sm.color : 'var(--ink2)',
                        borderColor: viewKOT.status === s ? sm.color : 'var(--border)' }}
                      onClick={() => changeStatus(viewKOT.id, s)}>
                      {sm.icon} {sm.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, fontSize: 13 }}>
                <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--ink2)' }}>Table: </span><strong>{viewKOT.table_number || '—'}</strong></div>
                <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--ink2)' }}>Order: </span><strong>{viewKOT.order_number}</strong></div>
                <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--ink2)' }}>Type: </span><strong>{viewKOT.order_type}</strong></div>
                <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--ink2)' }}>By: </span><strong>{viewKOT.created_by_name}</strong></div>
                <div><span style={{ color: 'var(--ink2)' }}>Time: </span><strong>{new Date(viewKOT.created_at).toLocaleString('en-IN')}</strong></div>
              </div>
              {/* Items with per-item notes */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.6px', color: 'var(--ink2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>Items</div>
                {(viewKOT.items || []).map((item, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderBottom: i < viewKOT.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{item.item_name}</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent)', minWidth: 32, textAlign: 'right' }}>×{item.quantity}</span>
                    </div>
                    {(item.kot_instructions || item.notes) && (
                      <div style={{ marginTop: 3, fontSize: 11, color: '#e06c00', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🍳 {item.kot_instructions || item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {viewKOT.instructions && (
                <div style={{ padding: '10px 14px', background: 'rgba(232,112,41,.08)', borderRadius: 10, fontSize: 13, color: '#b07a00', fontWeight: 600 }}>
                  ⚠️ {viewKOT.instructions}
                </div>
              )}
              <button className="btn-p" style={{ padding: '12px 20px' }} onClick={printKOT}>🖨️ Print / Reprint KOT</button>
            </div>
          </div>
        )}
        <div className="mft"><button className="btn-c" onClick={() => setViewKOT(null)}>Close</button></div>
      </Modal>

      <ConfirmModal
        show={!!delKOT}
        onClose={() => setDelKOT(null)}
        onConfirm={doDeleteKOT}
        title={`Delete ${delKOT?.kot_number}?`}
        message="This will remove the KOT and allow its items to be re-sent. This cannot be undone."
      />
    </div>
  );
}
