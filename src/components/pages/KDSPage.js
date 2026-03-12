/**
 * KDS — Kitchen Display System
 * 3-column kanban (Pending → Preparing → Ready) + common items summary panel.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getKOTs, updateKOTStatus } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useWS, useWSEvent } from '../../context/WSContext';

function Elapsed({ createdAt }) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setMins(Math.floor((Date.now() - start) / 60000));
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [createdAt]);
  const urgent = mins >= 15, warn = mins >= 8;
  const color = urgent ? '#e84a5f' : warn ? '#f59e0b' : '#94a3b8';
  return (
    <span style={{ fontSize:12, fontWeight:800, padding:'2px 8px', borderRadius:20,
      background:`${color}20`, color, animation: urgent ? 'kds-pulse 1s infinite' : 'none' }}>
      ⏱ {mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60}m`}
    </span>
  );
}

const COLS = [
  { status:'pending',   label:'Pending',   icon:'🕐', color:'#f59e0b', bg:'rgba(245,158,11,.06)', nextLabel:'▶ Start Cooking', nextStatus:'preparing' },
  { status:'preparing', label:'Preparing', icon:'🔥', color:'#38bdf8', bg:'rgba(56,189,248,.06)', nextLabel:'✓ Mark Ready',    nextStatus:'ready'     },
  { status:'ready',     label:'Ready!',    icon:'✅', color:'#4ade80', bg:'rgba(74,222,128,.06)', nextLabel:'✓ Served',         nextStatus:'served'    },
];

function KOTCard({ kot, col, onMove, updating }) {
  const items = kot.items || [];
  const busy = updating[kot.id];
  return (
    <div style={{
      background:'var(--surface)', borderRadius:14, overflow:'hidden',
      border:`1.5px solid ${col.color}44`, boxShadow:`0 3px 14px ${col.color}14`,
      opacity: busy ? .7 : 1, transition:'opacity .2s',
      animation:'kds-in .2s ease',
      cursor: busy ? 'not-allowed' : 'default',
    }}>
      <div style={{ height:4, background:`linear-gradient(90deg,${col.color},${col.color}88)` }}/>
      {/* Header */}
      <div style={{ padding:'10px 12px', background:`${col.color}0e`, borderBottom:`1px solid ${col.color}22`,
        display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontWeight:900, fontSize:18, letterSpacing:-.5 }}>{kot.kot_number}</div>
          <div style={{ fontSize:11, color:'var(--ink2)', marginTop:2 }}>
            {kot.order_type === 'dine_in'
              ? <strong>🪑 Table {kot.table_number||'?'}</strong>
              : kot.order_type === 'parcel'
              ? <strong style={{color:'#8b5cf6'}}>📦 Parcel</strong>
              : <strong style={{color:'#06b6d4'}}>🥡 Takeaway</strong>}
            <span style={{color:'var(--ink2)',fontWeight:400}}> · {kot.order_number}</span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <Elapsed createdAt={kot.created_at} />
          <div style={{fontSize:10,color:'var(--ink2)'}}>{new Date(kot.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      </div>

      {/* Items */}
      <div style={{ padding:'2px 0' }}>
        {items.length === 0 ? (
          <div style={{padding:'10px 12px',fontSize:12,color:'var(--ink2)'}}>No items</div>
        ) : items.map((item, i) => (
          <div key={i} style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'9px 12px',
            borderBottom: i < items.length-1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{item.item_name}</div>
              {item.kot_instructions && (
                <div style={{ fontSize:11, color:'#b07a00', marginTop:1, fontStyle:'italic' }}>⚠️ {item.kot_instructions}</div>
              )}
            </div>
            <div style={{ width:32, height:32, borderRadius:8, background:`${col.color}22`,
              color:col.color, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:16, fontWeight:900, flexShrink:0 }}>
              {item.quantity}
            </div>
          </div>
        ))}
      </div>

      {kot.instructions && (
        <div style={{ margin:'0 10px 8px', padding:'6px 10px', background:'rgba(245,158,11,.12)', borderRadius:8,
          fontSize:11, color:'#92400e', border:'1px solid rgba(245,158,11,.3)' }}>
          ⚠️ {kot.instructions}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding:'8px 10px 10px', display:'flex', gap:7 }}>
        <button disabled={busy} onClick={() => onMove(kot, col.nextStatus)}
          style={{ flex:1, padding:'11px 0', borderRadius:10, fontSize:12, fontWeight:800,
            border:'none', cursor:busy?'not-allowed':'pointer', background:col.color, color:'#fff',
            boxShadow:`0 2px 10px ${col.color}44`, transition:'all .15s',
            fontFamily:'inherit', opacity: busy ? .6 : 1 }}>
          {busy ? '⏳' : col.nextLabel}
        </button>
        <button disabled={busy} onClick={() => onMove(kot, 'cancelled')}
          style={{ padding:'11px 12px', borderRadius:10, fontSize:12, fontWeight:700,
            border:'1.5px solid rgba(232,74,95,.3)', cursor:busy?'not-allowed':'pointer',
            background:'rgba(232,74,95,.07)', color:'#e84a5f', transition:'all .15s',
            fontFamily:'inherit' }}>
          ✕
        </button>
      </div>
    </div>
  );
}

