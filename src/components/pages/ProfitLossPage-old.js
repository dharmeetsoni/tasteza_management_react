import React, { useState, useEffect, useCallback } from 'react';
import { getDailyPnl, getFixedCosts, addFixedCost, updateFixedCost, deleteFixedCost } from '../../api';
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
  const [month, setMonth]       = useState(todayMonth);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);

  // Fixed cost modal
  const [fcModal, setFcModal]   = useState(false);
  const [fcEditing, setFcEditing] = useState(null);
  const [fcForm, setFcForm]     = useState({ name: '', amount: '', category: 'rent' });
  const [fcSaving, setFcSaving] = useState(false);

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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink2)' }}>Loading P&L…</div>;
  if (!data)   return <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>Failed to load data.</div>;

  const { days, monthly, daily, averages, days_in_month } = data;

  const pastDays   = days.filter(d => d.is_past && d.has_sale);
  const futureDays = days.filter(d => !d.is_past);
  const totalSale  = pastDays.reduce((s,d)=>s+d.total_sale, 0);
  const totalCost  = pastDays.reduce((s,d)=>s+d.base_cost, 0);
  // Fixed costs span the full month regardless of how many days have passed
  const totalSal   = days.reduce((s,d)=>s+d.salary, 0);
  const totalRent  = days.reduce((s,d)=>s+d.rent, 0);
  const totalLight = days.reduce((s,d)=>s+d.light, 0);
  const totalExp   = pastDays.reduce((s,d)=>s+d.expense, 0);
  const totalProfit= pastDays.reduce((s,d)=>s+d.profit, 0);

  // Projected month-end: actual profit so far - remaining fixed costs + predicted future sales profit
  // Full month P&L: actual sales minus full month fixed costs + actual misc expenses
  const monthTotalProfit = totalSale - totalCost - totalSal - totalRent - totalLight - totalExp;
  const predSale   = futureDays.length * averages.sale;
  const predProfit = futureDays.length * averages.profit;
  const projProfit = monthTotalProfit + predProfit;

  const profitColor = (v) => v >= 0 ? '#1db97e' : '#e84a5f';

  return (
    <div style={{ padding: '16px 16px 40px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>📊 Daily Profit & Loss</h2>
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>{monthLabel(month)}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--ink)' }} />
          <button className="bsm be" onClick={() => openFcModal()}>⚙️ Fixed Costs</button>
        </div>
      </div>

      {/* ── Fixed Costs Summary ── */}
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

      {/* ── Month Summary Cards ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total Sales',    val: totalSale,   icon: '💰', color: 'var(--accent)' },
          { label: 'Base Cost',      val: totalCost,   icon: '🧾', color: '#888' },
          { label: 'Total Expenses', val: totalExp,    icon: '📤', color: '#b07a00' },
          { label: 'Actual Profit',  val: totalProfit, icon: '📈', color: profitColor(totalProfit), bold: true },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, minWidth: 150, background: 'var(--surface)', border: `1.5px solid ${c.bold ? c.color + '44' : 'var(--border)'}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{c.icon} {c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{fmtCur(c.val)}</div>
          </div>
        ))}
      </div>

      {/* ── Projection ── */}
      {futureDays.length > 0 && averages.sale > 0 && (
        <div style={{ background: 'rgba(17,113,238,.06)', border: '1.5px solid rgba(17,113,238,.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1171ee', textTransform: 'uppercase', marginBottom: 2 }}>🔮 Month-End Projection</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Based on avg of {pastDays.length} days with sales · {futureDays.length} days remaining</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Predicted Sales</div><div style={{ fontWeight: 800, color: 'var(--accent)' }}>{fmtCur(predSale)}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Predicted Profit</div><div style={{ fontWeight: 800, color: profitColor(predProfit) }}>{fmtCur(predProfit)}</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--ink2)' }}>Projected Month Profit</div><div style={{ fontWeight: 800, fontSize: 16, color: profitColor(projProfit) }}>{fmtCur(projProfit)}</div></div>
          </div>
        </div>
      )}

      {/* ── Daily Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
          Daily Breakdown — {monthLabel(month)}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,.03)', fontSize: 11, color: 'var(--ink2)', fontWeight: 700 }}>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px 10px', textAlign: 'right' }}>Sale</th>
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
                const isPred = !d.is_past;
                const isToday = d.is_today;
                const noSale = d.is_past && !d.has_sale;
                const bg = isToday ? 'rgba(232,87,42,.05)' : isPred ? 'rgba(17,113,238,.03)' : 'transparent';
                // Future days: show actual 0 for sale/cost/expense, only fixed costs apply
                const displaySale = isPred ? 0 : d.total_sale;
                const displayCost = isPred ? 0 : d.base_cost;
                const displayExp  = isPred ? 0 : d.expense;
                // Future day profit = -(salary + rent + light) since no sale yet
                const dispProfit  = isPred
                  ? -(d.salary + d.rent + d.light)
                  : d.profit;

                return (
                  <tr key={d.date} style={{ borderBottom: '1px solid var(--border)', background: bg, opacity: noSale ? 0.45 : 1 }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: isToday ? 800 : 600 }}>{dayLabel(d.date)}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink2)' }}>
                        {isToday ? '📍 Today' : isPred ? '🔮 Predicted' : noSale ? '— No Sales' : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>
                      {displaySale > 0 ? fmtCur(displaySale) : <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(displayCost)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(d.salary)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(d.rent)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(d.light)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: '#b07a00' }}>{fmtCur(displayExp)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: isPred ? 'var(--ink2)' : profitColor(dispProfit), opacity: isPred ? 0.5 : 1 }}>
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

      {/* ── Fixed Costs Modal ── */}
      <Modal show={fcModal} onClose={() => setFcModal(false)}
        title={fcEditing ? 'Edit Fixed Cost' : 'Add Fixed Cost'}
        subtitle={`Month: ${monthLabel(month)}`}
        footer={<>
          <button className="bsm" onClick={() => setFcModal(false)}>Cancel</button>
          <button className="bsm be" onClick={saveFc} disabled={fcSaving}>{fcSaving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Existing fixed costs list */}
          {data.fixed_costs?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', marginBottom: 8, textTransform: 'uppercase' }}>Current Fixed Costs for {monthLabel(month)}</div>
              {data.fixed_costs.map(fc => (
                <div key={fc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{fc.category === 'rent' ? '🏠' : '💡'} {fc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{fmtCur(fc.amount)} / month · {fmtCur(fc.amount / daysInMonth(month))}/day</div>
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
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1.5px solid', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .13s',
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
                = {fmtCur(parseFloat(fcForm.amount) / daysInMonth(month))} per day ({daysInMonth(month)} days in {monthLabel(month)})
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
