/**
 * Salary Management
 * Tabs: Monthly Summary | Advance List | Settlement History
 *
 * FORMULA (matches backend exactly):
 *   per_day        = monthly_salary / work_days_month
 *   effective_days = work_days_month + extra_days - absent_days (≥0)
 *   earned_salary  = per_day × effective_days
 *   advance_total  = SUM(pending advances)
 *   payable        = earned + bonus − advance_deducted − other_deductions
 *   pending        = MAX(0, payable − paid_amount)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  getSalarySummary, getStaffSalaryDetail, settleSalary,
  getAllSettlements, getAllAdvances, addAdvanceSalary, deleteAdvance,
  getStaff, saveAdjustments,
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { useWS, useWSEvent } from '../../context/WSContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';

// ── Helpers ─────────────────────────────────────────────
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const curMonth = () => localDate().slice(0, 7);
const p = n => Math.round(parseFloat(n || 0) * 100) / 100;
const fmt2 = n => p(n).toFixed(2);

const STATUS = {
  draft:   { label:'Draft',   color:'#b07a00', bg:'rgba(244,165,53,.13)' },
  partial: { label:'Partial', color:'#118ab2', bg:'rgba(17,138,178,.13)' },
  paid:    { label:'Paid',    color:'#1db97e', bg:'rgba(29,185,126,.13)' },
};
function SBadge({ status }) {
  const m = STATUS[status] || STATUS.draft;
  return <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:m.bg, color:m.color }}>{m.label}</span>;
}

const ROLE_COLOR = { admin:'#e84a5f', manager:'#118ab2', waiter:'#1db97e', staff:'#b07a00', captain:'#8b5cf6', chef:'#e8572a', helper:'#06b6d4' };
const ROLE_ICON  = { admin:'👑', manager:'🏠', waiter:'🍽️', staff:'👤', captain:'⭐', chef:'👨‍🍳', helper:'🤝' };

function CalcTable({ sd, overrides }) {
  const ov      = overrides || {};
  const bonus   = p(ov.bonus       !== undefined ? ov.bonus       : sd.bonus           || 0);
  const deduct  = p(ov.deductions  !== undefined ? ov.deductions  : sd.otherDeductions || 0);
  const advUsed = p(sd.totalPendingAdvance !== undefined ? sd.totalPendingAdvance : sd.advanceDeducted || 0);
  const earned  = p(sd.earnedSalary);
  const payable = p(earned + bonus - advUsed - deduct);
  const paid    = p(ov.paid_amount !== undefined ? ov.paid_amount : sd.paidAmount || 0);
  const pending = p(Math.max(0, payable - paid));

  const rows = [
    { k:'Monthly Salary',                               v:fmtCur(sd.monthlySalary), b:false },
    { k:'Work Days / Month',                            v:fmt2(sd.workDays),        b:false },
    { k:'Extra Days  (+)',                              v:`+${fmt2(sd.extraDays)}`, b:false, c:'#1db97e' },
    { k:'Absent Days  (−)',                             v:`-${fmt2(sd.absentDays)}`,b:false, c:'#e84a5f' },
    { k:'Effective Days',                               v:fmt2(sd.effectiveDays),   b:true  },
    { k:`Per-Day Salary  (÷ ${fmt2(sd.workDays)})`,    v:fmtCur(sd.perDaySalary),  b:false },
    { k:`Earned Salary  (× ${fmt2(sd.effectiveDays)})`,v:fmtCur(earned),           b:true, sep:true },
    { k:'+ Bonus',                                      v:fmtCur(bonus),            b:false, c:'#1db97e' },
    { k:`− Advance (${sd.month})`,                     v:fmtCur(advUsed),          b:false, c:'#e84a5f' },
    { k:'− Other Deductions',                           v:fmtCur(deduct),           b:false, c:'#e84a5f' },
    { k:'Payable Salary',                               v:fmtCur(payable),          b:true, sep:true, ac:true },
    { k:'Paid Amount',                                  v:fmtCur(paid),             b:false, c:'#1db97e' },
    { k:'Pending Amount',                               v:fmtCur(pending),          b:true, c:pending>0?'#e84a5f':'#1db97e' },
  ];
  return (
    <div style={{ background:'var(--bg)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'8px 14px',
          background: r.ac ? 'rgba(232,87,42,.07)' : 'transparent',
          borderBottom: r.sep ? '2px solid var(--border)' : '1px solid rgba(236,233,226,.5)',
        }}>
          <span style={{ fontSize:12, color:r.b?'var(--ink)':'var(--ink2)', fontWeight:r.b?700:400 }}>{r.k}</span>
          <span style={{ fontSize:13, fontWeight:r.b?800:600, color:r.c||(r.b?'var(--ink)':'var(--ink2)') }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

export default function SalaryMgmtPage() {
  const toast = useToast();
  const { connected } = useWS();
  const [tab, setTab]             = useState('summary');
  const [month, setMonth]         = useState(curMonth());
  const [summary, setSummary]     = useState([]);
  const [advances, setAdvances]   = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [allStaff, setAllStaff]   = useState([]);
  const [loading, setLoading]     = useState(false);

  const [settleModal, setSettleModal] = useState(null);
  const [settleForm, setSettleForm]   = useState({ bonus:'0', deductions:'0', paid_amount:'', notes:'' });
  const [settling, setSettling]       = useState(false);

  const [advModal, setAdvModal]   = useState(false);
  const [advForm, setAdvForm]     = useState({ user_id:'', amount:'', advance_date:localDate(), description:'' });
  const [advSaving, setAdvSaving] = useState(false);

  const [adjModal, setAdjModal]   = useState(null);
  const [adjForm, setAdjForm]     = useState({ extra_days:'0', absent_days:'0', notes:'' });
  const [expandedAdv, setExpandedAdv] = useState({});  // userId -> bool

  const loadSummary = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const r = await getSalarySummary(month);
      if (r.success) setSummary(r.data || []);
    } catch { if (!silent) toast('Failed to load salary data', 'er'); }
    if (!silent) setLoading(false);
  }, [month, toast]);

  const loadAdvances = useCallback(async () => {
    try {
      // Filter advances by advance_date month — Feb advance shows only in Feb
      const r = await getAllAdvances({ status:'pending', month });
      if (r.success) setAdvances(r.data || []);
    } catch {}
  }, [month]);

  const loadSettlements = useCallback(async () => {
    try {
      const r = await getAllSettlements({ month });
      if (r.success) setSettlements(r.data || []);
    } catch {}
  }, [month]);

  useEffect(() => {
    getStaff().then(r => { if (r.success) setAllStaff(r.data || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'summary')     loadSummary();
    if (tab === 'advances')    loadAdvances();
    if (tab === 'settlements') loadSettlements();
  }, [tab, month, loadSummary, loadAdvances, loadSettlements]);

  useWSEvent('salary_updated', () => { loadSummary(true); loadAdvances(); if (tab==='settlements') loadSettlements(); });
  useWSEvent('stats_update',   () => loadSummary(true));

  // Live calc for settle modal
  const liveCalc = settleModal ? (() => {
    const sd     = settleModal;
    const bonus  = p(settleForm.bonus);
    const deduct = p(settleForm.deductions);
    const adv    = p(sd.totalPendingAdvance);
    const payable = p(sd.earnedSalary + bonus - adv - deduct);
    const paid    = p(settleForm.paid_amount || 0);
    const pending = p(Math.max(0, payable - paid));
    const status  = pending < 0.01 ? 'paid' : paid > 0 ? 'partial' : 'draft';
    return { payable, pending, status };
  })() : null;

  // Adj preview
  const adjPreview = adjModal ? (() => {
    const wd  = p(adjModal.workDays);
    const eff = Math.max(0, wd + p(adjForm.extra_days) - p(adjForm.absent_days));
    const pd  = wd > 0 ? p(adjModal.monthlySalary / wd) : 0;
    return { eff, perDay:pd, earned:p(pd * eff) };
  })() : null;

  const doSettle = async () => {
    if (!settleModal || !liveCalc) return;
    if (p(settleForm.paid_amount) > liveCalc.payable + 0.01) {
      toast(`Paid ${fmtCur(p(settleForm.paid_amount))} exceeds payable ${fmtCur(liveCalc.payable)}`, 'er');
      return;
    }
    setSettling(true);
    try {
      const r = await settleSalary({
        user_id:    settleModal.user.id,
        month,
        bonus:      p(settleForm.bonus),
        deductions: p(settleForm.deductions),
        paid_amount: p(settleForm.paid_amount || 0),
        notes:      settleForm.notes,
      });
      if (r.success) { toast(`✅ Settlement saved — ${r.data.status}`, 'ok'); setSettleModal(null); loadSummary(true); loadAdvances(); }
      else toast(r.message, 'er');
    } catch (e) { toast(e.message, 'er'); }
    setSettling(false);
  };

  const doAddAdvance = async () => {
    if (!advForm.user_id)                  { toast('Select staff member', 'er'); return; }
    if (!advForm.amount || p(advForm.amount) <= 0) { toast('Enter valid amount', 'er'); return; }
    if (!advForm.advance_date)             { toast('Select date', 'er'); return; }
    setAdvSaving(true);
    try {
      const r = await addAdvanceSalary({ user_id:parseInt(advForm.user_id), amount:p(advForm.amount), advance_date:advForm.advance_date, description:advForm.description });
      if (r.success) { toast('✅ Advance added!', 'ok'); setAdvModal(false); setAdvForm({ user_id:'', amount:'', advance_date:localDate(), description:'' }); loadAdvances(); loadSummary(true); }
      else toast(r.message, 'er');
    } catch (e) { toast(e.message, 'er'); }
    setAdvSaving(false);
  };

  const doSaveAdj = async () => {
    if (!adjModal) return;
    try {
      const r = await saveAdjustments(adjModal.user.id, { month, extra_days:p(adjForm.extra_days), absent_days:p(adjForm.absent_days), notes:adjForm.notes });
      if (r.success) { toast('✅ Attendance updated!', 'ok'); setAdjModal(null); loadSummary(true); }
      else toast(r.message, 'er');
    } catch (e) { toast(e.message, 'er'); }
  };

  const doDeleteAdv = async (adv) => {
    if (!window.confirm(`Delete ₹${adv.amount} advance for ${adv.staff_name}?`)) return;
    try {
      const r = await deleteAdvance(adv.id);
      if (r.success) { toast('Deleted', 'ok'); loadAdvances(); loadSummary(true); }
      else toast(r.message, 'er');
    } catch (e) { toast(e.message, 'er'); }
  };

  const totals = summary.reduce((a, sd) => ({
    monthly: a.monthly + p(sd.monthlySalary),
    earned:  a.earned  + p(sd.earnedSalary),
    advance: a.advance + p(sd.totalPendingAdvance),
    payable: a.payable + p(sd.payableSalary),
    paid:    a.paid    + p(sd.paidAmount),
    pending: a.pending + p(sd.pendingAmount),
  }), { monthly:0, earned:0, advance:0, payable:0, paid:0, pending:0 });

  const TABS = [
    { id:'summary',     icon:'📊', label:'Monthly Summary'  },
    { id:'advances',    icon:'🤝', label:'Pending Advances' },
    { id:'settlements', icon:'✅', label:'Settlements'      },
  ];

  return (
    <div>
      <style>{`@keyframes sal-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}`}</style>

      <div className="ph" style={{ marginBottom:22 }}>
        <div className="ph-left">
          <div className="pt">💰 Salary Management</div>
          <div className="ps">Monthly salary calculation, advances &amp; settlements</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:800,
            background:connected?'rgba(29,185,126,.1)':'rgba(232,74,95,.08)',
            border:`1.5px solid ${connected?'#1db97e':'#e84a5f'}`, color:connected?'#1db97e':'#e84a5f' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:connected?'#1db97e':'#e84a5f', animation:connected?'sal-pulse 2s infinite':'none' }}/>
            {connected ? 'Live' : 'Offline'}
          </div>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, background:'var(--bg)', color:'var(--ink)', outline:'none' }}/>
          <button className="btn-p" onClick={() => { setAdvForm({ user_id:'', amount:'', advance_date:localDate(), description:'' }); setAdvModal(true); }}>
            🤝 Add Advance
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'2px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 22px', fontWeight:700, fontSize:13, border:'none', cursor:'pointer',
            background:'transparent', fontFamily:'inherit', borderRadius:'8px 8px 0 0',
            color:tab===t.id?'var(--accent)':'var(--ink2)',
            borderBottom:tab===t.id?'2.5px solid var(--accent)':'2.5px solid transparent',
            marginBottom:-2, transition:'color .15s',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ─── SUMMARY ─── */}
      {tab === 'summary' && (
        loading ? <div style={{ textAlign:'center', padding:80, color:'var(--ink2)' }}>Loading salary data…</div>
        : summary.length === 0 ? <div className="empty"><div className="ei">💰</div><h4>No active staff</h4></div>
        : (
          <div className="card" style={{ padding:0 }}>
            <div style={{ overflowX:'auto' }}>
              <table>
                <thead><tr>
                  <th>Staff</th>
                  <th style={{textAlign:'right'}}>Monthly</th>
                  <th style={{textAlign:'right'}}>₹/min</th>
                  <th>Attendance</th>
                  <th style={{textAlign:'right'}}>Earned</th>
                  <th style={{textAlign:'right'}}>Advance</th>
                  <th style={{textAlign:'right'}}>Payable</th>
                  <th style={{textAlign:'right'}}>Paid</th>
                  <th style={{textAlign:'right'}}>Pending</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {summary.map((sd, i) => {
                    const ri = ROLE_ICON[sd.user?.role]  || '👤';
                    const rc = ROLE_COLOR[sd.user?.role] || '#888';
                    return (
                      <React.Fragment key={i}>
                      <tr>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:36, height:36, borderRadius:10, background:`${rc}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{ri}</div>
                            <div>
                              <div style={{ fontWeight:700 }}>{sd.user?.name}</div>
                              <div style={{ fontSize:11, color:'var(--ink2)', textTransform:'capitalize' }}>{sd.user?.designation || sd.user?.role}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign:'right', fontWeight:700 }}>{fmtCur(sd.monthlySalary)}</td>
                        <td style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, color:'var(--accent)', fontWeight:700 }}>
                          {sd.perMinSalary > 0 ? `₹${parseFloat(sd.perMinSalary).toFixed(5)}` : '—'}
                          <div style={{ fontSize:9, color:'var(--ink2)', fontFamily:'inherit' }}>{sd.hoursPerDay||8}h/day</div>
                        </td>
                        <td>
                          <span style={{ fontWeight:800 }}>{fmt2(sd.effectiveDays)}</span>
                          <span style={{ color:'var(--ink2)' }}> / {fmt2(sd.workDays)}</span>
                          {(sd.extraDays > 0 || sd.absentDays > 0) && (
                            <div style={{ fontSize:10 }}>
                              {sd.extraDays  > 0 && <span style={{ color:'#1db97e' }}>+{fmt2(sd.extraDays)} </span>}
                              {sd.absentDays > 0 && <span style={{ color:'#e84a5f' }}>-{fmt2(sd.absentDays)}</span>}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'#1db97e' }}>{fmtCur(sd.earnedSalary)}</td>
                        <td style={{ textAlign:'right', color:p(sd.totalPendingAdvance)>0?'#e84a5f':'var(--ink2)' }}>
                          {p(sd.totalPendingAdvance)>0 ? `−${fmtCur(sd.totalPendingAdvance)}` : '—'}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:900, color:'var(--accent)' }}>{fmtCur(sd.payableSalary)}</td>
                        <td style={{ textAlign:'right', color:'#1db97e', fontWeight:700 }}>
                          {p(sd.paidAmount)>0 ? fmtCur(sd.paidAmount) : '—'}
                        </td>
                        <td style={{ textAlign:'right' }}>
                          <span style={{ fontWeight:900, color:p(sd.pendingAmount)>0?'#e84a5f':'#1db97e' }}>{fmtCur(sd.pendingAmount)}</span>
                        </td>
                        <td><SBadge status={sd.status}/></td>
                        <td>
                          <div className="tact" style={{flexDirection:'column',gap:5}}>
                            <div style={{display:'flex',gap:5}}>
                              <button className="bsm be" title="Attendance" onClick={() => { setAdjForm({ extra_days:String(sd.extraDays||'0'), absent_days:String(sd.absentDays||'0'), notes:'' }); setAdjModal(sd); }}>📅 Days</button>
                              {sd.status !== 'paid' && (
                                <button className="bsm bt" title="Settle salary" onClick={() => { setSettleForm({ bonus:String(sd.bonus||'0'), deductions:String(sd.otherDeductions||'0'), paid_amount:'', notes:'' }); setSettleModal(sd); }}>💳 Settle</button>
                              )}
                            </div>
                            {p(sd.totalPendingAdvance) > 0 && (
                              <button className="bsm" style={{fontSize:11,color:'#e84a5f',border:'1.5px solid rgba(232,74,95,.3)',background:'rgba(232,74,95,.05)',width:'100%'}}
                                onClick={() => setExpandedAdv(e=>({...e,[sd.user.id]:!e[sd.user.id]}))}>
                                {expandedAdv[sd.user?.id] ? '▲' : '▼'} Advances ({sd.advances?.length||0})
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* ── Inline Advances Expander ── */}
                      {expandedAdv[sd.user?.id] && (
                        <tr style={{background:'rgba(232,74,95,.025)'}}>
                          <td colSpan={10} style={{padding:'0 20px 14px',paddingLeft:60}}>
                            <div style={{marginTop:10}}>
                              <div style={{fontSize:11,fontWeight:800,color:'#e84a5f',marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>
                                💸 Advances for {month}
                              </div>
                              {(sd.advances||[]).length === 0 ? (
                                <div style={{fontSize:12,color:'var(--ink2)'}}>No advances this month</div>
                              ) : (
                                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                  {(sd.advances||[]).map((adv,ai) => (
                                    <div key={ai} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:'var(--surface)',borderRadius:8,border:'1px solid rgba(232,74,95,.15)'}}>
                                      <div style={{fontWeight:800,color:'#e84a5f',fontSize:14,minWidth:80}}>{fmtCur(adv.amount)}</div>
                                      <div style={{fontSize:12,color:'var(--ink2)'}}>📅 {adv.advance_date?.slice(0,10)}</div>
                                      {adv.description && <div style={{fontSize:12,color:'var(--ink2)',fontStyle:'italic'}}>· {adv.description}</div>}
                                      <div style={{marginLeft:'auto'}}>
                                        <button className="bsm bd" style={{fontSize:11}} onClick={()=>doDeleteAdv(adv)}>🗑️ Delete</button>
                                      </div>
                                    </div>
                                  ))}
                                  <div style={{display:'flex',justifyContent:'space-between',padding:'6px 12px',background:'rgba(232,74,95,.07)',borderRadius:8,marginTop:2}}>
                                    <span style={{fontSize:12,fontWeight:700,color:'var(--ink2)'}}>Total advances this month</span>
                                    <span style={{fontSize:13,fontWeight:900,color:'#e84a5f'}}>{fmtCur(sd.totalPendingAdvance)}</span>
                                  </div>
                                </div>
                              )}
                              <div style={{marginTop:10}}>
                                <button className="btn-p" style={{fontSize:12,padding:'7px 14px'}}
                                  onClick={() => { setAdvForm({ user_id:String(sd.user.id), amount:'', advance_date:localDate(), description:'' }); setAdvModal(true); }}>
                                  + Add Advance
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Totals footer */}
            <div style={{ padding:'14px 20px', borderTop:'2px solid var(--border)', background:'rgba(26,26,46,.02)', display:'flex', gap:28, flexWrap:'wrap' }}>
              {[
                ['Total Payroll', totals.monthly, 'var(--ink)'],
                ['Total Earned',  totals.earned,  '#1db97e'],
                ['Total Advance', totals.advance, '#e84a5f'],
                ['Total Payable', totals.payable, 'var(--accent)'],
                ['Total Paid',    totals.paid,    '#1db97e'],
                ['Total Pending', totals.pending, '#e84a5f'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--ink2)', fontWeight:700, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:17, fontWeight:900, color }}>{fmtCur(val)}</div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ─── ADVANCES ─── */}
      {tab === 'advances' && (
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'10px 18px', background:'rgba(17,138,178,.07)', borderBottom:'1px solid rgba(17,138,178,.15)', fontSize:12, color:'#118ab2', display:'flex', alignItems:'center', gap:8 }}>
            <span>📅</span>
            <span>Showing advances where <strong>advance date falls in {month}</strong>. Use the month picker above to view other months.</span>
          </div>
          {advances.length === 0 ? (
            <div className="empty"><div className="ei">🤝</div><h4>No advances for {month}</h4><p>No advances were given in this month</p></div>
          ) : (
            <>
              <table>
                <thead><tr>
                  <th>Staff</th><th>Role</th><th style={{textAlign:'right'}}>Amount</th><th>Advance Date</th><th>Note</th><th>Action</th>
                </tr></thead>
                <tbody>
                  {advances.map((adv, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:700 }}>{adv.staff_name}</td>
                      <td style={{ fontSize:12, color:'var(--ink2)', textTransform:'capitalize' }}>{adv.role}</td>
                      <td style={{ textAlign:'right', fontWeight:800, color:'#e84a5f' }}>{fmtCur(adv.amount)}</td>
                      <td style={{ fontSize:13, color:'var(--ink2)' }}>{adv.advance_date?.slice(0,10)}</td>
                      <td style={{ fontSize:12, color:'var(--ink2)', maxWidth:200 }}>{adv.description || '—'}</td>
                      <td><button className="bsm bd" onClick={() => doDeleteAdv(adv)}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:13 }}>
                  Total for {month}: <strong style={{ color:'#e84a5f' }}>{fmtCur(advances.reduce((s,a)=>s+p(a.amount),0))}</strong>
                  <span style={{ color:'var(--ink2)', marginLeft:8 }}>({advances.length} advance{advances.length!==1?'s':''})</span>
                </div>
                <button className="btn-p" onClick={() => { setAdvForm({ user_id:'', amount:'', advance_date:localDate(), description:'' }); setAdvModal(true); }}>+ Add Advance</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── SETTLEMENTS ─── */}
      {tab === 'settlements' && (
        <div className="card" style={{ padding:0 }}>
          {settlements.length === 0 ? (
            <div className="empty"><div className="ei">✅</div><h4>No settlements for {month}</h4><p>Use Monthly Summary to settle salaries</p></div>
          ) : (
            <table>
              <thead><tr>
                <th>Staff</th><th>Month</th>
                <th style={{textAlign:'right'}}>Earned</th>
                <th style={{textAlign:'right'}}>Advance</th>
                <th style={{textAlign:'right'}}>Bonus</th>
                <th style={{textAlign:'right'}}>Payable</th>
                <th style={{textAlign:'right'}}>Paid</th>
                <th style={{textAlign:'right'}}>Pending</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {settlements.map((s, i) => (
                  <tr key={i}>
                    <td><div style={{ fontWeight:700 }}>{s.staff_name}</div><div style={{ fontSize:11, color:'var(--ink2)', textTransform:'capitalize' }}>{s.role}</div></td>
                    <td style={{ fontSize:13, color:'var(--ink2)' }}>{s.month}</td>
                    <td style={{ textAlign:'right', color:'#1db97e', fontWeight:700 }}>{fmtCur(s.earned_salary)}</td>
                    <td style={{ textAlign:'right', color:p(s.advance_deducted)>0?'#e84a5f':'var(--ink2)' }}>{p(s.advance_deducted)>0?`−${fmtCur(s.advance_deducted)}`:'—'}</td>
                    <td style={{ textAlign:'right', color:p(s.bonus)>0?'#1db97e':'var(--ink2)' }}>{p(s.bonus)>0?`+${fmtCur(s.bonus)}`:'—'}</td>
                    <td style={{ textAlign:'right', fontWeight:900, color:'var(--accent)' }}>{fmtCur(s.payable_salary)}</td>
                    <td style={{ textAlign:'right', fontWeight:700, color:'#1db97e' }}>{fmtCur(s.paid_amount)}</td>
                    <td style={{ textAlign:'right', fontWeight:800, color:p(s.pending_amount)>0?'#e84a5f':'#1db97e' }}>{fmtCur(s.pending_amount)}</td>
                    <td><SBadge status={s.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── RATE CARD ─── */}
      {tab === 'ratecard' && (
        <div>
          {/* Explainer */}
          <div style={{ padding:'12px 16px', background:'rgba(17,138,178,.07)', border:'1px solid rgba(17,138,178,.2)', borderRadius:10, marginBottom:16, fontSize:13, color:'#118ab2' }}>
            <strong>⏱️ Per-Minute Rate Card</strong> — Shows each staff member's effective ₹/min used in recipe costing.
            Adjust bonus days and absent days below to see how they affect the rate.
            <br/><span style={{ fontSize:11, opacity:.8, marginTop:3, display:'block' }}>Formula: <code>₹/min = Monthly Salary × (Effective Days / Work Days) / (Effective Days × Hours/Day × 60)</code> → simplified: <code>Monthly Salary / (Work Days × Hours × 60)</code> adjusted for attendance</span>
          </div>

          {allStaff.filter(s => parseFloat(s.monthly_salary) > 0).length === 0 ? (
            <div className="empty"><div className="ei">⏱️</div><h4>No staff with salary configured</h4><p>Add staff in Staff Management with a monthly salary</p></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {allStaff.filter(s => parseFloat(s.monthly_salary) > 0).map(staff => {
                const adj          = rateAdj[staff.id] || {};
                const monthlySal   = parseFloat(staff.monthly_salary) || 0;
                const workDays     = parseFloat(staff.work_days_month) || 26;
                const hoursPerDay  = parseFloat(adj.hours_override || staff.hours_per_day || 8);
                const bonusDays    = parseFloat(adj.bonus_days  || 0);
                const absentDays   = parseFloat(adj.absent_days || 0);
                const effectiveDays = Math.max(0, workDays + bonusDays - absentDays);

                // Base rate (no adj)
                const basePerMin   = monthlySal / (workDays * hoursPerDay * 60);
                // Effective rate: salary scales proportionally with effective days
                // earned = (monthly / workDays) × effectiveDays
                // effective ₹/min = earned / (effectiveDays × hours × 60)
                // = (monthly / workDays) / (hours × 60)   — same as base actually
                // BUT for recipe costing we want: what does 1 minute of this person cost THIS month?
                // = earned_salary / (effectiveDays × hours × 60)
                const perDay       = workDays > 0 ? monthlySal / workDays : 0;
                const earnedSal    = perDay * effectiveDays;
                const effPerMin    = effectiveDays > 0 ? earnedSal / (effectiveDays * hoursPerDay * 60) : 0;
                // Note: effPerMin = basePerMin always. Adjusting effective days doesn't change per-minute rate.
                // What DOES change: total salary cost for the month, and the effective monthly cost.
                const effPerHour   = effPerMin * 60;
                const effPerDay    = effPerMin * 60 * hoursPerDay;

                const changed      = bonusDays !== 0 || absentDays !== 0 || parseFloat(adj.hours_override||0) !== 0;
                const setAdj = (field, val) => setRateAdj(prev => ({ ...prev, [staff.id]: { ...(prev[staff.id]||{}), [field]: val }}));

                return (
                  <div key={staff.id} style={{ background:'var(--surface)', border:`1.5px solid ${changed?'rgba(232,87,42,.3)':'var(--border)'}`, borderRadius:14, overflow:'hidden' }}>
                    {/* Header */}
                    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 18px', background: changed?'rgba(232,87,42,.04)':'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, flexShrink:0 }}>
                        {staff.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:800, fontSize:15 }}>{staff.name}</div>
                        <div style={{ fontSize:12, color:'var(--ink2)' }}>{staff.designation || staff.role} · {fmtCur(monthlySal)}/mo · {workDays}d · {hoursPerDay}h/day</div>
                      </div>
                      {/* Key rate badges */}
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'flex-end' }}>
                        {[
                          { label:'Per Minute', val:`₹${effPerMin.toFixed(5)}`, color:'var(--accent)', big:true },
                          { label:'Per Hour',   val:fmtCur(effPerHour),          color:'#118ab2' },
                          { label:'Per Day',    val:fmtCur(effPerDay),           color:'#1db97e' },
                          { label:'Earned/mo',  val:fmtCur(earnedSal),           color: absentDays>0?'#e84a5f':bonusDays>0?'#1db97e':'var(--ink)' },
                        ].map(b => (
                          <div key={b.label} style={{ textAlign:'center', padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
                            <div style={{ fontSize:10, color:'var(--ink2)', fontWeight:700, marginBottom:2 }}>{b.label}</div>
                            <div style={{ fontSize: b.big?15:13, fontWeight:900, color:b.color, fontFamily: b.big?'monospace':'inherit' }}>{b.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Controls */}
                    <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, alignItems:'end' }}>
                      {/* Bonus Days */}
                      <div>
                        <label style={{ fontSize:11, fontWeight:700, color:'#1db97e', display:'block', marginBottom:5 }}>➕ Bonus Days</label>
                        <input type="number" min="0" max="15" step="0.5"
                          value={adj.bonus_days||''} placeholder="0"
                          onChange={e => setAdj('bonus_days', e.target.value)}
                          style={{ width:'100%', padding:'8px 10px', border:'1.5px solid rgba(29,185,126,.4)', borderRadius:8, fontSize:14, fontWeight:700, color:'#1db97e', background:'rgba(29,185,126,.05)', outline:'none' }} />
                        <div style={{ fontSize:10, color:'var(--ink2)', marginTop:3 }}>Extra days worked</div>
                      </div>
                      {/* Absent Days */}
                      <div>
                        <label style={{ fontSize:11, fontWeight:700, color:'#e84a5f', display:'block', marginBottom:5 }}>➖ Absent Days</label>
                        <input type="number" min="0" max={workDays} step="0.5"
                          value={adj.absent_days||''} placeholder="0"
                          onChange={e => setAdj('absent_days', e.target.value)}
                          style={{ width:'100%', padding:'8px 10px', border:'1.5px solid rgba(232,74,95,.4)', borderRadius:8, fontSize:14, fontWeight:700, color:'#e84a5f', background:'rgba(232,74,95,.05)', outline:'none' }} />
                        <div style={{ fontSize:10, color:'var(--ink2)', marginTop:3 }}>Days not worked</div>
                      </div>
                      {/* Hours Override */}
                      <div>
                        <label style={{ fontSize:11, fontWeight:700, color:'#118ab2', display:'block', marginBottom:5 }}>⏰ Hours/Day Override</label>
                        <select
                          value={adj.hours_override||staff.hours_per_day||8}
                          onChange={e => setAdj('hours_override', e.target.value)}
                          style={{ width:'100%', padding:'8px 10px', border:'1.5px solid rgba(17,138,178,.4)', borderRadius:8, fontSize:13, fontWeight:700, color:'#118ab2', background:'rgba(17,138,178,.05)', outline:'none' }}>
                          {[4,5,6,7,8,9,10,11,12,14,16].map(h=>(
                            <option key={h} value={h}>{h}h{h===8?' (std)':h===12?' (dbl)':''}</option>
                          ))}
                        </select>
                        <div style={{ fontSize:10, color:'var(--ink2)', marginTop:3 }}>Default: {staff.hours_per_day||8}h from profile</div>
                      </div>
                      {/* Reset + Apply to attendance */}
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        <button onClick={() => setRateAdj(prev => { const n={...prev}; delete n[staff.id]; return n; })}
                          style={{ padding:'8px 12px', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--ink2)' }}>
                          🔄 Reset
                        </button>
                        <button onClick={() => {
                            setAdjForm({ extra_days: String(bonusDays||'0'), absent_days: String(absentDays||'0'), notes:'' });
                            // Find matching summary entry
                            const sd = summary.find(s => s.user?.id === staff.id) || { user: staff, workDays, monthlySalary: monthlySal };
                            setAdjModal(sd);
                          }}
                          style={{ padding:'8px 12px', background:'rgba(232,87,42,.08)', border:'1.5px solid rgba(232,87,42,.3)', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--accent)' }}>
                          📅 Apply to {month}
                        </button>
                      </div>
                    </div>

                    {/* Calculation breakdown */}
                    <div style={{ margin:'0 18px 14px', padding:'10px 14px', background:'var(--bg)', borderRadius:10, fontSize:12 }}>
                      <div style={{ fontWeight:800, color:'var(--ink2)', marginBottom:8, fontSize:11, textTransform:'uppercase', letterSpacing:.5 }}>📐 Calculation Breakdown</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:8 }}>
                        {[
                          { label:'Monthly Salary',   val:fmtCur(monthlySal),                        color:'var(--ink)' },
                          { label:'Work Days/Month',   val:`${workDays} days`,                        color:'var(--ink)' },
                          { label:'Bonus Days',        val:`+${bonusDays} days`,                      color:'#1db97e',  skip: bonusDays===0 },
                          { label:'Absent Days',       val:`-${absentDays} days`,                     color:'#e84a5f',  skip: absentDays===0 },
                          { label:'Effective Days',    val:`${effectiveDays} days`,                   color: absentDays>bonusDays?'#e84a5f':bonusDays>0?'#1db97e':'var(--ink)', bold:true },
                          { label:'Per Day',           val:fmtCur(perDay),                            color:'var(--ink)' },
                          { label:'Earned Salary',     val:fmtCur(earnedSal),                         color: earnedSal<monthlySal?'#e84a5f':earnedSal>monthlySal?'#1db97e':'var(--ink)', bold:true },
                          { label:'Hours/Day',         val:`${hoursPerDay}h`,                         color:'#118ab2' },
                          { label:'Mins/Day',          val:`${hoursPerDay*60} min`,                   color:'#118ab2' },
                          { label:'Per Hour',          val:fmtCur(effPerHour),                        color:'var(--ink)' },
                          { label:'Per Minute',        val:`₹${effPerMin.toFixed(6)}`,                color:'var(--accent)', bold:true },
                          { label:'Per 45min cook',    val:fmtCur(effPerMin * 45),                    color:'var(--accent)' },
                        ].filter(r => !r.skip).map(row => (
                          <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 10px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border)' }}>
                            <span style={{ color:'var(--ink2)', fontSize:11 }}>{row.label}</span>
                            <span style={{ fontWeight: row.bold?900:700, color:row.color, fontSize:11, fontFamily: row.label==='Per Minute'?'monospace':'inherit' }}>{row.val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Visual impact bar */}
                      {(bonusDays !== 0 || absentDays !== 0) && (
                        <div style={{ marginTop:10, padding:'8px 12px', background: absentDays>bonusDays?'rgba(232,74,95,.08)':'rgba(29,185,126,.08)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:12, color:'var(--ink2)' }}>
                            Salary impact: {absentDays>bonusDays?'▼ Deduction':'▲ Bonus'}
                          </span>
                          <span style={{ fontWeight:900, fontSize:14, color: absentDays>bonusDays?'#e84a5f':'#1db97e' }}>
                            {absentDays>bonusDays ? `-${fmtCur(monthlySal - earnedSal)}` : `+${fmtCur(earnedSal - monthlySal)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── SETTLE MODAL ─── */}
      <Modal show={!!settleModal} onClose={() => setSettleModal(null)}
        title={`💳 Settle Salary — ${settleModal?.user?.name} (${month})`} wide>
        {settleModal && liveCalc && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--ink2)', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>Calculation Breakdown</div>
                <CalcTable sd={settleModal} overrides={{ bonus:settleForm.bonus, deductions:settleForm.deductions, paid_amount:settleForm.paid_amount }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--ink2)', marginBottom:8 }}>ATTENDANCE · {month}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                    {[['Work Days',fmt2(settleModal.workDays),'var(--ink)'],['Extra',`+${fmt2(settleModal.extraDays)}`,'#1db97e'],['Absent',`-${fmt2(settleModal.absentDays)}`,'#e84a5f']].map(([l,v,c]) => (
                      <div key={l} style={{ background:'var(--surface)', padding:'7px 8px', borderRadius:8, textAlign:'center' }}>
                        <div style={{ fontSize:9, color:'var(--ink2)' }}>{l}</div>
                        <div style={{ fontSize:15, fontWeight:900, color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:'var(--ink2)' }}>Per-day: <strong>{fmtCur(settleModal.perDaySalary)}</strong> · Effective: <strong style={{ color:'var(--accent)' }}>{fmt2(settleModal.effectiveDays)} days</strong></div>
                </div>
                <div><label className="mlabel">Bonus (₹)</label>
                  <input className="mfi" type="number" min="0" step="0.01" value={settleForm.bonus} onChange={e=>setSettleForm(f=>({...f,bonus:e.target.value}))} placeholder="0"/></div>
                <div><label className="mlabel">Other Deductions (₹)</label>
                  <input className="mfi" type="number" min="0" step="0.01" value={settleForm.deductions} onChange={e=>setSettleForm(f=>({...f,deductions:e.target.value}))} placeholder="0"/></div>
                <div>
                  <label className="mlabel">Pay Now (₹) — Payable: <strong style={{ color:'var(--accent)' }}>{fmtCur(liveCalc.payable)}</strong></label>
                  <input className="mfi" type="number" min="0" step="0.01" max={liveCalc.payable}
                    value={settleForm.paid_amount} onChange={e=>setSettleForm(f=>({...f,paid_amount:e.target.value}))} placeholder={`Max ${fmt2(liveCalc.payable)}`}/>
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button className="btn-c" style={{ flex:1, fontSize:12 }} onClick={() => setSettleForm(f=>({...f,paid_amount:fmt2(liveCalc.payable)}))}>Full Pay</button>
                    <button className="btn-c" style={{ flex:1, fontSize:12 }} onClick={() => setSettleForm(f=>({...f,paid_amount:'0'}))}>Draft</button>
                  </div>
                </div>
                <div><label className="mlabel">Notes</label>
                  <input className="mfi" value={settleForm.notes} onChange={e=>setSettleForm(f=>({...f,notes:e.target.value}))} placeholder="Optional"/></div>
                <div style={{ padding:'14px 16px', borderRadius:12, background:'rgba(232,87,42,.07)', border:'1.5px solid rgba(232,87,42,.2)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>Payable</span>
                    <span style={{ fontSize:15, fontWeight:900, color:'var(--accent)' }}>{fmtCur(liveCalc.payable)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>After Payment</span>
                    <span style={{ fontSize:14, fontWeight:900, color:liveCalc.pending>0?'#e84a5f':'#1db97e' }}>
                      {liveCalc.pending>0 ? `${fmtCur(liveCalc.pending)} pending` : '✅ Fully Paid'}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--ink2)' }}>Status: <SBadge status={liveCalc.status}/></div>
                </div>
              </div>
            </div>
            <div className="mft">
              <button className="btn-c" onClick={() => setSettleModal(null)}>Cancel</button>
              <button className="btn-p" onClick={doSettle} disabled={settling}>{settling?'⏳ Saving…':'💾 Save Settlement'}</button>
            </div>
          </>
        )}
      </Modal>

      {/* ─── ADD ADVANCE MODAL ─── */}
      <Modal show={advModal} onClose={() => setAdvModal(false)} title="🤝 Add Salary Advance">
        <div className="mgrid">
          <div className="mfull">
            <label className="mlabel">Staff Member *</label>
            <select className="mfi" value={advForm.user_id} onChange={e=>setAdvForm(f=>({...f,user_id:e.target.value}))}>
              <option value="">Select staff…</option>
              {allStaff.filter(s=>s.is_active).map(s=>(
                <option key={s.id} value={s.id}>{s.name} ({s.designation||s.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mlabel">Amount (₹) *</label>
            <input className="mfi" type="number" min="1" step="0.01" value={advForm.amount} onChange={e=>setAdvForm(f=>({...f,amount:e.target.value}))} placeholder="Enter amount" autoFocus/>
          </div>
          <div>
            <label className="mlabel">Date *</label>
            <input className="mfi" type="date" value={advForm.advance_date} onChange={e=>setAdvForm(f=>({...f,advance_date:e.target.value}))}/>
          </div>
          <div className="mfull">
            <label className="mlabel">Reason / Note</label>
            <input className="mfi" value={advForm.description} onChange={e=>setAdvForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Festival advance, Medical emergency…"/>
          </div>
        </div>
        <div className="mft">
          <button className="btn-c" onClick={() => setAdvModal(false)}>Cancel</button>
          <button className="btn-p" onClick={doAddAdvance} disabled={advSaving}>{advSaving?'Saving…':'Add Advance'}</button>
        </div>
      </Modal>

      {/* ─── ATTENDANCE ADJUST MODAL ─── */}
      <Modal show={!!adjModal} onClose={() => setAdjModal(null)} title={`📅 Attendance — ${adjModal?.user?.name} (${month})`}>
        {adjModal && adjPreview && (
          <>
            <div style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:10, marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--ink2)' }}>
                Base work days: <strong>{adjModal.workDays}</strong> · Monthly: <strong>{fmtCur(adjModal.monthlySalary)}</strong>
              </div>
            </div>
            <div className="mgrid">
              <div>
                <label className="mlabel">Extra / Overtime Days (+)</label>
                <input className="mfi" type="number" min="0" step="0.5" value={adjForm.extra_days} onChange={e=>setAdjForm(f=>({...f,extra_days:e.target.value}))}/>
              </div>
              <div>
                <label className="mlabel">Absent Days (−)</label>
                <input className="mfi" type="number" min="0" step="0.5" value={adjForm.absent_days} onChange={e=>setAdjForm(f=>({...f,absent_days:e.target.value}))}/>
              </div>
              <div className="mfull">
                <div style={{ padding:'12px 14px', borderRadius:10, background:'rgba(232,87,42,.07)', border:'1.5px solid rgba(232,87,42,.2)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>Effective Days</span>
                    <span style={{ fontSize:15, fontWeight:900, color:'var(--accent)' }}>{fmt2(adjPreview.eff)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:12, color:'var(--ink2)' }}>Earned Salary</span>
                    <span style={{ fontSize:13, fontWeight:800, color:'#1db97e' }}>{fmtCur(adjPreview.earned)}</span>
                  </div>
                </div>
              </div>
              <div className="mfull">
                <label className="mlabel">Notes</label>
                <input className="mfi" value={adjForm.notes} onChange={e=>setAdjForm(f=>({...f,notes:e.target.value}))} placeholder="Optional"/>
              </div>
            </div>
            <div className="mft">
              <button className="btn-c" onClick={() => setAdjModal(null)}>Cancel</button>
              <button className="btn-p" onClick={doSaveAdj}>Save Attendance</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
