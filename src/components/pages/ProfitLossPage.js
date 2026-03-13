import React, { useState, useEffect, useCallback } from 'react';
import { getDailyPnl, addFixedCost, updateFixedCost, deleteFixedCost, addManualSale, updateManualSale, deleteManualSale, getManualSales } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';

const today = new Date();
const todayMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;

function daysInMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}
function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function dayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
}

export default function ProfitLossPage() {
  const toast = useToast();
  const [month, setMonth]               = useState(todayMonth);
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [targetProfit, setTargetProfit] = useState('');
  const [fcModal, setFcModal]           = useState(false);
  const [fcEditing, setFcEditing]       = useState(null);
  const [fcForm, setFcForm]             = useState({ name: '', amount: '', category: 'rent' });
  const [fcSaving, setFcSaving]         = useState(false);
  const [msModal, setMsModal]           = useState(false);
  const [msDate, setMsDate]             = useState('');
  const [msEditing, setMsEditing]       = useState(null);
  const [msForm, setMsForm]             = useState({ amount: '', base_cost: '', note: '', source: 'Cash' });
  const [msSaving, setMsSaving]         = useState(false);
  const [msList, setMsList]             = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getDailyPnl({ month });
      if (r.success) setData(r.data);
    } catch (e) { toast('Failed to load P&L data', 'er'); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const openFcModal = (fc = null) => {
    setFcEditing(fc);
    setFcForm(fc ? { name: fc.name, amount: fc.amount, category: fc.category || 'rent' } : { name: '', amount: '', category: 'rent' });
    setFcModal(true);
  };

  const saveFc = async () => {
    if (!fcForm.name || !fcForm.amount) { toast('Name and amount required', 'er'); return; }
    setFcSaving(true);
    try {
      const payload = { ...fcForm, amount: parseFloat(fcForm.amount), month };
      if (fcEditing) await updateFixedCost(fcEditing.id, payload);
      else await addFixedCost(payload);
      setFcModal(false);
      await load();
      toast('Saved ✓');
    } catch (e) { toast('Save failed', 'er'); }
    finally { setFcSaving(false); }
  };

  const delFc = async (fc) => {
    if (!window.confirm(`Delete "${fc.name}"?`)) return;
    await deleteFixedCost(fc.id);
    await load();
    toast('Deleted');
  };

  const openMsModal = async (dateStr, entry = null) => {
    setMsDate(dateStr);
    setMsEditing(entry);
    setMsForm(entry
      ? { amount: entry.amount, base_cost: entry.base_cost || '', note: entry.note || '', source: entry.source || 'Cash' }
      : { amount: '', base_cost: '', note: '', source: 'Cash' });
    try {
      const r = await getManualSales({ date: dateStr });
      if (r.success) setMsList(r.data);
    } catch (e) { setMsList([]); }
    setMsModal(true);
  };

  const saveMs = async () => {
    if (!msForm.amount) { toast('Amount required', 'er'); return; }
    setMsSaving(true);
    try {
      if (msEditing) await updateManualSale(msEditing.id, { ...msForm, sale_date: msDate });
      else await addManualSale({ ...msForm, sale_date: msDate });
      const r = await getManualSales({ date: msDate });
      if (r.success) setMsList(r.data);
      setMsEditing(null);
      setMsForm({ amount: '', base_cost: '', note: '', source: 'Cash' });
      await load();
      toast('Manual sale saved ✓');
    } catch (e) { toast('Save failed', 'er'); }
    finally { setMsSaving(false); }
  };

  const deleteMs = async (id) => {
    if (!window.confirm('Delete this manual sale?')) return;
    await deleteManualSale(id);
    const r = await getManualSales({ date: msDate });
    if (r.success) setMsList(r.data);
    await load();
    toast('Deleted');
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink2)' }}>Loading P&L…</div>;
  if (!data)   return <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>Failed to load data.</div>;

  const { days, monthly, daily, averages, days_in_month } = data;
  const pastDays    = days.filter(d => d.is_past && d.has_sale);
  const futureDays  = days.filter(d => !d.is_past);
  const totalSale   = pastDays.reduce((s,d) => s + d.total_sale, 0);
  const totalCost   = pastDays.reduce((s,d) => s + d.base_cost, 0);
  const totalSal    = days.reduce((s,d) => s + d.salary, 0);
  const totalRent   = days.reduce((s,d) => s + d.rent, 0);
  const totalLight  = days.reduce((s,d) => s + d.light, 0);
  const totalExp    = pastDays.reduce((s,d) => s + d.expense, 0);
  const profitColor = (v) => v >= 0 ? '#1db97e' : '#e84a5f';
  const monthTotalProfit = totalSale - totalCost - totalSal - totalRent - totalLight - totalExp;
  const predSale    = futureDays.length * averages.sale;
  const predProfit  = futureDays.length * averages.profit;
  const projProfit  = monthTotalProfit + predProfit;
  const targetNum   = parseFloat(targetProfit) || 0;
  const avgCostRatio  = averages.sale > 0 ? averages.base_cost / averages.sale : 0.35;
  const avgExpRatio   = averages.sale > 0 ? averages.expense  / averages.sale : 0;
  const remainingFixedPerDay = (daily?.salary || 0) + (daily?.rent || 0) + (daily?.light || 0);
  const shortfall   = futureDays.length > 0 ? targetNum - monthTotalProfit : 0;
  const netMarginRatio = 1 - avgCostRatio - avgExpRatio;
  const requiredDailyProfit = futureDays.length > 0 ? shortfall / futureDays.length : 0;
  const requiredDailySale   = netMarginRatio > 0 ? (requiredDailyProfit + remainingFixedPerDay) / netMarginRatio : null;

  return (
    <div style={{ padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>📊 Daily Profit & Loss</h2>
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>{monthLabel(month)}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--ink)' }} />
          <button className="bsm be" onClick={() => openFcModal()}>⚙️ Fixed Costs</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Monthly Salary', val: monthly.salary, icon: '👥', color: '#1171ee' },
          { label: 'Monthly Rent',   val: monthly.rent,   icon: '🏠', color: '#b07a00' },
          { label: 'Monthly Light',  val: monthly.light,  icon: '💡', color: '#f0a500' },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, minWidth: 160, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{c.icon} {c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{fmtCur(c.val)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 2 }}>÷ {days_in_month} days = {fmtCur(c.val / days_in_month)}/day</div>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 160, background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => openFcModal()}>
          <div style={{ textAlign: 'center', color: 'var(--ink2)' }}>
            <div style={{ fontSize: 22 }}>⚙️</div>
            <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>Edit Fixed Costs</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total Sales',   val: totalSale,        icon: '💰', color: 'var(--accent)' },
          { label: 'Base Cost',     val: totalCost,        icon: '🧾', color: '#888' },
          { label: 'Misc Expenses', val: totalExp,         icon: '📤', color: '#b07a00' },
          { label: 'Month P&L',     val: monthTotalProfit, icon: '📈', color: profitColor(monthTotalProfit), bold: true },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, minWidth: 150, background: 'var(--surface)', border: `1.5px solid ${c.bold ? c.color + '44' : 'var(--border)'}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{c.icon} {c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{fmtCur(c.val)}</div>
          </div>
        ))}
      </div>

      {futureDays.length > 0 && (
        <div style={{ background: 'rgba(17,113,238,.06)', border: '1.5px solid rgba(17,113,238,.2)', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1171ee', textTransform: 'uppercase', marginBottom: 2 }}>🔮 Month-End Projection</div>
              <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Based on avg of {pastDays.length} days with sales · {futureDays.length} days remaining</div>
            </div>
            {averages.sale > 0 && (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Avg Daily Sale</div><div style={{ fontWeight: 800, color: 'var(--accent)' }}>{fmtCur(averages.sale)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Predicted Remaining</div><div style={{ fontWeight: 800, color: 'var(--accent)' }}>{fmtCur(predSale)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Projected Month Profit</div><div style={{ fontWeight: 800, fontSize: 16, color: profitColor(projProfit) }}>{projProfit >= 0 ? '+' : ''}{fmtCur(projProfit)}</div></div>
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(17,113,238,.15)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1171ee', textTransform: 'uppercase', marginBottom: 10 }}>🎯 Required Daily Sale to Hit Target Profit</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>Target Month Profit ₹</span>
                <input type="number" placeholder="e.g. 50000" value={targetProfit}
                  onChange={e => setTargetProfit(e.target.value)}
                  style={{ width: 130, padding: '8px 12px', borderRadius: 10, border: '1.5px solid rgba(17,113,238,.35)', fontSize: 14, fontWeight: 700, background: 'var(--bg)', color: 'var(--ink)' }} />
              </div>
              {targetNum > 0 && futureDays.length > 0 && (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(17,113,238,.1)', border: '1.5px solid rgba(17,113,238,.25)' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase' }}>Already Earned</div>
                    <div style={{ fontWeight: 800, color: profitColor(monthTotalProfit) }}>{monthTotalProfit >= 0 ? '+' : ''}{fmtCur(monthTotalProfit)}</div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink2)' }}>→</div>
                  <div style={{ padding: '8px 14px', borderRadius: 10, background: shortfall > 0 ? 'rgba(232,74,95,.08)' : 'rgba(29,185,126,.08)', border: `1.5px solid ${shortfall > 0 ? 'rgba(232,74,95,.3)' : 'rgba(29,185,126,.3)'}` }}>
                    <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase' }}>Still Need</div>
                    <div style={{ fontWeight: 800, color: shortfall > 0 ? '#e84a5f' : '#1db97e' }}>{fmtCur(Math.max(0, shortfall))}</div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink2)' }}>÷ {futureDays.length} days</div>
                  <div style={{ padding: '10px 18px', borderRadius: 10, background: requiredDailySale !== null && requiredDailySale <= averages.sale ? 'rgba(29,185,126,.1)' : 'rgba(232,74,95,.08)', border: `1.5px solid ${requiredDailySale !== null && requiredDailySale <= averages.sale ? 'rgba(29,185,126,.3)' : 'rgba(232,74,95,.3)'}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink2)' }}>Required Daily Sale</div>
                    <div style={{ fontWeight: 900, fontSize: 20, color: requiredDailySale !== null && requiredDailySale <= averages.sale ? '#1db97e' : '#e84a5f' }}>
                      {requiredDailySale !== null ? fmtCur(Math.max(0, requiredDailySale)) : '—'}
                    </div>
                    {requiredDailySale !== null && averages.sale > 0 && shortfall > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--ink2)', marginTop: 2 }}>
                        {requiredDailySale <= averages.sale ? `✅ Below avg ${fmtCur(averages.sale)}/day` : `⚠️ ${fmtCur(requiredDailySale - averages.sale)} above avg`}
                      </div>
                    )}
                    {shortfall <= 0 && <div style={{ fontSize: 10, color: '#1db97e', marginTop: 2 }}>🎉 Already achieved!</div>}
                  </div>
                </div>
              )}
              {targetNum <= 0 && <div style={{ fontSize: 12, color: 'var(--ink2)', fontStyle: 'italic' }}>Enter a target profit to see required daily sale</div>}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
          Daily Breakdown — {monthLabel(month)}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,.03)', fontSize: 11, color: 'var(--ink2)', fontWeight: 700 }}>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px 10px', textAlign: 'right' }}>
                  Sale
                  {targetNum > 0 && <div style={{ color: '#f0a500', fontSize: 9, fontWeight: 700 }}>🎯 target on future days</div>}
                </th>
                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Base Cost</th>
                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Staff Salary</th>
                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Rent</th>
                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Light</th>
                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Expenses</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>Profit / Loss</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => {
                const isPred  = !d.is_past;
                const isToday = d.is_today;
                const noSale  = d.is_past && !d.has_sale;
                const bg      = isToday ? 'rgba(232,87,42,.05)' : isPred ? 'rgba(17,113,238,.03)' : 'transparent';
                const displayCost = isPred ? 0 : d.base_cost;
                const displayExp  = isPred ? 0 : d.expense;
                const dispProfit  = isPred ? -(d.salary + d.rent + d.light) : d.profit;
                return (
                  <tr key={d.date} style={{ borderBottom: '1px solid var(--border)', background: bg, opacity: noSale ? 0.45 : 1 }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: isToday ? 800 : 600 }}>{dayLabel(d.date)}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink2)' }}>
                        {isToday ? '📍 Today' : isPred ? '🔮 Predicted' : noSale ? '— No Sales' : ''}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {isPred ? (
                        targetNum > 0 && requiredDailySale !== null
                          ? <div>
                              <div style={{ color: 'var(--border)', fontSize: 11 }}>—</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#f0a500' }}>🎯 {fmtCur(Math.max(0, requiredDailySale))}</div>
                            </div>
                          : <span style={{ color: 'var(--border)' }}>—</span>
                      ) : (
                        <div>
                          {d.system_sale > 0 && <div style={{ fontSize: 12, color: 'var(--ink)' }}>🖥️ {fmtCur(d.system_sale)}</div>}
                          {d.manual_sale > 0 && <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>✍️ {fmtCur(d.manual_sale)}</div>}
                          {d.system_sale > 0 && d.manual_sale > 0 && (
                            <div style={{ fontSize: 11, borderTop: '1px solid var(--border)', marginTop: 2, paddingTop: 2, color: 'var(--accent)', fontWeight: 800 }}>
                              = {fmtCur(d.total_sale)}
                            </div>
                          )}
                          {d.total_sale === 0 && <div style={{ color: 'var(--border)', fontSize: 12 }}>—</div>}
                          <button onClick={() => openMsModal(d.date)}
                            style={{ marginTop: 4, fontSize: 10, padding: '2px 7px', borderRadius: 6, border: '1px solid #7c3aed44', background: '#7c3aed11', color: '#7c3aed', cursor: 'pointer', fontWeight: 700, display: 'block', width: '100%' }}>
                            + Manual
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{displayCost > 0 ? fmtCur(displayCost) : <span style={{ color: 'var(--border)' }}>—</span>}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(d.salary)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(d.rent)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(d.light)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: '#b07a00' }}>{displayExp > 0 ? fmtCur(displayExp) : <span style={{ color: 'var(--border)' }}>—</span>}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: isPred ? 'var(--ink2)' : profitColor(dispProfit), opacity: isPred ? 0.4 : 1 }}>
                      {isPred ? fmtCur(dispProfit) : (dispProfit >= 0 ? '+' : '') + fmtCur(dispProfit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(0,0,0,.04)', fontWeight: 800, borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '12px 14px' }}>Month Total</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--accent)' }}>{fmtCur(totalSale)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{fmtCur(totalCost)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{fmtCur(totalSal)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{fmtCur(totalRent)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{fmtCur(totalLight)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{fmtCur(totalExp)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 16, color: profitColor(monthTotalProfit) }}>
                  {monthTotalProfit >= 0 ? '+' : ''}{fmtCur(monthTotalProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Modal show={fcModal} onClose={() => setFcModal(false)}
        title={fcEditing ? 'Edit Fixed Cost' : 'Add Fixed Cost'}
        subtitle={`Month: ${monthLabel(month)}`}
        footer={<>
          <button className="bsm" onClick={() => setFcModal(false)}>Cancel</button>
          <button className="bsm be" onClick={saveFc} disabled={fcSaving}>{fcSaving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.fixed_costs?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', marginBottom: 8, textTransform: 'uppercase' }}>Current for {monthLabel(month)}</div>
              {data.fixed_costs.map(fc => (
                <div key={fc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{fc.category === 'rent' ? '🏠' : '💡'} {fc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{fmtCur(fc.amount)} / month</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="bsm be" onClick={() => openFcModal(fc)}>✏️</button>
                    <button className="bsm bd" onClick={() => delFc(fc)}>🗑️</button>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase' }}>
                {fcEditing ? 'Edit Entry' : '+ Add New'}
              </div>
            </div>
          )}
          <div>
            <label className="mlabel">Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['rent','🏠 Rent'],['electricity','💡 Electricity']].map(([v,l]) => (
                <button key={v} type="button"
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    background: fcForm.category === v ? 'var(--accent)' : 'transparent',
                    color: fcForm.category === v ? '#fff' : 'var(--ink2)',
                    borderColor: fcForm.category === v ? 'var(--accent)' : 'var(--border)' }}
                  onClick={() => setFcForm(f => ({ ...f, category: v, name: v === 'rent' ? 'Rent' : 'Electricity' }))}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mlabel">Name</label>
            <input className="mfi" placeholder="e.g. Shop Rent" value={fcForm.name}
              onChange={e => setFcForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Monthly Amount (₹)</label>
            <input className="mfi" type="number" placeholder="e.g. 15000" value={fcForm.amount}
              onChange={e => setFcForm(f => ({ ...f, amount: e.target.value }))} />
            {fcForm.amount > 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>
                = {fmtCur(parseFloat(fcForm.amount) / daysInMonth(month))} per day
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal show={msModal} onClose={() => { setMsModal(false); setMsEditing(null); }}
        title={`✍️ Manual Sales — ${msDate}`}
        subtitle="Track sales not processed through this system"
        footer={<>
          <button className="bsm" onClick={() => { setMsModal(false); setMsEditing(null); }}>Close</button>
          <button className="bsm be" onClick={saveMs} disabled={msSaving}>{msSaving ? 'Saving…' : msEditing ? 'Update' : 'Add Sale'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msList.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', marginBottom: 8 }}>Entries for {msDate}</div>
              {msList.map(ms => (
                <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#7c3aed' }}>✍️ {fmtCur(ms.amount)}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink2)' }}>
                      {ms.source && <span style={{ marginRight: 6 }}>📍 {ms.source}</span>}
                      {ms.base_cost > 0 && <span style={{ marginRight: 6 }}>Cost: {fmtCur(ms.base_cost)}</span>}
                      {ms.note && <span>· {ms.note}</span>}
                    </div>
                  </div>
                  <button className="bsm be" style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => { setMsEditing(ms); setMsForm({ amount: ms.amount, base_cost: ms.base_cost || '', note: ms.note || '', source: ms.source || 'Cash' }); }}>✏️</button>
                  <button className="bsm bd" style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => deleteMs(ms.id)}>🗑️</button>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4, fontSize: 11, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase' }}>
                {msEditing ? 'Edit Entry' : '+ Add New Entry'}
              </div>
            </div>
          )}
          <div>
            <label className="mlabel">Sale Amount (₹) *</label>
            <input className="mfi" type="number" placeholder="e.g. 3500" value={msForm.amount}
              onChange={e => setMsForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Base Cost (₹) <span style={{ fontWeight: 400, color: 'var(--ink2)' }}>— optional</span></label>
            <input className="mfi" type="number" placeholder="e.g. 1200" value={msForm.base_cost}
              onChange={e => setMsForm(f => ({ ...f, base_cost: e.target.value }))} />
            {msForm.amount > 0 && msForm.base_cost > 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>
                Gross margin: {((1 - msForm.base_cost / msForm.amount) * 100).toFixed(1)}%
              </div>
            )}
          </div>
          <div>
            <label className="mlabel">Source</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Cash', 'UPI', 'Card', 'Zomato', 'Swiggy', 'Other'].map(s => (
                <button key={s} type="button" onClick={() => setMsForm(f => ({ ...f, source: s }))}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: msForm.source === s ? '#7c3aed' : 'transparent',
                    color: msForm.source === s ? '#fff' : 'var(--ink2)',
                    borderColor: msForm.source === s ? '#7c3aed' : 'var(--border)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mlabel">Note <span style={{ fontWeight: 400, color: 'var(--ink2)' }}>— optional</span></label>
            <input className="mfi" placeholder="e.g. Bulk order, catering…" value={msForm.note}
              onChange={e => setMsForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}