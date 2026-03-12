import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDashboard } from '../../api';
import { useWS, useWSEvent } from '../../context/WSContext';
import { fmtCur } from '../../utils';

// ─── Helpers ──────────────────────────────────────────────────────
const short = n => {
  n = parseFloat(n || 0);
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};
const pct  = (a, b) => b > 0 ? ((parseFloat(a)/parseFloat(b))*100).toFixed(1) : '0.0';
const COLS = ['#e84a5f','#118ab2','#1db97e','#b07a00','#8b5cf6','#f59e0b'];
const PAY_ICONS = { cash:'💵', card:'💳', upi:'📱', other:'💰' };
const dayName = d => { try { return new Date(d).toLocaleDateString('en-IN',{weekday:'short'}); } catch { return d; }};
const hrLabel = h => { const n=parseInt(h); return `${n%12||12}${n<12?'am':'pm'}`; };

// ─── Sub-components ───────────────────────────────────────────────

function KPICard({ icon, label, value, sub, subRed, trend, accent }) {
  const tc = trend > 0 ? '#1db97e' : trend < 0 ? '#e84a5f' : '#999';
  return (
    <div style={{
      background: accent ? 'var(--accent)' : 'var(--surface)',
      border: `1.5px solid ${accent ? 'transparent' : 'var(--border)'}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: accent ? '0 4px 18px rgba(232,74,95,.22)' : '0 1px 3px rgba(0,0,0,.04)',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <span style={{ fontSize:26 }}>{icon}</span>
        {trend !== null && trend !== undefined && (
          <span style={{ fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:20, background:`${tc}18`, color:tc }}>
            {trend>0?'▲':'▼'} {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <div style={{ fontSize:26, fontWeight:900, color: accent?'#fff':'var(--ink)', letterSpacing:-1 }}>{value}</div>
      <div style={{ fontSize:12, color: accent?'rgba(255,255,255,.8)':'var(--ink2)', marginTop:5, fontWeight:600 }}>{label}</div>
      {sub && <div style={{ fontSize:11, marginTop:3, color: subRed?'#e84a5f': accent?'rgba(255,255,255,.6)':'var(--ink2)' }}>{sub}</div>}
    </div>
  );
}

function LiveChip({ icon, count, label, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:14, flex:1, minWidth:130 }}>
      <div style={{ width:40, height:40, borderRadius:12, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:26, fontWeight:900, color, lineHeight:1 }}>{count}</div>
        <div style={{ fontSize:11, color:'var(--ink2)', fontWeight:600, marginTop:2 }}>{label}</div>
      </div>
      <div style={{ marginLeft:'auto', width:8, height:8, borderRadius:'50%', background:color, animation:'dbPulse 2s infinite' }}/>
    </div>
  );
}

// Pure CSS bar chart
function BarChart({ data, xKey, yKey, color='#118ab2', height=170 }) {
  if (!data?.length) return <div style={{ padding:40, textAlign:'center', color:'var(--ink2)', fontSize:13 }}>No data yet</div>;
  const max = Math.max(...data.map(d=>parseFloat(d[yKey]||0)), 1);
  return (
    <div style={{ padding:'12px 16px 0', overflowX:'auto' }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:3, height, paddingBottom:22, minWidth: data.length*30 }}>
        {data.map((d, i) => {
          const val = parseFloat(d[yKey]||0);
          const barH = Math.max((val/max)*(height-26), val>0?3:0);
          return (
            <div key={i} title={`${d[xKey]}: ${short(val)}`} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%', gap:0 }}>
              <div style={{ fontSize:9, color:'var(--ink2)', marginBottom:2, whiteSpace:'nowrap' }}>{val>0?short(val):''}</div>
              <div style={{ width:'100%', height:barH, background:color, borderRadius:'4px 4px 0 0', minWidth:8, opacity:.88, transition:'height .3s' }}/>
              <div style={{ fontSize:9, color:'var(--ink2)', marginTop:4, whiteSpace:'nowrap', overflow:'hidden', maxWidth:'100%', textAlign:'center' }}>{d[xKey]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Pure SVG area chart
function AreaChart({ data, xKey, yKey, color='#e84a5f', height=190 }) {
  const [tip, setTip] = useState(null);
  if (!data?.length) return <div style={{ padding:40, textAlign:'center', color:'var(--ink2)', fontSize:13 }}>No data yet</div>;
  const W=560, H=height-36;
  const vals = data.map(d=>parseFloat(d[yKey]||0));
  const max = Math.max(...vals, 1);
  const pts = vals.map((v,i) => ({ x:(i/(Math.max(vals.length-1,1)))*W, y:H-((v/max)*H*.88) }));
  const linePath = pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${pts[pts.length-1].x},${H} L0,${H} Z`;
  return (
    <div style={{ padding:'8px 4px 0', overflow:'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H+36}`} style={{ width:'100%', height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".22"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#ag)"/>
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i) => (
          <circle key={i} cx={p.x} cy={p.y} r={tip===i?6:4} fill={color} stroke="#fff" strokeWidth="2"
            style={{ cursor:'pointer' }} onMouseEnter={()=>setTip(i)} onMouseLeave={()=>setTip(null)}/>
        ))}
        {tip!==null && (
          <g>
            <rect x={Math.min(Math.max(pts[tip].x-45,0),W-100)} y={pts[tip].y-38} width={90} height={26} rx={6} fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
            <text x={Math.min(Math.max(pts[tip].x-45,0),W-100)+45} y={pts[tip].y-20} textAnchor="middle" fontSize="12" fill="var(--ink)" fontWeight="800" style={{fontFamily:'sans-serif'}}>{short(vals[tip])}</text>
          </g>
        )}
        {data.map((d,i) => (
          <text key={i} x={pts[i].x} y={H+22} textAnchor="middle" fontSize="10" fill="var(--ink2)" style={{fontFamily:'sans-serif'}}>{dayName(d[xKey])}</text>
        ))}
      </svg>
    </div>
  );
}

// Pure SVG donut chart
function Donut({ data, valKey, nameKey, size=130 }) {
  if (!data?.length) return <div style={{ padding:20, textAlign:'center', color:'var(--ink2)', fontSize:13 }}>No data</div>;
  const total = data.reduce((s,d)=>s+parseFloat(d[valKey]||0),0);
  const r=48, cx=65, cy=65, sw=22;
  let angle = -Math.PI/2;
  const slices = data.map((d,i) => {
    const val = parseFloat(d[valKey]||0);
    const a = total>0?(val/total)*2*Math.PI:0;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    angle += a;
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle);
    return { path:`M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${a>Math.PI?1:0},1 ${x2.toFixed(2)},${y2.toFixed(2)}`, color:COLS[i%COLS.length], val, name:d[nameKey] };
  });
  return (
    <svg viewBox="0 0 130 130" style={{ width:size, height:size }}>
      {slices.map((s,i) => <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth={sw} strokeLinecap="butt"/>)}
      <text x={cx} y={cy-5} textAnchor="middle" fontSize="9" fill="var(--ink2)" style={{fontFamily:'sans-serif'}}>TOTAL</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize="13" fill="var(--ink)" fontWeight="900" style={{fontFamily:'sans-serif'}}>{short(total)}</text>
    </svg>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const timerRef = useRef(null);
  const { connected } = useWS() || {};

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await getDashboard();
      if (res.success) { setData(res.data); setUpdatedAt(new Date()); }
      else setError(res.message || 'Server returned an error');
    } catch(e) {
      setError(e?.response?.data?.message || e.message || 'Cannot reach server');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 30000); // refresh every 30s
    return () => clearInterval(timerRef.current);
  }, [load]);

  useWSEvent('stats_update',  () => load(true));
  useWSEvent('order_paid',    () => load(true));
  useWSEvent('order_created', () => load(true));
  useWSEvent('order_cancelled',()=> load(true));
  useWSEvent('kot_new',       () => load(true));

  // ── Loading ──────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:500, gap:16 }}>
      <div style={{ fontSize:52, animation:'dbSpin 1s linear infinite' }}>🍽️</div>
      <div style={{ fontSize:14, color:'var(--ink2)' }}>Loading dashboard…</div>
      <style>{`@keyframes dbSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────
  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:500, gap:14 }}>
      <div style={{ fontSize:48 }}>⚠️</div>
      <div style={{ fontSize:16, fontWeight:800, color:'#e84a5f' }}>Dashboard failed to load</div>
      <div style={{ fontSize:13, color:'var(--ink2)', maxWidth:380, textAlign:'center', lineHeight:1.6 }}>{error}</div>
      <div style={{ fontSize:12, color:'var(--ink2)', background:'var(--bg)', padding:'10px 16px', borderRadius:8, fontFamily:'monospace' }}>
        Check: server running · DB connected · migrations applied
      </div>
      <button className="btn-p" onClick={()=>load()}>🔄 Retry</button>
    </div>
  );

  if (!data) return null;

  const { today, yesterday, month, live, tables, payments, top_items, last7, hourly, top_categories, monthly_trend, low_stock } = data;

  const revT = yesterday.revenue > 0 ? ((today.revenue - yesterday.revenue) / yesterday.revenue * 100) : null;
  const ordT = yesterday.orders  > 0 ? ((today.orders  - yesterday.orders)  / yesterday.orders  * 100) : null;
  const totalPay = payments.reduce((s,p)=>s+parseFloat(p.total||0), 0);

  return (
    <div>
      <style>{`
        @keyframes dbPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
        @keyframes dbSpin  { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div className="ph" style={{ marginBottom:20 }}>
        <div className="ph-left">
          <div className="pt">📊 Dashboard</div>
          <div className="ps">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:700,
            background: connected?'rgba(29,185,126,.1)':'rgba(232,74,95,.08)',
            border:`1.5px solid ${connected?'#1db97e':'#e84a5f'}`,
            color: connected?'#1db97e':'#e84a5f' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:connected?'#1db97e':'#e84a5f', animation: connected?'dbPulse 2s infinite':'' }}/>
            {connected ? '● Live' : '○ Offline'}
          </div>
          {updatedAt && <div style={{ fontSize:11, color:'var(--ink2)' }}>Updated {updatedAt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>}
          <button className="btn-c" onClick={()=>load()} style={{ fontSize:12 }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Live Status */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
        <LiveChip icon="🟢" count={live.open_orders}                         label="Open Orders"     color="#1db97e"/>
        <LiveChip icon="🍳" count={live.pending_kot}                         label="KOT Pending"     color="#e84a5f"/>
        <LiveChip icon="🪑" count={parseInt(tables.occupied||0)}             label="Tables Occupied" color="#118ab2"/>
        <LiveChip icon="✅" count={parseInt(tables.total||0)-parseInt(tables.occupied||0)} label="Tables Free" color="#1db97e"/>
        {low_stock?.length>0 && <LiveChip icon="⚠️" count={low_stock.length} label="Low Stock"       color="#b07a00"/>}
      </div>

      {/* KPI Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(185px,1fr))', gap:14, marginBottom:26 }}>
        <KPICard icon="💰" label="Today's Revenue" value={short(today.revenue)}
          sub={`${today.orders} orders · avg ${short(today.orders>0?today.revenue/today.orders:0)}`}
          trend={revT} accent />
        <KPICard icon="🧾" label="Today's Orders"  value={today.orders}
          sub={`vs ${yesterday.orders} yesterday`} trend={ordT} />
        <KPICard icon="📊" label="This Month"       value={short(month.revenue)}  sub={`${month.orders} orders`} />
        <KPICard icon="🏷️" label="Discounts Today"  value={fmtCur(today.discounts)}
          sub={`${pct(today.discounts,today.revenue)}% of revenue`} subRed={parseFloat(today.discounts)>0} />
        <KPICard icon="💳" label="GST Collected"    value={fmtCur(today.gst)}      sub="Today" />
        <KPICard icon="📈" label="Yesterday Rev."   value={short(yesterday.revenue)} sub={`${yesterday.orders} orders`} />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:18, marginBottom:18 }}>
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:800, fontSize:14 }}>📈 Revenue — Last 7 Days</div>
            <div style={{ fontWeight:800, color:'var(--accent)', fontSize:13 }}>{short(last7.reduce((s,d)=>s+parseFloat(d.revenue||0),0))}</div>
          </div>
          <AreaChart data={last7} xKey="day" yKey="revenue" height={210}/>
        </div>

        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:14 }}>💳 Payment Mix</div>
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            {payments.length===0
              ? <div style={{ padding:30, color:'var(--ink2)', fontSize:13 }}>No payments today</div>
              : <>
                  <Donut data={payments} valKey="total" nameKey="payment_method" size={130}/>
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:7 }}>
                    {payments.map((p,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:COLS[i%COLS.length], flexShrink:0 }}/>
                        <span style={{ fontWeight:700, flex:1, textTransform:'capitalize' }}>{PAY_ICONS[p.payment_method]||'💰'} {p.payment_method}</span>
                        <span style={{ fontWeight:900 }}>{fmtCur(p.total)}</span>
                        <span style={{ color:'var(--ink2)', minWidth:34, textAlign:'right' }}>{pct(p.total,totalPay)}%</span>
                      </div>
                    ))}
                  </div>
                </>
            }
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:18 }}>
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:14 }}>⏰ Hourly Sales — Today</div>
          <BarChart data={hourly.map(h=>({...h, hour: hrLabel(h.hour)}))} xKey="hour" yKey="revenue" color="#118ab2" height={185}/>
        </div>
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:14 }}>📅 Monthly Trend</div>
          <BarChart data={monthly_trend} xKey="month" yKey="revenue" color="#1db97e" height={185}/>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:18 }}>

        {/* Top Items */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:14 }}>🏆 Top Items — Today</div>
          {top_items.length===0
            ? <div style={{ padding:30, textAlign:'center', color:'var(--ink2)', fontSize:13 }}>No sales today</div>
            : top_items.map((item, i) => {
                const maxQ = parseFloat(top_items[0]?.qty||1);
                return (
                  <div key={i} style={{ padding:'11px 18px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:22, height:22, borderRadius:'50%', background:i===0?'var(--accent)':i===1?'#118ab2':'#1db97e', color:'#fff', fontSize:10, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</span>
                        <span style={{ fontWeight:700, fontSize:13 }}>{item.item_name}</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:800, fontSize:13, color:'var(--accent)' }}>{fmtCur(item.revenue)}</div>
                        <div style={{ fontSize:10, color:'var(--ink2)' }}>×{item.qty}</div>
                      </div>
                    </div>
                    <div style={{ height:4, background:'var(--bg)', borderRadius:2 }}>
                      <div style={{ height:'100%', width:`${(parseFloat(item.qty)/maxQ)*100}%`, background:i===0?'var(--accent)':i===1?'#118ab2':'#1db97e', borderRadius:2 }}/>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Categories */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:14 }}>🗂️ Categories — Month</div>
          {top_categories.length===0
            ? <div style={{ padding:30, textAlign:'center', color:'var(--ink2)', fontSize:13 }}>No data this month</div>
            : <div style={{ padding:'16px 18px' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
                  <Donut data={top_categories} valKey="revenue" nameKey="category" size={120}/>
                </div>
                {top_categories.map((c,i) => {
                  const tot = top_categories.reduce((s,x)=>s+parseFloat(x.revenue||0),0);
                  return (
                    <div key={i} style={{ marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:9, height:9, borderRadius:2, background:COLS[i%COLS.length], display:'inline-block' }}/>
                          {c.icon} {c.category||'Other'}
                        </span>
                        <span style={{ fontWeight:800 }}>{fmtCur(c.revenue)}</span>
                      </div>
                      <div style={{ height:5, background:'var(--bg)', borderRadius:3 }}>
                        <div style={{ height:'100%', width:`${pct(c.revenue,tot)}%`, background:COLS[i%COLS.length], borderRadius:3 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Right col */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card" style={{ padding:'16px 18px' }}>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:14 }}>📋 Today Snapshot</div>
            {[
              { l:'Revenue',       v: fmtCur(today.revenue),    c:'#1db97e' },
              { l:'Orders',        v: today.orders,              c:'var(--ink)' },
              { l:'Avg per Order', v: fmtCur(today.orders>0?parseFloat(today.revenue)/parseFloat(today.orders):0), c:'#118ab2' },
              { l:'Discounts',     v: fmtCur(today.discounts),   c:'#e84a5f' },
              { l:'GST',           v: fmtCur(today.gst),         c:'var(--ink2)' },
              { l:'Month Total',   v: short(month.revenue),      c:'var(--accent)' },
              { l:'Month Orders',  v: month.orders,              c:'var(--ink2)' },
            ].map(({l,v,c}) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <span style={{ color:'var(--ink2)', fontWeight:600 }}>{l}</span>
                <span style={{ fontWeight:800, color:c }}>{v}</span>
              </div>
            ))}
          </div>

          {low_stock?.length>0 && (
            <div className="card" style={{ padding:0, borderTop:'3px solid #b07a00' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:13, color:'#b07a00' }}>⚠️ Low Stock</div>
              {low_stock.map((item,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{item.name}</div>
                    <div style={{ fontSize:11, color:'var(--ink2)' }}>Min: {item.min_quantity}</div>
                  </div>
                  <span style={{ padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:800, background:'rgba(176,122,0,.1)', color:'#b07a00' }}>{item.quantity} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