export default function KDSPage() {
  const toast = useToast();
  const { connected } = useWS();
  const [kots, setKots]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState({});
  const [showServed, setShowServed] = useState(false);

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const r = await getKOTs();
      if (r.success) setKots(r.data || []);
    } catch { if (!silent) toast('Load failed','er'); }
    if (!silent) setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => load(true), 20000); return () => clearInterval(t); }, [load]);

  useWSEvent('kot_new',       () => load(true));
  useWSEvent('kot_status',    (p) => {
    if (p?.id && p?.status)
      setKots(prev => prev.map(k => k.id === p.id ? { ...k, status: p.status } : k));
  });
  useWSEvent('order_created', () => load(true));

  const changeStatus = async (kot, newStatus) => {
    setUpdating(u => ({ ...u, [kot.id]: true }));
    setKots(prev => prev.map(k => k.id === kot.id ? { ...k, status: newStatus } : k));
    try {
      const r = await updateKOTStatus(kot.id, newStatus);
      if (!r.success) {
        setKots(prev => prev.map(k => k.id === kot.id ? { ...k, status: kot.status } : k));
        toast(r.message || 'Update failed', 'er');
      }
    } catch {
      setKots(prev => prev.map(k => k.id === kot.id ? { ...k, status: kot.status } : k));
    }
    setUpdating(u => ({ ...u, [kot.id]: false }));
  };

  const counts = useMemo(() =>
    kots.reduce((acc, k) => { acc[k.status] = (acc[k.status]||0)+1; return acc; }, {}),
  [kots]);

  // Common items summary — aggregate all ACTIVE kots' items
  const commonItems = useMemo(() => {
    const active = kots.filter(k => ['pending','preparing','ready'].includes(k.status));
    const map = {};
    active.forEach(k => {
      (k.items||[]).forEach(item => {
        const key = item.item_name;
        if (!map[key]) map[key] = { name:key, qty:0, pending:0, preparing:0, ready:0 };
        map[key].qty += item.quantity;
        map[key][k.status] += item.quantity;
      });
    });
    return Object.values(map).sort((a,b) => b.qty - a.qty);
  }, [kots]);

  const servedKots = kots.filter(k => k.status === 'served' || k.status === 'cancelled');

  return (
    <div>
      <style>{`
        @keyframes kds-pulse { 0%,100%{opacity:1}50%{opacity:.35} }
        @keyframes kds-in { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        .kds-col-cards { display:flex; flex-direction:column; gap:12px; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:'1.6rem', fontWeight:900, letterSpacing:-.6 }}>📺 Kitchen Display</div>
          <div style={{ fontSize:13, color:'var(--ink2)' }}>
            Live orders — <strong style={{color:'var(--accent)'}}>{(counts.pending||0)+(counts.preparing||0)+(counts.ready||0)}</strong> active
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:800,
            background:connected?'rgba(29,185,126,.1)':'rgba(232,74,95,.08)',
            border:`1.5px solid ${connected?'#1db97e':'#e84a5f'}`, color:connected?'#1db97e':'#e84a5f' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:connected?'#1db97e':'#e84a5f',
              animation:connected?'kds-pulse 2s infinite':'' }}/>
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
          <button className="btn-ghost" onClick={() => load(false)}>🔄</button>
        </div>
      </div>

      {/* Main layout: 3 kanban columns + right panel */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 200px', gap:14, alignItems:'start' }}>

        {/* ── 3 KANBAN COLUMNS ── */}
        {COLS.map(col => {
          const colKots = kots
            .filter(k => k.status === col.status)
            .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
          return (
            <div key={col.status}>
              {/* Column header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12,
                padding:'10px 14px', borderRadius:12, background:`${col.color}12`, border:`2px solid ${col.color}33` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20 }}>{col.icon}</span>
                  <span style={{ fontWeight:900, fontSize:15, color:col.color }}>{col.label}</span>
                </div>
                <div style={{ width:28, height:28, borderRadius:8, background:`${col.color}`, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900 }}>
                  {colKots.length}
                </div>
              </div>

              {loading ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--ink2)', fontSize:13 }}>⏳ Loading…</div>
              ) : colKots.length === 0 ? (
                <div style={{ padding:'32px 16px', textAlign:'center', border:`2px dashed ${col.color}33`, borderRadius:12 }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{col.icon}</div>
                  <div style={{ fontSize:13, color:'var(--ink2)', fontWeight:600 }}>No {col.label.toLowerCase()} orders</div>
                </div>
              ) : (
                <div className="kds-col-cards">
                  {colKots.map(kot => (
                    <KOTCard key={kot.id} kot={kot} col={col} onMove={changeStatus} updating={updating} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* ── RIGHT: COMMON ITEMS PANEL ── */}
        <div style={{ position:'sticky', top:80 }}>
          <div style={{ background:'var(--surface)', borderRadius:14, overflow:'hidden', border:'1.5px solid var(--border)' }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', background:'rgba(26,26,46,.03)' }}>
              <div style={{ fontWeight:900, fontSize:14 }}>🍽️ Active Items</div>
              <div style={{ fontSize:11, color:'var(--ink2)', marginTop:2 }}>Across all active KOTs</div>
            </div>

            {commonItems.length === 0 ? (
              <div style={{ padding:'24px 14px', textAlign:'center', color:'var(--ink2)', fontSize:12 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🍳</div>
                Kitchen is clear!
              </div>
            ) : (
              <div style={{ maxHeight:'calc(100vh - 280px)', overflowY:'auto' }}>
                {commonItems.map((item, i) => (
                  <div key={i} style={{
                    padding:'9px 14px', borderBottom:'1px solid var(--border)',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap' }}>
                        {item.pending   > 0 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8, background:'rgba(245,158,11,.15)', color:'#f59e0b' }}>🕐{item.pending}</span>}
                        {item.preparing > 0 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8, background:'rgba(56,189,248,.15)', color:'#38bdf8' }}>🔥{item.preparing}</span>}
                        {item.ready     > 0 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8, background:'rgba(74,222,128,.15)', color:'#4ade80' }}>✅{item.ready}</span>}
                      </div>
                    </div>
                    <div style={{ width:34, height:34, borderRadius:10, background:'var(--accent)', color:'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, flexShrink:0, marginLeft:8 }}>
                      {item.qty}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Served/Cancelled toggle */}
            <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)' }}>
              <button onClick={() => setShowServed(v=>!v)} style={{
                width:'100%', padding:'8px', borderRadius:8, border:'1.5px solid var(--border)',
                background:'transparent', cursor:'pointer', fontSize:12, fontWeight:700, color:'var(--ink2)',
                fontFamily:'inherit',
              }}>
                {showServed ? '▲ Hide' : '▼ Served'} ({counts.served||0})
              </button>
            </div>
          </div>

          {/* KPI mini */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:12 }}>
            {COLS.map(col => (
              <div key={col.status} style={{ padding:'8px 12px', borderRadius:10, background:`${col.color}12`,
                border:`1.5px solid ${col.color}33`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:700, color:col.color }}>{col.icon} {col.label}</span>
                <span style={{ fontSize:18, fontWeight:900, color:col.color }}>{counts[col.status]||0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Served/Cancelled section */}
      {showServed && servedKots.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontWeight:800, fontSize:14, color:'var(--ink2)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <span>✅ Completed Orders</span>
            <span style={{ fontSize:12, padding:'2px 10px', borderRadius:20, background:'rgba(148,163,184,.1)', color:'#94a3b8' }}>{servedKots.length}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
            {servedKots.slice(0,12).map(kot => (
              <div key={kot.id} style={{ padding:'12px 14px', borderRadius:12, background:'var(--surface)',
                border:'1.5px solid var(--border)', opacity:.7 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontWeight:800 }}>{kot.kot_number}</div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                    background: kot.status === 'served' ? 'rgba(148,163,184,.15)' : 'rgba(232,74,95,.1)',
                    color: kot.status === 'served' ? '#94a3b8' : '#e84a5f' }}>
                    {kot.status === 'served' ? '✅ Served' : '❌ Cancelled'}
                  </span>
                </div>
                <div style={{ fontSize:11, color:'var(--ink2)' }}>
                  {(kot.items||[]).map(i=>`${i.item_name}×${i.quantity}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
