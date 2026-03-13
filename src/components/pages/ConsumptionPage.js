import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getDailyCategoryConsumption } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}
function parseCatIcon(imageUrl) {
  if (!imageUrl) return { icon: '📦', color: '#b07a00' };
  const m1 = imageUrl.match(/icon:([^|]+)/);
  const m2 = imageUrl.match(/color:([^|]+)/);
  return { icon: m1 ? m1[1] : '📦', color: m2 ? m2[1] : '#b07a00' };
}

export default function ConsumptionPage() {
  const toast = useToast();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo]     = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null); // { consumed, purchased, categories }
  const [view, setView]       = useState('daily'); // 'daily' | 'monthly'
  const [expandedCat, setExpandedCat] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getDailyCategoryConsumption({ from, to });
      if (r.success) setData(r.data);
      else toast(r.message || 'Failed to load', 'er');
    } catch(err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load';
      toast(msg, 'er');
    }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // Build date list between from and to
  const dates = useMemo(() => {
    const list = [];
    let cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
      list.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return list.reverse(); // newest first
  }, [from, to]);

  const categories = data?.categories || [];

  // Build lookup: day+catId → consumed/purchased
  const consumedMap = useMemo(() => {
    const m = {};
    (data?.consumed || []).forEach(r => { m[`${r.day}_${r.category_id}`] = r; });
    return m;
  }, [data]);
  const purchasedMap = useMemo(() => {
    const m = {};
    (data?.purchased || []).forEach(r => { m[`${r.day}_${r.category_id}`] = r; });
    return m;
  }, [data]);

  // Monthly totals per category
  const monthlyTotals = useMemo(() => {
    const m = {};
    categories.forEach(cat => {
      let totalConsumed = 0, totalPurchased = 0;
      dates.forEach(day => {
        totalConsumed  += parseFloat(consumedMap[`${day}_${cat.id}`]?.consumed_value  || 0);
        totalPurchased += parseFloat(purchasedMap[`${day}_${cat.id}`]?.purchased_value || 0);
      });
      m[cat.id] = { totalConsumed, totalPurchased, diff: totalPurchased - totalConsumed };
    });
    return m;
  }, [categories, dates, consumedMap, purchasedMap]);

  const grandConsumed  = Object.values(monthlyTotals).reduce((s, v) => s + v.totalConsumed, 0);
  const grandPurchased = Object.values(monthlyTotals).reduce((s, v) => s + v.totalPurchased, 0);
  const grandDiff      = grandPurchased - grandConsumed;

  const diffColor = (v) => v >= 0 ? '#1db97e' : '#e84a5f';

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">📊 Daily Consumption vs Purchase</div>
          <div className="ps">Category-wise consumed (from sales) vs purchased — track inventory flow and errors</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)' }}>FROM</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--ink)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)' }}>TO</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--ink)' }} />
          </div>
          <button onClick={load} className="btn-p" style={{ padding: '7px 16px', fontSize: 13 }}>
            {loading ? '⏳ Loading…' : '🔍 Load'}
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', flexWrap: 'wrap' }}>
        {[['daily','📅 Daily View'],['monthly','📊 Monthly Summary']].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: '7px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: view === v ? 'var(--accent)' : 'transparent',
              color: view === v ? '#fff' : 'var(--ink2)',
              borderColor: view === v ? 'var(--accent)' : 'var(--border)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, padding:'0 20px 20px' }}>
        {[
          { icon:'🛒', label:'Total Purchased',  value:fmtCur(grandPurchased), color:'var(--ink)',          border:'var(--accent)' },
          { icon:'📉', label:'Total Consumed',   value:fmtCur(grandConsumed),  color:'#e84a5f',             border:'#e84a5f' },
          { icon:'⚖️', label:'Difference',       value:(grandDiff>=0?'+':'')+fmtCur(grandDiff), color:diffColor(grandDiff), border:diffColor(grandDiff) },
          { icon:'🏷️', label:'Categories',       value:categories.length,      color:'var(--ink)',          border:'var(--border)' },
        ].map(c => (
          <div key={c.label} style={{ background:'var(--surface)', borderRadius:12, padding:'14px 16px', borderTop:`3px solid ${c.border}`, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:22, flexShrink:0 }}>{c.icon}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:18, fontWeight:800, color:c.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.value}</div>
              <div style={{ fontSize:12, color:'var(--ink2)', marginTop:2 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="loading-wrap">Loading…</div>}

      {!loading && data && (
        <>
          {/* ── DAILY VIEW ── */}
          {view === 'daily' && (
            <div style={{ padding: '0 20px' }}>
              {dates.map(day => {
                // Check if any activity on this day
                const hasActivity = categories.some(cat =>
                  consumedMap[`${day}_${cat.id}`] || purchasedMap[`${day}_${cat.id}`]
                );
                if (!hasActivity) return null;

                const dayConsumed  = categories.reduce((s, c) => s + parseFloat(consumedMap[`${day}_${c.id}`]?.consumed_value || 0), 0);
                const dayPurchased = categories.reduce((s, c) => s + parseFloat(purchasedMap[`${day}_${c.id}`]?.purchased_value || 0), 0);
                const dayDiff = dayPurchased - dayConsumed;

                return (
                  <div key={day} className="card" style={{ marginBottom: 16 }}>
                    <div className="ch" style={{ cursor: 'pointer' }} onClick={() => setExpandedCat(expandedCat === day ? null : day)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="ct">📅 {day}</div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                          <span style={{ color: '#1db97e' }}>🛒 {fmtCur(dayPurchased)}</span>
                          <span style={{ color: '#e84a5f' }}>📉 {fmtCur(dayConsumed)}</span>
                          <span style={{ color: diffColor(dayDiff), fontWeight: 700 }}>⚖️ {dayDiff >= 0 ? '+' : ''}{fmtCur(dayDiff)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{expandedCat === day ? '▲' : '▼'} Details</span>
                    </div>

                    {/* Category breakdown table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--ink2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Category</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: '#1db97e', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>🛒 Purchased</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: '#e84a5f', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>📉 Consumed</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>⚖️ Difference</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Error %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map(cat => {
                            const c = consumedMap[`${day}_${cat.id}`];
                            const p = purchasedMap[`${day}_${cat.id}`];
                            if (!c && !p) return null;
                            const consumed  = parseFloat(c?.consumed_value  || 0);
                            const purchased = parseFloat(p?.purchased_value || 0);
                            const diff = purchased - consumed;
                            const errPct = purchased > 0 ? ((Math.abs(diff) / purchased) * 100).toFixed(1) : '—';
                            const { icon, color } = parseCatIcon(cat.image_url);
                            return (
                              <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                  <span style={{ marginRight: 6 }}>{icon}</span>
                                  <span style={{ color }}>{cat.name}</span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1db97e', fontWeight: 600 }}>
                                  {purchased > 0 ? fmtCur(purchased) : <span style={{ color: 'var(--ink2)' }}>—</span>}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#e84a5f', fontWeight: 600 }}>
                                  {consumed > 0 ? fmtCur(consumed) : <span style={{ color: 'var(--ink2)' }}>—</span>}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: diffColor(diff) }}>
                                  {diff >= 0 ? '+' : ''}{fmtCur(diff)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: parseFloat(errPct) > 20 ? '#e84a5f' : 'var(--ink2)' }}>
                                  {errPct !== '—' ? `${errPct}%` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg)', fontWeight: 800 }}>
                            <td style={{ padding: '8px 12px' }}>Total</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1db97e' }}>{fmtCur(dayPurchased)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#e84a5f' }}>{fmtCur(dayConsumed)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: diffColor(dayDiff) }}>{dayDiff >= 0 ? '+' : ''}{fmtCur(dayDiff)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: dayPurchased > 0 ? diffColor(dayDiff) : 'var(--ink2)' }}>
                              {dayPurchased > 0 ? `${((Math.abs(dayDiff)/dayPurchased)*100).toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
              {dates.every(day => !categories.some(cat => consumedMap[`${day}_${cat.id}`] || purchasedMap[`${day}_${cat.id}`])) && (
                <div className="empty" style={{ padding: 40 }}><div className="ei">📊</div><h4>No data for selected range</h4><p>No purchases or sales recorded</p></div>
              )}
            </div>
          )}

          {/* ── MONTHLY SUMMARY ── */}
          {view === 'monthly' && (
            <div style={{ padding: '0 20px' }}>
              <div className="card">
                <div className="ch"><div className="ct">📊 Period Summary: {from} to {to}</div></div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--ink2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Category</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: '#1db97e', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>🛒 Total Purchased</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: '#e84a5f', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>📉 Total Consumed</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--ink2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>⚖️ Difference</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--ink2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Error %</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--ink2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(cat => {
                        const t = monthlyTotals[cat.id];
                        const { icon, color } = parseCatIcon(cat.image_url);
                        const errPct = t.totalPurchased > 0 ? ((Math.abs(t.diff)/t.totalPurchased)*100).toFixed(1) : null;
                        const statusOk = !errPct || parseFloat(errPct) <= 10;
                        const statusWarn = errPct && parseFloat(errPct) > 10 && parseFloat(errPct) <= 25;
                        const statusBad = errPct && parseFloat(errPct) > 25;
                        return (
                          <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>
                              <span style={{ marginRight: 6 }}>{icon}</span>
                              <span style={{ color }}>{cat.name}</span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#1db97e', fontWeight: 600 }}>{fmtCur(t.totalPurchased)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#e84a5f', fontWeight: 600 }}>{fmtCur(t.totalConsumed)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: diffColor(t.diff) }}>
                              {t.diff >= 0 ? '+' : ''}{fmtCur(t.diff)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: statusBad ? '#e84a5f' : statusWarn ? '#e87029' : '#1db97e' }}>
                              {errPct ? `${errPct}%` : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {!errPct ? <span style={{ color: 'var(--ink2)', fontSize: 12 }}>—</span>
                                : statusOk ? <span style={{ background: 'rgba(29,185,126,.12)', color: '#1db97e', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✅ Good</span>
                                : statusWarn ? <span style={{ background: 'rgba(232,112,41,.12)', color: '#e87029', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⚠️ Watch</span>
                                : <span style={{ background: 'rgba(232,74,95,.12)', color: '#e84a5f', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>❌ High Error</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2.5px solid var(--border)', background: 'rgba(var(--accent-rgb),.06)', fontWeight: 800, fontSize: 14 }}>
                        <td style={{ padding: '12px 14px' }}>📊 TOTAL</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1db97e' }}>{fmtCur(grandPurchased)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#e84a5f' }}>{fmtCur(grandConsumed)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: diffColor(grandDiff) }}>{grandDiff >= 0 ? '+' : ''}{fmtCur(grandDiff)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: grandPurchased > 0 ? diffColor(grandDiff) : 'var(--ink2)' }}>
                          {grandPurchased > 0 ? `${((Math.abs(grandDiff)/grandPurchased)*100).toFixed(1)}%` : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Explanation */}
              <div className="card" style={{ marginTop: 16 }}>
                <div className="ch"><div className="ct">ℹ️ How to Read This Report</div></div>
                <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                  {[
                    ['🛒 Purchased', '#1db97e', 'Total amount spent on purchases in this period from Purchase History'],
                    ['📉 Consumed', '#e84a5f', 'Value of inventory consumed based on recipe deductions when orders are paid'],
                    ['⚖️ Difference', 'var(--ink)', 'Purchased − Consumed. Positive = you have more stock than consumed. Negative = consumed more than purchased (error or opening stock)'],
                    ['Error %', 'var(--ink)', '≤10% is good. 10–25% needs review. >25% means recipes may not be set up correctly or stock is leaking'],
                  ].map(([title, color, desc]) => (
                    <div key={title} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="empty" style={{ padding: 60 }}><div className="ei">📊</div><h4>Select a date range</h4><p>Click Load to fetch consumption data</p></div>
      )}
    </div>
  );
}
