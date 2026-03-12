import React, { useState, useEffect, useCallback } from 'react';
import { getExpenses, getExpenseSummary, getExpenseCategories, createExpense, updateExpense, deleteExpense } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useWS, useWSEvent } from '../../context/WSContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const curMonth = () => localDate().slice(0, 7);
const p = n => parseFloat(n || 0);

const EMPTY = { category_id:'', amount:'', date:localDate(), note:'' };

export default function ExpensesPage() {
  const toast = useToast();
  const { connected } = useWS();
  const [expenses, setExpenses]       = useState([]);
  const [summary, setSummary]         = useState(null);
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [dateFrom, setDateFrom]       = useState(`${curMonth()}-01`);
  const [dateTo, setDateTo]           = useState(localDate());
  const [catFilter, setCatFilter]     = useState('');
  const [modal, setModal]             = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [delModal, setDelModal]       = useState(null);
  const [saving, setSaving]           = useState(false);

  const loadData = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const params = { from:dateFrom, to:dateTo };
      if (catFilter) params.category_id = catFilter;
      const [e, s] = await Promise.all([
        getExpenses(params),
        getExpenseSummary({ month: curMonth() }),
      ]);
      if (e.success) setExpenses(e.data || []);
      if (s.success) setSummary(s.data);
    } catch { if (!silent) toast('Load failed', 'er'); }
    if (!silent) setLoading(false);
  }, [dateFrom, dateTo, catFilter, toast]);

  useEffect(() => {
    getExpenseCategories().then(r => { if (r.success) setCategories(r.data || []); }).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useWSEvent('expense_added', () => loadData(true));
  useWSEvent('stats_update',  () => loadData(true));
  useWSEvent('salary_updated',() => loadData(true));

  const openModal = (exp=null) => {
    setEditing(exp);
    setForm(exp ? { category_id:exp.category_id||'', amount:exp.amount, date:exp.date?.slice(0,10)||localDate(), note:exp.note||'' } : EMPTY);
    setModal(true);
  };

  const save = async () => {
    if (!form.amount || p(form.amount) <= 0) { toast('Amount must be > 0', 'er'); return; }
    if (!form.date) { toast('Date is required', 'er'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount:p(form.amount) };
      const r = editing ? await updateExpense(editing.id, payload) : await createExpense(payload);
      if (r.success) { toast(editing?'✅ Updated!':'✅ Expense added!', 'ok'); setModal(false); loadData(true); }
      else toast(r.message, 'er');
    } catch (e) { toast(e.message, 'er'); }
    setSaving(false);
  };

  const del = async () => {
    try {
      const r = await deleteExpense(delModal.id);
      if (r.success) { toast('Deleted', 'ok'); setDelModal(null); loadData(true); }
      else toast(r.message, 'er');
    } catch (e) { toast(e.message, 'er'); }
  };

  const totalFiltered = expenses.reduce((s, e) => s + p(e.amount), 0);
  const maxCat = summary?.byCategory?.length ? Math.max(...summary.byCategory.map(c => p(c.total)), 1) : 1;

  return (
    <div>
      <style>{`@keyframes exp-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      <div className="ph" style={{ marginBottom:22 }}>
        <div className="ph-left">
          <div className="pt">💸 Expense Manager</div>
          <div className="ps">Track all business expenses — salary, utilities, purchases</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:800,
            background:connected?'rgba(29,185,126,.1)':'rgba(232,74,95,.08)',
            border:`1.5px solid ${connected?'#1db97e':'#e84a5f'}`, color:connected?'#1db97e':'#e84a5f' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:connected?'#1db97e':'#e84a5f', animation:connected?'exp-pulse 2s infinite':'none' }}/>
            {connected?'Live':'Offline'}
          </div>
          <button className="btn-p" onClick={() => openModal()}>+ Add Expense</button>
        </div>
      </div>

      {/* KPI cards */}
      {summary && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:14, marginBottom:22 }}>
          <div className="card" style={{ padding:'16px 18px', background:'var(--accent)', border:'none' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.7)', marginBottom:6 }}>TODAY</div>
            <div style={{ fontSize:26, fontWeight:900, color:'#fff' }}>{fmtCur(summary.today?.total||0)}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:3 }}>{summary.today?.count||0} entries</div>
          </div>
          <div className="card" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--ink2)', marginBottom:6 }}>THIS MONTH</div>
            <div style={{ fontSize:26, fontWeight:900 }}>{fmtCur(summary.month?.total||0)}</div>
            <div style={{ fontSize:11, color:'var(--ink2)', marginTop:3 }}>{summary.month?.count||0} entries</div>
          </div>
          {(summary.byCategory||[]).filter(c=>p(c.total)>0).slice(0,4).map((c,i) => (
            <div key={i} className="card" style={{ padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--ink2)' }}>{c.name?.toUpperCase()}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:900, color:c.color||'var(--ink)' }}>{fmtCur(c.total)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Category chart */}
      {summary?.byCategory?.some(c=>p(c.total)>0) && (
        <div className="card" style={{ padding:'16px 22px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:800, marginBottom:14 }}>📊 Monthly Spend by Category</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {summary.byCategory.filter(c=>p(c.total)>0).map((c,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:16, width:22, flexShrink:0 }}>{c.icon}</span>
                <span style={{ fontSize:12, fontWeight:700, width:100, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</span>
                <div style={{ flex:1, height:9, background:'var(--bg)', borderRadius:5 }}>
                  <div style={{ height:'100%', width:`${(p(c.total)/maxCat)*100}%`, background:c.color||'#888', borderRadius:5, transition:'width .4s' }}/>
                </div>
                <span style={{ fontSize:13, fontWeight:800, width:80, textAlign:'right', color:c.color||'var(--ink)', flexShrink:0 }}>{fmtCur(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'var(--ink2)', fontWeight:600 }}>From</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, background:'var(--bg)', outline:'none', color:'var(--ink)' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'var(--ink2)', fontWeight:600 }}>To</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:9, fontSize:13, background:'var(--bg)', outline:'none', color:'var(--ink)' }}/>
        </div>
        <select className="fsel" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <div style={{ marginLeft:'auto', fontSize:13, fontWeight:800 }}>
          Total: <span style={{ color:'var(--accent)' }}>{fmtCur(totalFiltered)}</span>
          <span style={{ color:'var(--ink2)', fontWeight:400, marginLeft:6 }}>({expenses.length} entries)</span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        {loading ? (
          <div style={{ padding:60, textAlign:'center', color:'var(--ink2)' }}>Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="empty"><div className="ei">💸</div><h4>No expenses found</h4><p>Add your first expense</p></div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead><tr>
                <th>Date</th><th>Category</th><th style={{textAlign:'right'}}>Amount</th><th>Note</th><th>Added By</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {expenses.map((exp, i) => (
                  <tr key={i}>
                    <td style={{ fontSize:13, color:'var(--ink2)', whiteSpace:'nowrap' }}>{exp.date}</td>
                    <td>
                      {exp.cat_icon ? (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700,
                          background:`${exp.cat_color||'#888'}18`, color:exp.cat_color||'var(--ink2)' }}>
                          {exp.cat_icon} {exp.category_name}
                        </span>
                      ) : <span style={{ fontSize:12, color:'var(--ink2)' }}>—</span>}
                    </td>
                    <td style={{ textAlign:'right', fontWeight:800, fontSize:14 }}>
                      {fmtCur(exp.amount)}
                      {exp.ref_type && <div style={{ fontSize:9, color:'var(--ink2)', fontWeight:500 }}>auto·{exp.ref_type}</div>}
                    </td>
                    <td style={{ fontSize:13, color:'var(--ink2)', maxWidth:220 }}>
                      {exp.staff_name && (
                        <div style={{ fontWeight:700, color:'var(--ink)', marginBottom:2 }}>👤 {exp.staff_name}</div>
                      )}
                      {exp.note||'—'}
                    </td>
                    <td style={{ fontSize:12, color:'var(--ink2)' }}>{exp.created_by_name||'—'}</td>
                    <td>
                      <div className="tact">
                        {!exp.ref_type && <button className="bsm be" onClick={()=>openModal(exp)}>✏️</button>}
                        <button className="bsm bd" onClick={()=>setDelModal(exp)}>🗑️</button>
                        {exp.ref_type && <span style={{ fontSize:9, color:'var(--ink2)', padding:'2px 6px', borderRadius:6, background:'rgba(0,0,0,.06)' }}>auto·{exp.ref_type}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal show={modal} onClose={()=>setModal(false)} title={editing?'✏️ Edit Expense':'+ Add Expense'}>
        <div className="mgrid">
          <div>
            <label className="mlabel">Category</label>
            <select className="mfi" value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>
              <option value="">Select category…</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mlabel">Amount (₹) *</label>
            <input className="mfi" type="number" min="0.01" step="0.01" value={form.amount}
              onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="Enter amount" autoFocus/>
          </div>
          <div className="mfull">
            <label className="mlabel">Date *</label>
            <input className="mfi" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          </div>
          <div className="mfull">
            <label className="mlabel">Note</label>
            <textarea className="mfi" rows={2} value={form.note}
              onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="What was this expense for?"/>
          </div>
        </div>
        <div className="mft">
          <button className="btn-c" onClick={()=>setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save} disabled={saving}>{saving?'Saving…':'Save Expense'}</button>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={()=>setDelModal(null)} onConfirm={del}
        title="Delete Expense?"
        message={delModal?.ref_type
          ? `Delete this auto-generated ${delModal.ref_type} expense of ${fmtCur(delModal?.amount)}? Note: the original advance/salary record will NOT be deleted — only this expense entry.`
          : `Delete ${fmtCur(delModal?.amount)} expense? This cannot be undone.`}/>
    </div>
  );
}
