import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getSalesReport, getItemsReport, getPnLReport, getCustomersReport,
  getPaymentsReport, getDiscountsReport, getSalaryReport,
  getFixedCosts, addFixedCost, updateFixedCost, deleteFixedCost, resetAllData,
  getInventorySummary, getInventoryMovements, getInventoryConsumption,
  getOrdersList, getOrder,
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

// ─── Excel Export ─────────────────────────────────────────────
function exportToExcel(rows, filename, sheetName = 'Report') {
  if (!rows || !rows.length) { alert('No data to export'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h] ?? '';
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    }).join(','))
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
}

// ─── Helpers ──────────────────────────────────────────────────
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function curMonth() { return localDate().slice(0, 7); }
function monthStart(m) { return `${m}-01`; }
function monthEnd(m) {
  const [y, mo] = m.split('-').map(Number);
  return `${m}-${new Date(y, mo, 0).getDate()}`;
}
function fmtDate(d) {
  if (!d) return '—';
  // Parse "YYYY-MM-DD" manually to avoid UTC→local shift
  const s = String(d).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split('-');
    return `${parseInt(day)}/${parseInt(m)}/${y}`;
  }
  // Fallback for full datetime strings (already local from MySQL)
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()}`;
}
function fmtNum(n, dec = 2) { return parseFloat(n || 0).toFixed(dec); }
const PC_COLORS = ['#e84a5f', '#118ab2', '#1db97e', '#b07a00', '#8b5cf6', '#f59e0b'];

function PnLRow({ label, value, sub, bold, indent, positive, negative, separator }) {
  if (separator) return <tr><td colSpan={2} style={{ padding: '4px 0', borderBottom: '2px solid var(--border)' }} /></tr>;
  const color = positive ? '#1db97e' : negative ? '#e84a5f' : 'inherit';
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '10px 16px', paddingLeft: indent ? 32 : 16, fontSize: 13, color: sub ? 'var(--ink2)' : 'var(--ink)', fontWeight: bold ? 800 : 400 }}>{label}</td>
      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: bold ? 800 : 600, fontSize: bold ? 15 : 13, color }}>{fmtCur(value)}</td>
    </tr>
  );
}

function ExportBtn({ onClick }) {
  return (
    <button onClick={onClick} className="btn-c" style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
      📥 Export CSV
    </button>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────
const TABS = [
  { id: 'pnl',       icon: '📊', label: 'Profit & Loss'    },
  { id: 'sales',     icon: '🧾', label: 'Sales Report'     },
  { id: 'items',     icon: '🍽️', label: 'Item-wise Sales'  },
  { id: 'payments',  icon: '💳', label: 'Payments'         },
  { id: 'discounts', icon: '🎟️', label: 'Discounts'        },
  { id: 'customers', icon: '👥', label: 'Customers'        },
  { id: 'salary',    icon: '💰', label: 'Salary Report'    },
  { id: 'costs',     icon: '🏠', label: 'Fixed Costs'      },
  { id: 'inventory', icon: '📦', label: 'Inventory'         },
];

const COST_CATS = [
  { id: 'rent',        label: 'Rent',        icon: '🏠' },
  { id: 'electricity', label: 'Electricity', icon: '💡' },
  { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { id: 'staff',       label: 'Staff',       icon: '👥' },
  { id: 'marketing',   label: 'Marketing',   icon: '📣' },
  { id: 'other',       label: 'Other',       icon: '📦' },
];

export default function ReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('pnl');
  const [month, setMonth] = useState(curMonth());
  const [from, setFrom] = useState(monthStart(curMonth()));
  const [to, setTo] = useState(monthEnd(curMonth()));
  const [groupBy, setGroupBy] = useState('day');
  const [loading, setLoading] = useState(false);

  // Report data
  const [salesData,    setSalesData]    = useState([]);
  const [itemsData,    setItemsData]    = useState([]);
  const [pnlData,      setPnlData]      = useState(null);
  const [custData,     setCustData]     = useState([]);
  const [payData,      setPayData]      = useState([]);
  const [discData,     setDiscData]     = useState([]);
  const [salaryData,   setSalaryData]   = useState([]);
  const [costsData,    setCostsData]    = useState([]);
  const [invSummary,   setInvSummary]   = useState(null);
  const [invMovements, setInvMovements] = useState([]);
  const [invConsumption,setInvConsumption] = useState([]);
  const [ordersData,   setOrdersData]   = useState([]); // for single-day order list
  const [invMovType,   setInvMovType]   = useState('');
  const [rptViewOrder, setRptViewOrder] = useState(null);
  const [rptViewItems, setRptViewItems] = useState([]);
  const [rptViewLoad,  setRptViewLoad]  = useState(false);

  // Fixed cost modals
  const [costModal, setCostModal]     = useState(false);
  const [costForm,  setCostForm]      = useState({ name: '', amount: '', category: 'rent', month: curMonth(), description: '' });
  const [editCost,  setEditCost]      = useState(null);
  const [delCost,   setDelCost]       = useState(null);
  const [resetModal, setResetModal]   = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetSel, setResetSel]       = useState({});

  // Customers filter
  const [custSearch, setCustSearch] = useState('');

  // ── Load based on active tab ──────────────────────────
  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'pnl') {
        const d = await getPnLReport({ month });
        if (d.success) setPnlData(d.data);
      } else if (tab === 'sales') {
        const [d, od] = await Promise.all([
          getSalesReport({ from, to, group_by: groupBy }),
          getOrdersList({ from, to, status: 'paid' }),
        ]);
        if (d.success)  setSalesData(d.data);
        if (od.success) setOrdersData(od.data);
      } else if (tab === 'items') {
        const d = await getItemsReport({ from, to });
        if (d.success) setItemsData(d.data);
      } else if (tab === 'customers') {
        const d = await getCustomersReport({ from, to });
        if (d.success) setCustData(d.data);
      } else if (tab === 'payments') {
        const d = await getPaymentsReport({ from, to });
        if (d.success) setPayData(d.data);
      } else if (tab === 'discounts') {
        const d = await getDiscountsReport({ from, to });
        if (d.success) setDiscData(d.data);
      } else if (tab === 'salary') {
        const d = await getSalaryReport({ month });
        if (d.success) setSalaryData(d.data);
      } else if (tab === 'costs') {
        const d = await getFixedCosts({ month });
        if (d.success) setCostsData(d.data);
      } else if (tab === 'inventory') {
        const [s, m, con] = await Promise.all([
          getInventorySummary(),
          getInventoryMovements({ from, to, ...(invMovType ? { movement_type: invMovType } : {}) }),
          getInventoryConsumption({ from, to }),
        ]);
        if (s.success)   setInvSummary(s.data);
        if (m.success)   setInvMovements(m.data);
        if (con.success) setInvConsumption(con.data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab, month, from, to, groupBy, invMovType]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  // Sync month→from/to when on month-based tabs
  useEffect(() => {
    if (['pnl', 'salary', 'costs'].includes(tab)) {
      setFrom(monthStart(month));
      setTo(monthEnd(month));
    }
  }, [month, tab]);

  // ── Fixed Costs CRUD ──────────────────────────────────
  const openAddCost = () => {
    setCostForm({ name: '', amount: '', category: 'rent', month, description: '' });
    setEditCost(null);
    setCostModal(true);
  };

  const openEditCost = (c) => {
    setCostForm({ name: c.name, amount: c.amount, category: c.category, month: c.month, description: c.description || '' });
    setEditCost(c);
    setCostModal(true);
  };

  const saveCost = async () => {
    if (!costForm.name || !costForm.amount) { toast('Name and amount required', 'er'); return; }
    try {
      const d = editCost
        ? await updateFixedCost(editCost.id, costForm)
        : await addFixedCost(costForm);
      if (d.success) {
        toast(editCost ? 'Updated ✅' : 'Added ✅', 'ok');
        setCostModal(false);
        loadReport();
      } else toast(d.message, 'er');
    } catch { toast('Error', 'er'); }
  };

  const doDelCost = async () => {
    try {
      const d = await deleteFixedCost(delCost.id);
      if (d.success) { toast('Deleted', 'ok'); setDelCost(null); loadReport(); }
    } catch { toast('Error', 'er'); }
  };

  // ── Stats Summary ─────────────────────────────────────
  const salesTotal = useMemo(() => salesData.reduce((s, r) => ({
    orders: s.orders + parseInt(r.total_orders || 0),
    revenue: s.revenue + parseFloat(r.total_amount || 0),
    discounts: s.discounts + parseFloat(r.discount_amount || 0),
    gst: s.gst + parseFloat(r.gst_amount || 0),
  }), { orders: 0, revenue: 0, discounts: 0, gst: 0 }), [salesData]);

  const custFiltered = useMemo(() =>
    custData.filter(c => !custSearch || (c.customer_name || '').toLowerCase().includes(custSearch.toLowerCase()) || (c.customer_phone || '').includes(custSearch)),
    [custData, custSearch]);

  const costsTotal = useMemo(() => costsData.reduce((s, c) => s + parseFloat(c.amount || 0), 0), [costsData]);
  const costsByCat = useMemo(() => {
    const m = {};
    costsData.forEach(c => { m[c.category] = (m[c.category] || 0) + parseFloat(c.amount); });
    return m;
  }, [costsData]);

  // ── Date filter bar ───────────────────────────────────
  const isPnLTab = ['pnl', 'salary', 'costs'].includes(tab);

  const FilterBar = () => (
    <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      {isPnLTab ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }}>Month:</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }}>From:</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }}>To:</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }} />
          </div>
          {tab === 'sales' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {[['day','Daily'],['month','Monthly']].map(([v,l]) => (
                <button key={v} type="button" onClick={() => setGroupBy(v)}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                    background: groupBy === v ? 'var(--accent)' : 'transparent',
                    color: groupBy === v ? '#fff' : 'var(--ink2)',
                    borderColor: groupBy === v ? 'var(--accent)' : 'var(--border)' }}>{l}</button>
              ))}
            </div>
          )}
          {/* Quick range presets */}
          <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
            {[
              { l: 'Today',     fn: () => { const t = localDate(); setFrom(t); setTo(t); } },
              { l: 'This Week', fn: () => { const d = new Date(); const mon = new Date(d.setDate(d.getDate()-d.getDay()+1)); const monStr = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`; setFrom(monStr); setTo(localDate()); } },
              { l: 'This Month',fn: () => { setFrom(monthStart(curMonth())); setTo(monthEnd(curMonth())); } },
              { l: 'Last Month', fn: () => { const d=new Date(); d.setMonth(d.getMonth()-1); const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; setFrom(monthStart(m)); setTo(monthEnd(m)); } },
            ].map(({ l, fn }) => (
              <button key={l} type="button" onClick={fn}
                style={{ padding: '5px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--ink2)', transition: 'all .1s' }}>{l}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="ph">
        <div className="ph-left">
          <div className="pt">📊 Reports</div>
          <div className="ps">Sales, Profit & Loss, Staff Salary, Customers, Costs and more</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid var(--border)', marginBottom: 20, gap: 0 }}>
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{ padding: '11px 18px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: tab === t.id ? 'rgba(232,87,42,.06)' : 'transparent',
              borderBottom: tab === t.id ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: -2, color: tab === t.id ? 'var(--accent)' : 'var(--ink2)', fontWeight: 700, fontSize: 13, transition: 'all .13s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <FilterBar />

      {loading && <div className="loading-wrap">Loading report…</div>}

      {/* ══════════════════════════════════════════════
          PROFIT & LOSS
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'pnl' && pnlData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* P&L Statement */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>📊 Profit & Loss — {pnlData.period}</div>
              <ExportBtn onClick={() => exportToExcel([
                { Item: 'Gross Sales',     Amount: pnlData.sales.gross_sales },
                { Item: 'GST Collected',   Amount: pnlData.sales.gst },
                { Item: 'Discounts Given', Amount: pnlData.sales.discounts },
                { Item: 'Net Revenue',     Amount: pnlData.sales.net_revenue },
                { Item: 'COGS',            Amount: pnlData.cogs },
                { Item: 'Gross Profit',    Amount: pnlData.gross_profit },
                { Item: 'Rent+Fixed',      Amount: pnlData.expenses.fixed },
                { Item: 'Salary',          Amount: pnlData.expenses.salary },
                { Item: 'Fuel',            Amount: pnlData.expenses.fuel },
                { Item: 'Total Expenses',  Amount: pnlData.expenses.total },
                { Item: 'NET PROFIT',      Amount: pnlData.net_profit },
              ], `PnL_${pnlData.period}`)} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <PnLRow label="REVENUE" bold />
                <PnLRow label="Gross Sales" value={pnlData.sales.gross_sales} indent />
                <PnLRow label="(–) Discounts Given" value={-pnlData.sales.discounts} indent negative={pnlData.sales.discounts > 0} />
                <PnLRow label="GST Collected" value={pnlData.sales.gst} indent sub />
                <PnLRow label="Net Revenue" value={pnlData.sales.net_revenue} bold positive />
                <PnLRow separator />
                <PnLRow label="COST OF GOODS SOLD" bold />
                <PnLRow label="Ingredients / COGS" value={pnlData.cogs} indent negative />
                <PnLRow separator />
                <PnLRow label="GROSS PROFIT" value={pnlData.gross_profit} bold positive={pnlData.gross_profit >= 0} negative={pnlData.gross_profit < 0} />
                <tr><td colSpan={2} style={{ padding: '2px 0' }}><div style={{ margin: '0 16px', fontSize: 11, color: 'var(--ink2)', textAlign: 'right' }}>Gross Margin: {fmtNum(pnlData.gross_margin, 1)}%</div></td></tr>
                <PnLRow separator />
                <PnLRow label="OPERATING EXPENSES" bold />
                <PnLRow label="Fixed Costs (Rent, Electricity etc.)" value={pnlData.expenses.fixed} indent negative />
                <PnLRow label="Staff Salaries" value={pnlData.expenses.salary} indent negative />
                <PnLRow label="Fuel & Transport" value={pnlData.expenses.fuel} indent negative />
                <PnLRow label="Total Expenses" value={pnlData.expenses.total} bold negative />
                <PnLRow separator />
              </tbody>
            </table>
            <div style={{ padding: '20px 16px', background: pnlData.net_profit >= 0 ? 'rgba(29,185,126,.06)' : 'rgba(232,74,95,.06)', margin: 12, borderRadius: 12, border: `2px solid ${pnlData.net_profit >= 0 ? '#1db97e' : '#e84a5f'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>NET {pnlData.net_profit >= 0 ? 'PROFIT' : 'LOSS'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>Net Margin: {fmtNum(pnlData.net_margin, 1)}%</div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: pnlData.net_profit >= 0 ? '#1db97e' : '#e84a5f' }}>{fmtCur(pnlData.net_profit)}</div>
              </div>
            </div>
          </div>

          {/* Right side: breakdown cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { l: 'Total Orders',   v: pnlData.sales.orders_count,          color: 'var(--ink)' },
                { l: 'Avg Order Value',v: fmtCur(pnlData.sales.net_revenue / (pnlData.sales.orders_count || 1)), color: '#118ab2' },
                { l: 'Gross Margin',   v: `${fmtNum(pnlData.gross_margin, 1)}%`, color: '#1db97e' },
                { l: 'Net Margin',     v: `${fmtNum(pnlData.net_margin, 1)}%`,   color: pnlData.net_margin >= 0 ? '#1db97e' : '#e84a5f' },
              ].map(({ l, v, color }) => (
                <div key={l} style={{ padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Fixed costs breakdown */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>🏠 Fixed Costs Breakdown</div>
              {pnlData.expenses.fixed_list.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink2)', fontSize: 13 }}>No fixed costs recorded for {month}</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {pnlData.expenses.fixed_list.map(c => {
                      const cat = COST_CATS.find(x => x.id === c.category);
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '9px 14px' }}>{cat?.icon} {c.name}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#e84a5f' }}>{fmtCur(c.amount)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'rgba(232,74,95,.05)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800 }}>Total</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#e84a5f', fontSize: 15 }}>{fmtCur(pnlData.expenses.fixed)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SALES REPORT
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'sales' && (
        <div>
          <div className="stats-row">
            {[
              { l: 'Total Orders',    v: salesTotal.orders,              c: 'var(--ink)' },
              { l: 'Total Revenue',   v: fmtCur(salesTotal.revenue),     c: '#1db97e'    },
              { l: 'Total Discounts', v: fmtCur(salesTotal.discounts),   c: '#e84a5f'    },
              { l: 'GST Collected',   v: fmtCur(salesTotal.gst),         c: '#118ab2'    },
            ].map(({ l, v, c }) => (
              <div key={l} className="scard"><div className="scard-text"><div className="sv small" style={{ color: c }}>{v}</div><div className="sl">{l}</div></div></div>
            ))}
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="ch">
              <div className="ct">Sales Report ({groupBy === 'day' ? 'Daily' : 'Monthly'})</div>
              <ExportBtn onClick={() => exportToExcel(salesData.map(r => ({
                Period: r.period, Orders: r.total_orders, Revenue: fmtNum(r.total_amount),
                Discounts: fmtNum(r.discount_amount), GST: fmtNum(r.gst_amount),
                Cash: fmtNum(r.cash_total), Card: fmtNum(r.card_total), UPI: fmtNum(r.upi_total),
                DineIn: r.dine_in_count, Parcel: r.parcel_count
              })), `Sales_${from}_${to}`)} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th>{groupBy === 'day' ? 'Date' : 'Month'}</th>
                  <th style={{ textAlign: 'center' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Discounts</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th style={{ textAlign: 'center' }}>Cash</th>
                  <th style={{ textAlign: 'center' }}>Card</th>
                  <th style={{ textAlign: 'center' }}>UPI</th>
                  <th style={{ textAlign: 'center' }}>Dine-In</th>
                  <th style={{ textAlign: 'center' }}>Parcel</th>
                </tr></thead>
                <tbody>
                  {salesData.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{r.period}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.total_orders}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#1db97e' }}>{fmtCur(r.total_amount)}</td>
                      <td style={{ textAlign: 'right', color: r.discount_amount > 0 ? '#e84a5f' : 'var(--ink2)' }}>{fmtCur(r.discount_amount)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(r.gst_amount)}</td>
                      <td style={{ textAlign: 'center' }}>{fmtCur(r.cash_total)}</td>
                      <td style={{ textAlign: 'center' }}>{fmtCur(r.card_total)}</td>
                      <td style={{ textAlign: 'center' }}>{fmtCur(r.upi_total)}</td>
                      <td style={{ textAlign: 'center' }}>{r.dine_in_count}</td>
                      <td style={{ textAlign: 'center' }}>{r.parcel_count}</td>
                    </tr>
                  ))}
                  {salesData.length === 0 && <tr><td colSpan={10}><div className="empty" style={{ padding: 40 }}><div className="ei">🧾</div><p>No sales data for this period</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ── All Orders for selected period ── */}
      {!loading && tab === 'sales' && (
        <div className="card" style={{ padding: 0, marginTop: 20 }}>
          <div className="ch">
            <div className="ct">📋 Individual Orders</div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ fontSize:12, color:'var(--ink2)' }}>{ordersData.length} paid orders</span>
              <ExportBtn onClick={() => exportToExcel(ordersData.map(o => ({
                'Order #': o.order_number,
                Date: (o.paid_at||o.created_at)?.slice(0,10),
                Time: o.paid_at ? new Date(o.paid_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '',
                Type: o.order_type,
                Table: o.table_number||'',
                Customer: o.customer_name||'',
                Phone: o.customer_phone||'',
                Subtotal: parseFloat(o.subtotal||0),
                Discount: parseFloat(o.discount_amount||0),
                GST: parseFloat(o.gst_amount||0),
                Total: parseFloat(o.total_amount||0),
                Payment: o.payment_method||'',
              })), `Orders_${from}_${to}`)} />
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead><tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Time</th>
                <th>Type</th>
                <th>Table</th>
                <th>Customer</th>
                <th style={{ textAlign:'right' }}>Subtotal</th>
                <th style={{ textAlign:'right' }}>Discount</th>
                <th style={{ textAlign:'right' }}>GST</th>
                <th style={{ textAlign:'right' }}>Total</th>
                <th>Payment</th>
                <th style={{ textAlign:'center' }}>Details</th>
              </tr></thead>
              <tbody>
                {ordersData.length === 0 && (
                  <tr><td colSpan={12}>
                    <div className="empty" style={{ padding:40 }}>
                      <div className="ei">🧾</div><p>No paid orders for this period</p>
                    </div>
                  </td></tr>
                )}
                {ordersData.map((o, i) => {
                  const payColor = o.payment_method==='upi' ? '#1db97e' : o.payment_method==='card' ? '#118ab2' : '#b07a00';
                  const payBg    = o.payment_method==='upi' ? 'rgba(29,185,126,.12)' : o.payment_method==='card' ? 'rgba(17,138,178,.12)' : 'rgba(244,165,53,.14)';
                  return (
                    <tr key={i} style={{ cursor:'pointer' }} onClick={async () => {
                      setRptViewOrder(o);
                      setRptViewItems([]);
                      setRptViewLoad(true);
                      try {
                        const d = await getOrder(o.id);
                        if (d.success) setRptViewItems(d.data.items || []);
                      } catch {}
                      finally { setRptViewLoad(false); }
                    }}>
                      <td style={{ fontWeight:800, color:'var(--accent)', fontSize:12 }}>{o.order_number}</td>
                      <td style={{ fontSize:12, fontWeight:600 }}>
                        {(o.paid_at||o.created_at)?.slice(0,10) || '—'}
                      </td>
                      <td style={{ fontSize:12, color:'var(--ink2)' }}>
                        {o.paid_at ? new Date(o.paid_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:12, background:'rgba(26,26,46,.07)', fontWeight:600 }}>
                          {o.order_type==='dine_in'?'🪑 Dine-In':o.order_type==='parcel'?'📦 Parcel':'🥡 Takeaway'}
                        </span>
                      </td>
                      <td style={{ fontSize:12 }}>{o.table_number || '—'}</td>
                      <td>
                        <div style={{ fontWeight:600, fontSize:13 }}>{o.customer_name || '—'}</div>
                        {o.customer_phone && <div style={{ fontSize:11, color:'var(--ink2)' }}>{o.customer_phone}</div>}
                      </td>
                      <td style={{ textAlign:'right', fontSize:13 }}>{fmtCur(o.subtotal)}</td>
                      <td style={{ textAlign:'right', fontSize:13, color: parseFloat(o.discount_amount)>0?'#e84a5f':'var(--ink2)' }}>
                        {parseFloat(o.discount_amount)>0 ? `−${fmtCur(o.discount_amount)}` : '—'}
                      </td>
                      <td style={{ textAlign:'right', fontSize:12, color:'var(--ink2)' }}>
                        {parseFloat(o.gst_amount)>0 ? fmtCur(o.gst_amount) : '—'}
                      </td>
                      <td style={{ textAlign:'right', fontWeight:800, color:'#1db97e', fontSize:14 }}>{fmtCur(o.total_amount)}</td>
                      <td>
                        <span style={{ fontSize:11, padding:'3px 9px', borderRadius:12, fontWeight:700, background:payBg, color:payColor }}>
                          {o.payment_method==='cash'?'💵':o.payment_method==='upi'?'📱':o.payment_method==='card'?'💳':'🔄'} {o.payment_method?.toUpperCase()||'—'}
                        </span>
                      </td>
                      <td style={{ textAlign:'center' }} onClick={e => e.stopPropagation()}>
                        <button className="bsm" onClick={async () => {
                          setRptViewOrder(o);
                          setRptViewItems([]);
                          setRptViewLoad(true);
                          try { const d = await getOrder(o.id); if (d.success) setRptViewItems(d.data.items||[]); } catch {}
                          finally { setRptViewLoad(false); }
                        }} style={{ background:'rgba(17,138,178,.1)', color:'#118ab2', border:'1.5px solid #118ab2' }}>
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Order Detail Modal (Reports - view only) ── */}
      <Modal show={!!rptViewOrder} onClose={() => setRptViewOrder(null)}
        title={rptViewOrder?.order_number || 'Order Details'}
        subtitle={`${(rptViewOrder?.paid_at||rptViewOrder?.created_at)?.slice(0,10) || ''} · ${rptViewOrder?.order_type?.replace('_',' ') || ''}`}
        wide
        footer={<button className="btn-c" onClick={() => setRptViewOrder(null)}>Close</button>}>
        {rptViewOrder && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
              {[
                ['Payment',   <span style={{fontWeight:700}}>{rptViewOrder.payment_method==='cash'?'💵':rptViewOrder.payment_method==='upi'?'📱':rptViewOrder.payment_method==='card'?'💳':'🔄'} {rptViewOrder.payment_method?.toUpperCase()||'—'}</span>],
                ['Type',      rptViewOrder.order_type?.replace('_',' ')],
                ['Table',     rptViewOrder.table_number||'—'],
                ['Customer',  rptViewOrder.customer_name||'—'],
                ['Phone',     rptViewOrder.customer_phone||'—'],
                ['Date/Time', rptViewOrder.paid_at ? new Date(rptViewOrder.paid_at).toLocaleString('en-IN') : '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ background:'var(--bg)', borderRadius:10, padding:'10px 14px' }}>
                  <div style={{ fontSize:10, color:'var(--ink2)', fontWeight:700, marginBottom:4 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{val}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontWeight:800, fontSize:13, marginBottom:8 }}>🍽️ Items</div>
              {rptViewLoad
                ? <div style={{ color:'var(--ink2)', padding:10 }}>Loading…</div>
                : (
                  <table style={{ width:'100%' }}>
                    <thead><tr>
                      <th>Item</th>
                      <th style={{ textAlign:'center' }}>Qty</th>
                      <th style={{ textAlign:'right' }}>Unit Price</th>
                      <th style={{ textAlign:'right' }}>GST</th>
                      <th style={{ textAlign:'right' }}>Total</th>
                    </tr></thead>
                    <tbody>
                      {rptViewItems.map((item, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{item.item_name}</td>
                          <td style={{ textAlign:'center' }}>{item.quantity}</td>
                          <td style={{ textAlign:'right' }}>{fmtCur(item.unit_price)}</td>
                          <td style={{ textAlign:'right', color:'var(--ink2)', fontSize:12 }}>{item.gst_percent>0?`${item.gst_percent}%`:'—'}</td>
                          <td style={{ textAlign:'right', fontWeight:700 }}>{fmtCur(item.total_price)}</td>
                        </tr>
                      ))}
                      {rptViewItems.length === 0 && <tr><td colSpan={5} style={{ color:'var(--ink2)', padding:12 }}>No items</td></tr>}
                    </tbody>
                  </table>
                )
              }
            </div>

            <div style={{ background:'var(--bg)', borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span>Subtotal</span><span>{fmtCur(rptViewOrder.subtotal)}</span>
              </div>
              {parseFloat(rptViewOrder.gst_amount)>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--ink2)' }}>
                  <span>GST</span><span>{fmtCur(rptViewOrder.gst_amount)}</span>
                </div>
              )}
              {parseFloat(rptViewOrder.discount_amount)>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#1db97e' }}>
                  <span>Discount {rptViewOrder.coupon_code?`(${rptViewOrder.coupon_code})`:''}</span>
                  <span>−{fmtCur(rptViewOrder.discount_amount)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:16, borderTop:'1.5px solid var(--border)', paddingTop:8, marginTop:4 }}>
                <span>Total</span><span style={{ color:'#1db97e' }}>{fmtCur(rptViewOrder.total_amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

            {/* ══════════════════════════════════════════════
          ITEM-WISE SALES
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'items' && (
        <div>
          <div className="stats-row">
            <div className="scard"><div className="scard-text"><div className="sv">{itemsData.length}</div><div className="sl">Unique Items Sold</div></div></div>
            <div className="scard accent-card"><div className="scard-text"><div className="sv small">{fmtCur(itemsData.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0))}</div><div className="sl">Total Revenue</div></div></div>
            <div className="scard"><div className="scard-text"><div className="sv">{itemsData.reduce((s, r) => s + parseInt(r.total_qty || 0), 0)}</div><div className="sl">Total Qty Sold</div></div></div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="ch">
              <div className="ct">Item-wise Sales</div>
              <ExportBtn onClick={() => exportToExcel(itemsData.map(r => ({
                Item: r.item_name, Category: r.course_name, Qty: r.total_qty,
                AvgPrice: fmtNum(r.avg_price), Revenue: fmtNum(r.total_revenue),
                CostPrice: fmtNum(r.cost_price), EstProfit: fmtNum(r.total_revenue - (r.cost_price || r.avg_price * 0.35) * r.total_qty)
              })), `Items_${from}_${to}`)} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th>#</th><th>Item Name</th><th>Category</th>
                  <th style={{ textAlign: 'center' }}>Qty Sold</th>
                  <th style={{ textAlign: 'right' }}>Avg Price</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue</th>
                  <th style={{ textAlign: 'right' }}>Cost Price</th>
                  <th style={{ textAlign: 'right' }}>Est. Profit</th>
                </tr></thead>
                <tbody>
                  {itemsData.map((r, i) => {
                    const profit = parseFloat(r.total_revenue) - (parseFloat(r.cost_price) || parseFloat(r.avg_price) * 0.35) * parseInt(r.total_qty);
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--ink2)', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ fontWeight: 700 }}>
                          <span style={{ marginRight: 6 }}>{r.is_veg ? '🟢' : '🔴'}</span>{r.item_name}
                        </td>
                        <td style={{ color: 'var(--ink2)' }}>{r.course_name || '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{r.total_qty}</td>
                        <td style={{ textAlign: 'right' }}>{fmtCur(r.avg_price)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#1db97e' }}>{fmtCur(r.total_revenue)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--ink2)' }}>{r.cost_price ? fmtCur(r.cost_price) : <span style={{ fontSize: 11, color: '#b07a00' }}>est.</span>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: profit >= 0 ? '#1db97e' : '#e84a5f' }}>{fmtCur(profit)}</td>
                      </tr>
                    );
                  })}
                  {itemsData.length === 0 && <tr><td colSpan={8}><div className="empty" style={{ padding: 40 }}><div className="ei">🍽️</div><p>No item sales data</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          PAYMENTS
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'payments' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 20 }}>
            {payData.map((p, i) => {
              const total = payData.reduce((s, x) => s + parseFloat(x.total || 0), 0);
              const pct = total > 0 ? ((parseFloat(p.total) / total) * 100).toFixed(1) : 0;
              return (
                <div key={i} className="card" style={{ padding: '20px', borderTop: `3px solid ${PC_COLORS[i % PC_COLORS.length]}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>
                    {{ cash: '💵', card: '💳', upi: '📱', other: '💰' }[p.payment_method] || '💰'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', marginBottom: 4 }}>{p.payment_method}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: PC_COLORS[i % PC_COLORS.length] }}>{fmtCur(p.total)}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{p.count} orders · {pct}%</div>
                  <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: PC_COLORS[i % PC_COLORS.length], borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <ExportBtn onClick={() => exportToExcel(payData.map(p => ({ Method: p.payment_method, Orders: p.count, Total: fmtNum(p.total) })), `Payments_${from}_${to}`)} />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DISCOUNTS
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'discounts' && (
        <div>
          <div className="stats-row">
            <div className="scard"><div className="scard-text"><div className="sv">{discData.length}</div><div className="sl">Discount Types</div></div></div>
            <div className="scard" style={{ borderTop: '3px solid #e84a5f' }}><div className="scard-text"><div className="sv small" style={{ color: '#e84a5f' }}>{fmtCur(discData.reduce((s, r) => s + parseFloat(r.total_discount || 0), 0))}</div><div className="sl">Total Discounts</div></div></div>
            <div className="scard"><div className="scard-text"><div className="sv">{discData.reduce((s, r) => s + parseInt(r.count || 0), 0)}</div><div className="sl">Discounted Orders</div></div></div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="ch">
              <div className="ct">Discount & Coupon Analysis</div>
              <ExportBtn onClick={() => exportToExcel(discData.map(r => ({
                Type: r.discount_type, Coupon: r.coupon_code || '—',
                Count: r.count, TotalDiscount: fmtNum(r.total_discount),
                AvgDiscount: fmtNum(r.avg_discount), Revenue: fmtNum(r.total_revenue)
              })), `Discounts_${from}_${to}`)} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th>Type</th><th>Coupon Code</th>
                  <th style={{ textAlign: 'center' }}>Used</th>
                  <th style={{ textAlign: 'right' }}>Total Discount Given</th>
                  <th style={{ textAlign: 'right' }}>Avg Discount</th>
                  <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                </tr></thead>
                <tbody>
                  {discData.map((r, i) => (
                    <tr key={i}>
                      <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{r.discount_type}</td>
                      <td>{r.coupon_code ? <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(232,87,42,.1)', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{r.coupon_code}</span> : '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.count}</td>
                      <td style={{ textAlign: 'right', color: '#e84a5f', fontWeight: 700 }}>{fmtCur(r.total_discount)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCur(r.avg_discount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#1db97e' }}>{fmtCur(r.total_revenue)}</td>
                    </tr>
                  ))}
                  {discData.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ padding: 40 }}><div className="ei">🎟️</div><p>No discount data</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          CUSTOMERS
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'customers' && (
        <div>
          <div className="stats-row">
            <div className="scard"><div className="scard-text"><div className="sv">{custData.length}</div><div className="sl">Unique Customers</div></div></div>
            <div className="scard accent-card"><div className="scard-text"><div className="sv small">{fmtCur(custData.reduce((s, r) => s + parseFloat(r.total_spent || 0), 0))}</div><div className="sl">Total Revenue</div></div></div>
            <div className="scard"><div className="scard-text"><div className="sv">{custData.filter(c => c.visit_count > 1).length}</div><div className="sl">Repeat Customers</div></div></div>
            <div className="scard" style={{ borderTop: '3px solid #1db97e' }}><div className="scard-text">
              <div className="sv small" style={{ color: '#1db97e' }}>{fmtCur(custData.length ? custData[0]?.total_spent || 0 : 0)}</div>
              <div className="sl">Top Customer Spend</div>
            </div></div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="ch">
              <div className="ct">Customer List</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="sw2"><span className="si2">🔍</span><input placeholder="Name or phone…" value={custSearch} onChange={e => setCustSearch(e.target.value)} /></div>
                <ExportBtn onClick={() => exportToExcel(custFiltered.map(r => ({
                  Name: r.customer_name, Phone: r.customer_phone, Visits: r.visit_count,
                  TotalSpent: fmtNum(r.total_spent), LastVisit: fmtDate(r.last_visit), FirstVisit: fmtDate(r.first_visit)
                })), `Customers_${from}_${to}`)} />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th>#</th><th>Customer Name</th><th>Phone</th>
                  <th style={{ textAlign: 'center' }}>Visits</th>
                  <th style={{ textAlign: 'right' }}>Total Spent</th>
                  <th style={{ textAlign: 'right' }}>Avg / Visit</th>
                  <th>First Visit</th><th>Last Visit</th>
                </tr></thead>
                <tbody>
                  {custFiltered.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--ink2)', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>
                        {r.visit_count > 2 && <span style={{ marginRight: 6, fontSize: 14 }}>⭐</span>}
                        {r.customer_name || '—'}
                      </td>
                      <td>
                        <a href={`tel:${r.customer_phone}`} style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                          📞 {r.customer_phone || '—'}
                        </a>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: r.visit_count > 3 ? 'rgba(29,185,126,.1)' : 'var(--bg)', color: r.visit_count > 3 ? '#1db97e' : 'var(--ink2)', border: '1px solid var(--border)' }}>
                          {r.visit_count}×
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#1db97e' }}>{fmtCur(r.total_spent)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(parseFloat(r.total_spent) / parseInt(r.visit_count))}</td>
                      <td style={{ color: 'var(--ink2)', fontSize: 12 }}>{fmtDate(r.first_visit)}</td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{fmtDate(r.last_visit)}</td>
                    </tr>
                  ))}
                  {custFiltered.length === 0 && <tr><td colSpan={8}><div className="empty" style={{ padding: 40 }}><div className="ei">👥</div><p>No customer data for this period</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SALARY REPORT
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'salary' && (
        <div>
          <div className="stats-row">
            <div className="scard"><div className="scard-text"><div className="sv">{salaryData.length}</div><div className="sl">Staff Members</div></div></div>
            <div className="scard accent-card"><div className="scard-text"><div className="sv small">{fmtCur(salaryData.reduce((s, r) => s + parseFloat(r.earned_salary || 0), 0))}</div><div className="sl">Total Earned</div></div></div>
            <div className="scard" style={{ borderTop: '3px solid #e84a5f' }}><div className="scard-text"><div className="sv small" style={{ color: '#e84a5f' }}>{fmtCur(salaryData.reduce((s, r) => s + parseFloat(r.total_advance || 0), 0))}</div><div className="sl">Total Advances</div></div></div>
            <div className="scard" style={{ borderTop: '3px solid #1db97e' }}><div className="scard-text"><div className="sv small" style={{ color: '#1db97e' }}>{fmtCur(salaryData.reduce((s, r) => s + parseFloat(r.net_payable || 0), 0))}</div><div className="sl">Net Payable</div></div></div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="ch">
              <div className="ct">Salary Report — {month}</div>
              <ExportBtn onClick={() => exportToExcel(salaryData.map(r => ({
                Name: r.name, Role: r.role, Designation: r.designation || '—',
                MonthlySalary: fmtNum(r.monthly_salary), WorkDays: r.work_days_month,
                ExtraDays: r.extra_days, AbsentDays: r.absent_days, EffectiveDays: r.effective_days,
                PerDaySalary: fmtNum(r.per_day_salary), EarnedSalary: fmtNum(r.earned_salary),
                Advances: fmtNum(r.total_advance), NetPayable: fmtNum(r.net_payable)
              })), `Salary_${month}`)} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th>Staff</th><th>Role</th>
                  <th style={{ textAlign: 'right' }}>Monthly</th>
                  <th style={{ textAlign: 'center' }}>Days</th>
                  <th style={{ textAlign: 'center' }}>+Extra</th>
                  <th style={{ textAlign: 'center' }}>–Absent</th>
                  <th style={{ textAlign: 'center' }}>Effective</th>
                  <th style={{ textAlign: 'right' }}>Per Day</th>
                  <th style={{ textAlign: 'right' }}>Earned</th>
                  <th style={{ textAlign: 'right' }}>Advances</th>
                  <th style={{ textAlign: 'right' }}>Net Payable</th>
                </tr></thead>
                <tbody>
                  {salaryData.map((s, i) => {
                    const rm = ROLE_META[s.role];
                    return (
                      <tr key={i}>
                        <td><div style={{ fontWeight: 700 }}>{s.name}</div>{s.designation && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{s.designation}</div>}</td>
                        <td><span style={{ padding: '3px 9px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: rm?.bg, color: rm?.color }}>{rm?.icon} {rm?.label}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCur(s.monthly_salary)}</td>
                        <td style={{ textAlign: 'center' }}>{s.work_days_month}</td>
                        <td style={{ textAlign: 'center', color: s.extra_days > 0 ? '#1db97e' : 'var(--ink2)' }}>+{s.extra_days}</td>
                        <td style={{ textAlign: 'center', color: s.absent_days > 0 ? '#e84a5f' : 'var(--ink2)' }}>-{s.absent_days}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#118ab2' }}>{parseFloat(s.effective_days).toFixed(1)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--ink2)' }}>{fmtCur(s.per_day_salary)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#118ab2' }}>{fmtCur(s.earned_salary)}</td>
                        <td style={{ textAlign: 'right', color: '#e84a5f', fontWeight: 700 }}>{s.total_advance > 0 ? fmtCur(s.total_advance) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 15, color: s.net_payable >= 0 ? '#1db97e' : '#e84a5f' }}>{fmtCur(s.net_payable)}</td>
                      </tr>
                    );
                  })}
                  {salaryData.length === 0 && <tr><td colSpan={11}><div className="empty" style={{ padding: 40 }}><div className="ei">💰</div><p>No salary data for {month}</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FIXED COSTS
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'costs' && (
        <div>
          <div className="stats-row">
            {COST_CATS.map(cat => {
              const amt = costsByCat[cat.id] || 0;
              return (
                <div key={cat.id} className="scard">
                  <div style={{ fontSize: 22 }}>{cat.icon}</div>
                  <div className="scard-text">
                    <div className="sv small" style={{ color: amt > 0 ? '#e84a5f' : 'var(--ink2)' }}>{fmtCur(amt)}</div>
                    <div className="sl">{cat.label}</div>
                  </div>
                </div>
              );
            })}
            <div className="scard accent-card">
              <div style={{ fontSize: 22 }}>📊</div>
              <div className="scard-text"><div className="sv small">{fmtCur(costsTotal)}</div><div className="sl">Total {month}</div></div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="ch">
              <div className="ct">Fixed Costs — {month}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <ExportBtn onClick={() => exportToExcel(costsData.map(c => ({
                  Name: c.name, Category: c.category, Amount: fmtNum(c.amount), Month: c.month, Description: c.description || ''
                })), `FixedCosts_${month}`)} />
                <button className="btn-p" onClick={openAddCost}>+ Add Cost</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th>Cost Name</th><th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Month</th><th>Description</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {costsData.map(c => {
                    const cat = COST_CATS.find(x => x.id === c.category);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td><span style={{ padding: '3px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: 'rgba(232,74,95,.08)', color: '#e84a5f', border: '1px solid rgba(232,74,95,.2)' }}>{cat?.icon} {cat?.label}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#e84a5f', fontSize: 15 }}>{fmtCur(c.amount)}</td>
                        <td style={{ color: 'var(--ink2)' }}>{c.month}</td>
                        <td style={{ color: 'var(--ink2)', fontSize: 12 }}>{c.description || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="tact" style={{ justifyContent: 'center' }}>
                            <button className="bsm be" onClick={() => openEditCost(c)}>✏️</button>
                            <button className="bsm bd" onClick={() => setDelCost(c)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {costsData.length === 0 && (
                    <tr><td colSpan={6}>
                      <div className="empty" style={{ padding: 40 }}>
                        <div className="ei">🏠</div>
                        <h4>No fixed costs for {month}</h4>
                        <p>Add rent, electricity, maintenance and other recurring costs</p>
                        <button className="btn-p" style={{ marginTop: 12 }} onClick={openAddCost}>+ Add Cost</button>
                      </div>
                    </td></tr>
                  )}
                  {costsData.length > 0 && (
                    <tr style={{ background: 'rgba(232,74,95,.04)', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={2} style={{ padding: '12px 16px', fontWeight: 900 }}>Total Fixed Costs</td>
                      <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 16, color: '#e84a5f', padding: '12px 16px' }}>{fmtCur(costsTotal)}</td>
                      <td colSpan={3} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ FIXED COST MODAL ══════════════════════════════ */}

      {/* ══════════════════════════════════════════════
          INVENTORY REPORT
      ══════════════════════════════════════════════ */}
      {!loading && tab === 'inventory' && (
        <div>
          {/* Summary KPIs */}
          {invSummary && (
            <div className="stats-row" style={{ marginBottom: 20 }}>
              {[
                { l: 'Total Stock Value',   v: fmtCur(invSummary.totalValue),  c: '#1db97e' },
                { l: 'Total Items',         v: invSummary.items?.length || 0,   c: 'var(--ink)' },
                { l: 'Low Stock Items',     v: invSummary.lowCount,             c: '#e8572a' },
                { l: 'Out of Stock',        v: invSummary.outCount,             c: '#e84a5f' },
              ].map(({ l, v, c }) => (
                <div key={l} className="scard"><div className="scard-text">
                  <div className="sv small" style={{ color: c }}>{v}</div>
                  <div className="sl">{l}</div>
                </div></div>
              ))}
            </div>
          )}

          {/* Stock Levels Table */}
          {invSummary && (
            <div className="card" style={{ padding: 0, marginBottom: 20 }}>
              <div className="ch">
                <div className="ct">📦 Current Stock Levels</div>
                <ExportBtn onClick={() => exportToExcel(
                  invSummary.items.map(r => ({ Item: r.item_name, Category: r.category_name, Qty: r.current_quantity, Unit: r.unit_abbr, MinQty: r.min_quantity, PurchasePrice: r.purchase_price, StockValue: r.stock_value, Status: r.stock_status })),
                  `Inventory_Stock_${from}_${to}`
                )} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr>
                    <th>Item</th><th>Category</th>
                    <th style={{ textAlign:'right' }}>Current Qty</th>
                    <th style={{ textAlign:'right' }}>Min Qty</th>
                    <th style={{ textAlign:'right' }}>Purchase Price</th>
                    <th style={{ textAlign:'right' }}>Stock Value</th>
                    <th style={{ textAlign:'center' }}>Status</th>
                  </tr></thead>
                  <tbody>
                    {invSummary.items.map((r, i) => (
                      <tr key={i} style={{ background: r.stock_status==='out_of_stock'?'rgba(232,74,95,.04)':r.stock_status==='low_stock'?'rgba(232,87,42,.03)':'' }}>
                        <td style={{ fontWeight:700 }}>{r.name}</td>
                        <td style={{ fontSize:12, color:'var(--ink2)' }}>{r.category_name}</td>
                        <td style={{ textAlign:'right', fontWeight:700, color: r.stock_status!=='ok'?'#e84a5f':'var(--ink)' }}>
                          {parseFloat(r.current_quantity).toFixed(2)} <span style={{ fontSize:11, color:'var(--ink2)' }}>{r.unit_abbr}</span>
                        </td>
                        <td style={{ textAlign:'right', fontSize:12, color:'var(--ink2)' }}>
                          {r.min_quantity != null ? `${r.min_quantity} ${r.unit_abbr}` : '—'}
                        </td>
                        <td style={{ textAlign:'right', fontSize:13 }}>{r.purchase_price ? fmtCur(r.purchase_price) : '—'}</td>
                        <td style={{ textAlign:'right', fontWeight:800, color:'#1db97e' }}>{fmtCur(r.stock_value)}</td>
                        <td style={{ textAlign:'center' }}>
                          {r.stock_status === 'out_of_stock' && <span style={{ fontSize:11, fontWeight:800, color:'#e84a5f', padding:'2px 8px', borderRadius:10, background:'rgba(232,74,95,.1)' }}>OUT</span>}
                          {r.stock_status === 'low_stock'    && <span style={{ fontSize:11, fontWeight:800, color:'#e8572a', padding:'2px 8px', borderRadius:10, background:'rgba(232,87,42,.1)' }}>LOW</span>}
                          {r.stock_status === 'ok'           && <span style={{ fontSize:11, fontWeight:700, color:'#1db97e', padding:'2px 8px', borderRadius:10, background:'rgba(29,185,126,.1)' }}>OK</span>}
                        </td>
                      </tr>
                    ))}
                    {!invSummary.items.length && <tr><td colSpan={7}><div className="empty" style={{ padding:40 }}><div className="ei">📦</div><p>No inventory items</p></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Consumption Report */}
          {invConsumption.length > 0 && (
            <div className="card" style={{ padding: 0, marginBottom: 20 }}>
              <div className="ch">
                <div className="ct">🔥 Consumption Report ({from} → {to})</div>
                <ExportBtn onClick={() => exportToExcel(
                  invConsumption.map(r => ({ Item: r.item_name, Category: r.category_name, Unit: r.unit_abbr, SoldQty: r.sold_qty, PurchasedQty: r.purchased_qty, ConsumedValue: r.consumed_value })),
                  `Inventory_Consumption_${from}_${to}`
                )} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr>
                    <th>Item</th><th>Category</th>
                    <th style={{ textAlign:'right' }}>Consumed (Sales)</th>
                    <th style={{ textAlign:'right' }}>Purchased (In)</th>
                    <th style={{ textAlign:'right' }}>Consumed Value</th>
                  </tr></thead>
                  <tbody>
                    {invConsumption.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight:700 }}>{r.item_name}</td>
                        <td style={{ fontSize:12, color:'var(--ink2)' }}>{r.category_name}</td>
                        <td style={{ textAlign:'right', color:'#e84a5f', fontWeight:700 }}>
                          {parseFloat(r.sold_qty||0).toFixed(3)} {r.unit_abbr}
                        </td>
                        <td style={{ textAlign:'right', color:'#1db97e', fontWeight:700 }}>
                          {parseFloat(r.purchased_qty||0).toFixed(3)} {r.unit_abbr}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:800, color:'var(--accent)' }}>
                          {fmtCur(r.consumed_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Movement History */}
          <div className="card" style={{ padding: 0 }}>
            <div className="ch">
              <div className="ct">📋 Movement History ({from} → {to})</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <select value={invMovType} onChange={e => setInvMovType(e.target.value)}
                  style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg)', fontSize:12 }}>
                  <option value="">All Types</option>
                  <option value="sale_deduction">Sale Deductions</option>
                  <option value="purchase">Purchases</option>
                  <option value="manual_add">Manual Add</option>
                  <option value="manual_remove">Manual Remove</option>
                </select>
                <ExportBtn onClick={() => exportToExcel(
                  invMovements.map(r => ({ Date: r.date, Item: r.item_name, Type: r.movement_type, Change: r.quantity_change, Before: r.quantity_before, After: r.quantity_after, Note: r.note, By: r.created_by_name })),
                  `Inventory_Movements_${from}_${to}`
                )} />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  <th>Date</th><th>Item</th><th>Type</th>
                  <th style={{ textAlign:'right' }}>Change</th>
                  <th style={{ textAlign:'right' }}>Before</th>
                  <th style={{ textAlign:'right' }}>After</th>
                  <th>Note</th><th>By</th>
                </tr></thead>
                <tbody>
                  {invMovements.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize:12, color:'var(--ink2)' }}>{r.date}</td>
                      <td style={{ fontWeight:700 }}>{r.item_name}</td>
                      <td>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:700,
                          background: r.movement_type==='purchase'?'rgba(29,185,126,.12)':r.movement_type==='sale_deduction'?'rgba(232,87,42,.1)':'rgba(26,26,46,.07)',
                          color: r.movement_type==='purchase'?'#1db97e':r.movement_type==='sale_deduction'?'#e8572a':'var(--ink2)'
                        }}>{r.movement_type?.replace('_',' ')}</span>
                      </td>
                      <td style={{ textAlign:'right', fontWeight:800, color: parseFloat(r.quantity_change)>=0?'#1db97e':'#e84a5f' }}>
                        {parseFloat(r.quantity_change)>=0?'+':''}{parseFloat(r.quantity_change).toFixed(3)} {r.unit_abbr}
                      </td>
                      <td style={{ textAlign:'right', fontSize:12, color:'var(--ink2)' }}>{parseFloat(r.quantity_before).toFixed(3)}</td>
                      <td style={{ textAlign:'right', fontSize:12, fontWeight:700 }}>{parseFloat(r.quantity_after).toFixed(3)}</td>
                      <td style={{ fontSize:12, color:'var(--ink2)', maxWidth:200 }}>{r.note || '—'}</td>
                      <td style={{ fontSize:12, color:'var(--ink2)' }}>{r.created_by_name || '—'}</td>
                    </tr>
                  ))}
                  {!invMovements.length && <tr><td colSpan={8}><div className="empty" style={{ padding:40 }}><div className="ei">📋</div><p>No movements in this period</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Danger Zone: Selective Delete ── */}
      {tab === 'costs' && (
        <div className="card" style={{ marginTop:24, border:'1.5px solid #e84a5f', background:'rgba(232,74,95,.025)' }}>
          <div className="ch" style={{ borderBottom:'1.5px solid rgba(232,74,95,.15)' }}>
            <div className="ct" style={{ color:'#e84a5f' }}>⚠️ Danger Zone — Delete Data</div>
          </div>
          <div style={{ padding:'16px 20px' }}>
            <p style={{ fontSize:13, color:'var(--ink2)', marginBottom:16 }}>
              Select categories to delete. <strong style={{ color:'#e84a5f' }}>These actions are permanent and cannot be undone.</strong>
            </p>
            <button className="btn-p" onClick={() => setResetModal(true)}
              style={{ background:'#e84a5f', border:'none', fontSize:13 }}>
              🗑️ Select &amp; Delete Data…
            </button>
          </div>
        </div>
      )}

      <Modal show={resetModal} onClose={() => { setResetModal(false); setResetConfirmText(''); }}
        title="⚠️ Delete Data" subtitle="Choose what to delete — permanent, cannot be undone" wide
        footer={<>
          <button className="btn-c" onClick={() => { setResetModal(false); setResetConfirmText(''); }}>Cancel</button>
          <button className="btn-p"
            disabled={resetConfirmText !== 'DELETE' || !Object.values(resetSel||{}).some(Boolean)}
            style={{ background: (resetConfirmText==='DELETE' && Object.values(resetSel||{}).some(Boolean)) ? '#e84a5f':'#ccc', border:'none' }}
            onClick={async () => {
              const d = await resetAllData(resetSel);
              if (d.success) {
                const msg = d.deleted?.length ? d.deleted.join(', ') + ' deleted ✅' : 'Nothing deleted';
                toast(msg, 'ok');
                if (d.errors?.length) console.warn('Partial errors:', d.errors);
                setResetModal(false); setResetConfirmText(''); setResetSel({});
              } else toast(d.message || 'Error', 'er');
            }}>🗑️ Confirm Delete</button>
        </>}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {[
            { key:'orders',          icon:'🧾', label:'All Orders & KOTs',          desc:'Every sale, order item, KOT ticket' },
            { key:'inventory',       icon:'📦', label:'Inventory Stock & Purchases', desc:'Resets all stock to 0, clears purchase orders' },
            { key:'inventory_items', icon:'🗃️', label:'Inventory Items (the items themselves)', desc:'Removes all inventory items completely' },
            { key:'salary',          icon:'💰', label:'Salary Records & Advances',   desc:'All salary payments and advance entries' },
            { key:'expenses',        icon:'💸', label:'Expenses, Fuel & Fixed Costs', desc:'All expense entries, fuel logs, fixed costs' },
            { key:'menu',            icon:'🍽️', label:'Menu Items & Recipes',         desc:'All menu items and recipe definitions' },
            { key:'staff',           icon:'👥', label:'Staff Accounts (non-admin)',   desc:'All staff users except admin accounts' },
            { key:'coupons',         icon:'🎟️', label:'Coupons',                      desc:'All discount coupons' },
            { key:'tables',          icon:'🪑', label:'Tables (unoccupied)',          desc:'Restaurant tables with no active order' },
          ].map(({ key, icon, label, desc }) => (
            <label key={key} style={{
              display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
              borderRadius:10, cursor:'pointer', border:'1.5px solid',
              borderColor: resetSel?.[key] ? '#e84a5f' : 'var(--border)',
              background: resetSel?.[key] ? 'rgba(232,74,95,.06)' : 'var(--bg)',
              transition:'all .15s'
            }}>
              <input type="checkbox" checked={!!resetSel?.[key]}
                onChange={e => setResetSel(p => ({ ...p, [key]: e.target.checked }))}
                style={{ marginTop:2, accentColor:'#e84a5f', width:16, height:16, flexShrink:0 }} />
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{icon} {label}</div>
                <div style={{ fontSize:12, color:'var(--ink2)', marginTop:2 }}>{desc}</div>
              </div>
            </label>
          ))}

          <div style={{ marginTop:12, padding:'12px 14px', background:'rgba(232,74,95,.05)', borderRadius:10, border:'1.5px solid rgba(232,74,95,.2)' }}>
            {Object.values(resetSel||{}).some(Boolean)
              ? <div style={{ fontSize:13, color:'#e84a5f', fontWeight:600, marginBottom:10 }}>
                  Selected: {[
                    resetSel?.orders && 'Orders & KOTs',
                    resetSel?.inventory && 'Inventory Stock',
                    resetSel?.inventory_items && 'Inventory Items',
                    resetSel?.salary && 'Salary & Advances',
                    resetSel?.expenses && 'Expenses & Costs',
                    resetSel?.menu && 'Menu & Recipes',
                    resetSel?.staff && 'Staff (non-admin)',
                    resetSel?.coupons && 'Coupons',
                    resetSel?.tables && 'Tables',
                  ].filter(Boolean).join(', ')}
                </div>
              : <div style={{ fontSize:13, color:'var(--ink2)', marginBottom:10 }}>☝️ Check the boxes above to select what to delete</div>
            }
            <label style={{ fontSize:13, fontWeight:700 }}>
              Type <strong style={{ color:'#e84a5f' }}>DELETE</strong> to confirm:
            </label>
            <input className="mfi" style={{ marginTop:8 }} value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="DELETE" autoComplete="off" />
          </div>
        </div>
      </Modal>

      <Modal show={costModal} onClose={() => setCostModal(false)}
        title={editCost ? 'Edit Fixed Cost' : 'Add Fixed Cost'}
        subtitle={editCost ? `Editing: ${editCost.name}` : 'Record a recurring monthly expense'}
        footer={<><button className="btn-c" onClick={() => setCostModal(false)}>Cancel</button><button className="btn-p" onClick={saveCost}>{editCost ? 'Save Changes' : 'Add Cost'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="mgrid">
            <div>
              <label className="mlabel">Cost Name *</label>
              <input className="mfi" placeholder="e.g. Shop Rent, Electricity Bill…" value={costForm.name}
                onChange={e => setCostForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mlabel">Amount (₹) *</label>
              <input className="mfi" type="number" min="0" value={costForm.amount}
                onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="mlabel">Category</label>
              <select className="mfi" value={costForm.category} onChange={e => setCostForm(f => ({ ...f, category: e.target.value }))}>
                {COST_CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mlabel">Month</label>
              <input className="mfi" type="month" value={costForm.month}
                onChange={e => setCostForm(f => ({ ...f, month: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mlabel">Description / Notes</label>
            <input className="mfi" placeholder="e.g. For the month of March, Meter no. etc." value={costForm.description}
              onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmModal show={!!delCost} onClose={() => setDelCost(null)} onConfirm={doDelCost}
        title="Delete Cost Entry" message={`Delete "${delCost?.name}" (${fmtCur(delCost?.amount)}) from ${delCost?.month}?`} />
    </div>
  );
}

// Role meta for salary report display
const ROLE_META = {
  admin:   { label:'Admin',   color:'#e84a5f', bg:'rgba(232,74,95,.12)',   icon:'👑' },
  manager: { label:'Manager', color:'#118ab2', bg:'rgba(17,138,178,.12)',  icon:'🏠' },
  waiter:  { label:'Waiter',  color:'#1db97e', bg:'rgba(29,185,126,.12)',  icon:'🍽️' },
  staff:   { label:'Staff',   color:'#b07a00', bg:'rgba(244,165,53,.15)',  icon:'👤' },
};
