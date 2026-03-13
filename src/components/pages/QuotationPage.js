import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getMenuItemsAll, getCourses, getSettings,
  getQuotations, createQuotation, deleteQuotation,
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr || todayStr());
  d.setDate(d.getDate() + parseInt(days || 7));
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

const STATUS_STYLE = {
  draft:    { bg:'rgba(150,150,150,.12)', color:'#888',    label:'Draft'    },
  sent:     { bg:'rgba(33,150,243,.12)',  color:'#1565c0', label:'Sent'     },
  accepted: { bg:'rgba(29,185,126,.12)', color:'#1db97e', label:'Accepted' },
  rejected: { bg:'rgba(232,74,95,.12)',  color:'#e84a5f', label:'Rejected' },
};
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft;
  return (
    <span style={{ background:s.bg, color:s.color, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
      {s.label}
    </span>
  );
}

// ── Printable quotation layout ────────────────────────────────────
function QuotationPrint({ quoteNum, quoteDate, validDays, custName, custPhone, custAddress,
                          eventType, pax, cart, subtotal, totalGst, discountAmt,
                          finalTotal, perPax, notes, settings }) {
  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", fontSize:13, color:'#1a1a1a', maxWidth:680, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, paddingBottom:20, borderBottom:'2px solid #f97316' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:'#f97316' }}>{settings.restaurant_name || 'Restaurant'}</div>
          {settings.address && <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{settings.address}</div>}
          {settings.phone && <div style={{ fontSize:12, color:'#666' }}>📞 {settings.phone}</div>}
          {settings.gst_number && <div style={{ fontSize:12, color:'#666' }}>GST: {settings.gst_number}</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#f97316' }}>QUOTATION</div>
          <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{quoteNum}</div>
          <div style={{ fontSize:12, color:'#666', marginTop:2 }}>Date: {fmtDate(quoteDate)}</div>
          <div style={{ fontSize:12, color:'#e84a5f', fontWeight:700 }}>Valid Till: {addDays(quoteDate, validDays)}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={{ background:'#fafafa', borderRadius:8, padding:'12px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'#999', marginBottom:8 }}>Prepared For</div>
          {custName   && <div style={{ fontWeight:700, fontSize:15 }}>{custName}</div>}
          {custPhone  && <div style={{ fontSize:12, color:'#666', marginTop:2 }}>📞 {custPhone}</div>}
          {custAddress&& <div style={{ fontSize:12, color:'#666', marginTop:2 }}>📍 {custAddress}</div>}
          {!custName && !custPhone && <div style={{ color:'#ccc', fontSize:12 }}>—</div>}
        </div>
        <div style={{ background:'#fafafa', borderRadius:8, padding:'12px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'#999', marginBottom:8 }}>Event Details</div>
          {eventType && <div style={{ fontWeight:700 }}>{eventType}</div>}
          {pax       && <div style={{ fontSize:12, color:'#666', marginTop:2 }}>👥 {pax} Guests</div>}
          {!eventType && !pax && <div style={{ color:'#ccc', fontSize:12 }}>—</div>}
        </div>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:16 }}>
        <thead>
          <tr style={{ background:'#f97316' }}>
            {['#','Item','Qty','Rate','Amount'].map((h,i) => (
              <th key={h} style={{ padding:'9px 12px', textAlign:i>1?'right':'left', color:'#fff', fontSize:11, textTransform:'uppercase', fontWeight:700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cart.map((item,i) => (
            <tr key={item.menu_item_id||i} style={{ borderBottom:'1px solid #eee', background:i%2===0?'#fff':'#fafafa' }}>
              <td style={{ padding:'8px 12px', color:'#999', fontSize:12 }}>{i+1}</td>
              <td style={{ padding:'8px 12px' }}>
                <div style={{ fontWeight:600 }}>{item.name||item.item_name}</div>
                {item.notes && <div style={{ fontSize:11, color:'#999' }}>{item.notes}</div>}
                {(item.gst_pct||item.gst_percent||0) > 0 && <div style={{ fontSize:10, color:'#f97316' }}>+{item.gst_pct||item.gst_percent}% GST</div>}
              </td>
              <td style={{ padding:'8px 12px', textAlign:'right' }}>{item.qty||item.quantity}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', color:'#666' }}>{fmtCur(item.price||item.unit_price)}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700 }}>{fmtCur((item.price||item.unit_price)*(item.qty||item.quantity))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
        <div style={{ minWidth:260 }}>
          {[
            ['Subtotal', subtotal, '#1a1a1a'],
            totalGst > 0    && ['GST',      totalGst,    '#666'],
            discountAmt > 0 && ['Discount', -discountAmt,'#e84a5f'],
          ].filter(Boolean).map(([l,v,c]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:13, color:c }}>
              <span>{l}</span><span>{v < 0 ? '−' : ''}{fmtCur(Math.abs(v))}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 6px', fontSize:16, fontWeight:800, borderTop:'2px solid #f97316', marginTop:6, color:'#f97316' }}>
            <span>Grand Total</span><span>{fmtCur(finalTotal)}</span>
          </div>
          {pax > 0 && <div style={{ textAlign:'right', fontSize:12, color:'#666' }}>Per person ({pax} pax): <strong>{fmtCur(perPax)}</strong></div>}
        </div>
      </div>

      {notes && (
        <div style={{ background:'#fff8f0', border:'1px solid #f97316', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'#f97316', marginBottom:6 }}>Terms & Notes</div>
          <div style={{ fontSize:12, color:'#444', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{notes}</div>
        </div>
      )}
      <div style={{ textAlign:'center', fontSize:11, color:'#999', borderTop:'1px solid #eee', paddingTop:12 }}>
        Computer-generated quotation. • {settings.restaurant_name || 'Restaurant'}
      </div>
    </div>
  );
}

function blankForm() {
  return { custName:'', custPhone:'', custAddress:'', eventType:'', pax:'',
           quoteDate:todayStr(), validDays:'7', notes:'', discType:'none', discVal:'' };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function QuotationPage() {
  const toast    = useToast();
  const printRef = useRef(null);

  const [menuItems,     setMenuItems]     = useState([]);
  const [courses,       setCourses]       = useState([]);
  const [settings,      setSettings]      = useState({});
  const [loadingMaster, setLoadingMaster] = useState(true);

  const [quotations,    setQuotations]    = useState([]);
  const [loadingList,   setLoadingList]   = useState(false);
  const [listSearch,    setListSearch]    = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // 'list' | 'new'
  const [mode, setMode] = useState('list');

  const [form,   setForm]   = useState(blankForm);
  const [cart,   setCart]   = useState([]);
  const [search, setSearch] = useState('');
  const [courseFilter, setCF] = useState('all');
  const [saving, setSaving] = useState(false);

  // null | '__builder__' | quotation-object
  const [previewQuote, setPreviewQuote] = useState(null);

  // ── Load ──────────────────────────────────────────────
  const loadMaster = useCallback(async () => {
    setLoadingMaster(true);
    try {
      const [m, c, s] = await Promise.all([getMenuItemsAll(), getCourses(), getSettings()]);
      if (m.success) setMenuItems(m.data.filter(i => i.is_active));
      if (c.success) setCourses(c.data.filter(x => x.is_active));
      if (s.success) setSettings(s.data || {});
    } finally { setLoadingMaster(false); }
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await getQuotations();
      if (r.success) setQuotations(r.data);
    } catch { toast('Failed to load quotations', 'er'); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadMaster(); loadList(); }, [loadMaster, loadList]);

  // ── Cart ──────────────────────────────────────────────
  const addToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === item.id);
      if (idx >= 0) { const n=[...prev]; n[idx]={...n[idx],qty:n[idx].qty+1}; return n; }
      return [...prev, { menu_item_id:item.id, name:item.name, price:parseFloat(item.selling_price),
                         gst_pct:parseFloat(item.gst_percent)||0, is_veg:item.is_veg, qty:1, notes:'' }];
    });
  };
  const setQty = (id, qty) => {
    if (qty < 1) { setCart(prev => prev.filter(c => c.menu_item_id !== id)); return; }
    setCart(prev => prev.map(c => c.menu_item_id===id ? {...c,qty} : c));
  };
  const setItemNotes = (id, n) => setCart(prev => prev.map(c => c.menu_item_id===id ? {...c,notes:n} : c));

  // ── Totals ─────────────────────────────────────────────
  const subtotal    = cart.reduce((s,c) => s + c.price*c.qty, 0);
  const totalGst    = cart.reduce((s,c) => s + c.price*c.qty*c.gst_pct/100, 0);
  const rawTotal    = subtotal + totalGst;
  const discountAmt = form.discType==='percentage' && form.discVal>0
    ? rawTotal * parseFloat(form.discVal)/100
    : form.discType==='amount' && form.discVal>0
      ? Math.min(parseFloat(form.discVal), rawTotal) : 0;
  const finalTotal = Math.max(0, rawTotal - discountAmt);
  const perPax     = form.pax > 0 ? finalTotal / parseFloat(form.pax) : 0;

  // ── Filter ─────────────────────────────────────────────
  const filtered = useMemo(() => menuItems.filter(i => {
    if (courseFilter!=='all' && i.course_id !== parseInt(courseFilter)) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [menuItems, courseFilter, search]);

  const filteredList = useMemo(() => {
    if (!listSearch.trim()) return quotations;
    const q = listSearch.toLowerCase();
    return quotations.filter(x =>
      (x.quotation_number||'').toLowerCase().includes(q) ||
      (x.customer_name||'').toLowerCase().includes(q) ||
      (x.customer_phone||'').toLowerCase().includes(q)
    );
  }, [quotations, listSearch]);

  // ── Save ───────────────────────────────────────────────
  const saveQuotation = async () => {
    if (!cart.length)          { toast('Add at least one item', 'er'); return; }
    if (!form.custName.trim()) { toast('Customer name is required', 'er'); return; }
    setSaving(true);
    try {
      const validUntilDate = (() => {
        const d = new Date(form.quoteDate);
        d.setDate(d.getDate() + parseInt(form.validDays||7));
        return d.toISOString().slice(0,10);
      })();
      const noteParts = [
        form.eventType && `Event: ${form.eventType}`,
        form.pax       && `Pax: ${form.pax}`,
        form.notes,
      ].filter(Boolean);
      const r = await createQuotation({
        customer_name:    form.custName.trim(),
        customer_phone:   form.custPhone  || null,
        customer_address: form.custAddress|| null,
        notes:       noteParts.join('\n') || null,
        valid_until: validUntilDate,
        discount_type:  form.discType !== 'none' ? form.discType : null,
        discount_value: parseFloat(form.discVal) || 0,
        items: cart.map(c => ({
          menu_item_id: c.menu_item_id,
          item_name:    c.name,
          quantity:     c.qty,
          unit_price:   c.price,
          gst_percent:  c.gst_pct,
          notes:        c.notes || null,
        })),
      });
      if (r.success) {
        toast(`${r.data.quotation_number} saved! ✅`, 'ok');
        await loadList();
        setMode('list');
        setCart([]);
        setForm(blankForm());
      } else {
        toast(r.message || 'Failed to save', 'er');
      }
    } catch(err) {
      toast(err?.response?.data?.message || 'Error saving', 'er');
    } finally { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────
  const confirmDelete = async (id) => {
    try {
      const r = await deleteQuotation(id);
      if (r.success) { toast('Deleted', 'ok'); setQuotations(prev => prev.filter(q => q.id!==id)); }
      else toast(r.message||'Failed','er');
    } catch { toast('Error','er'); }
    setDeleteConfirm(null);
  };

  // ── Print ──────────────────────────────────────────────
  const doPrint = (savedQ) => {
    const html = savedQ ? null : printRef.current?.innerHTML;
    const printStyles = `body{margin:0;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff}
      @media print{@page{margin:15mm}}table{width:100%;border-collapse:collapse}
      th,td{padding:8px 12px}thead th{background:#f97316;color:#fff;font-size:11px;text-transform:uppercase}
      tbody tr:nth-child(even){background:#fafafa}tbody tr td{border-bottom:1px solid #eee;font-size:13px}`;

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { toast('Allow popups to print', 'er'); return; }

    if (savedQ) {
      // Build print HTML from saved quote data
      const q = savedQ;
      const rows = (q.items||[]).map((item,i) =>
        `<tr style="background:${i%2===0?'#fff':'#fafafa'}">
          <td style="padding:8px 12px;color:#999">${i+1}</td>
          <td style="padding:8px 12px"><strong>${item.item_name}</strong>${item.notes?`<br><small style="color:#999">${item.notes}</small>`:''}</td>
          <td style="padding:8px 12px;text-align:right">${item.quantity}</td>
          <td style="padding:8px 12px;text-align:right;color:#666">₹${parseFloat(item.unit_price).toFixed(0)}</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700">₹${(parseFloat(item.unit_price)*item.quantity).toFixed(0)}</td>
        </tr>`).join('');
      const sub = parseFloat(q.subtotal)||0;
      const gst = parseFloat(q.gst_amount)||0;
      const disc= parseFloat(q.discount_amount)||0;
      const tot = parseFloat(q.total_amount)||0;
      win.document.write(`<html><head><title>${q.quotation_number}</title><style>${printStyles}</style></head><body>
        <div style="max-width:680px;margin:0 auto;padding:20px;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a">
          <div style="display:flex;justify-content:space-between;padding-bottom:20px;border-bottom:2px solid #f97316;margin-bottom:24px">
            <div><div style="font-size:22px;font-weight:800;color:#f97316">${settings.restaurant_name||'Restaurant'}</div>
              ${settings.address?`<div style="font-size:12px;color:#666">${settings.address}</div>`:''}
              ${settings.phone?`<div style="font-size:12px;color:#666">📞 ${settings.phone}</div>`:''}
            </div>
            <div style="text-align:right">
              <div style="font-size:20px;font-weight:800;color:#f97316">QUOTATION</div>
              <div style="font-weight:700;margin-top:4px">${q.quotation_number}</div>
              <div style="font-size:12px;color:#666">Date: ${fmtDate(q.date||q.created_at)}</div>
              <div style="font-size:12px;color:#e84a5f;font-weight:700">Valid Till: ${fmtDate(q.valid_until||q.valid_until_fmt)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
            <div style="background:#fafafa;border-radius:8px;padding:12px 16px">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#999;margin-bottom:8px">Prepared For</div>
              ${q.customer_name?`<div style="font-weight:700;font-size:15px">${q.customer_name}</div>`:''}
              ${q.customer_phone?`<div style="font-size:12px;color:#666">📞 ${q.customer_phone}</div>`:''}
              ${q.customer_address?`<div style="font-size:12px;color:#666">📍 ${q.customer_address}</div>`:''}
            </div>
            <div style="background:#fafafa;border-radius:8px;padding:12px 16px">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#999;margin-bottom:8px">Notes</div>
              <div style="font-size:12px;color:#444">${q.notes||'—'}</div>
            </div>
          </div>
          <table><thead><tr style="background:#f97316">${['#','Item','Qty','Rate','Amount'].map((h,i)=>`<th style="padding:9px 12px;text-align:${i>1?'right':'left'};color:#fff;font-size:11px;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody></table>
          <div style="display:flex;justify-content:flex-end;margin:16px 0">
            <div style="min-width:260px">
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span>Subtotal</span><span>₹${sub.toFixed(0)}</span></div>
              ${gst>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#666"><span>GST</span><span>₹${gst.toFixed(0)}</span></div>`:''}
              ${disc>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#e84a5f"><span>Discount</span><span>−₹${disc.toFixed(0)}</span></div>`:''}
              <div style="display:flex;justify-content:space-between;padding:10px 0 6px;font-size:16px;font-weight:800;border-top:2px solid #f97316;margin-top:6px;color:#f97316"><span>Grand Total</span><span>₹${tot.toFixed(0)}</span></div>
            </div>
          </div>
          ${q.notes?`<div style="background:#fff8f0;border:1px solid #f97316;border-radius:8px;padding:12px 16px;margin-bottom:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#f97316;margin-bottom:6px">Terms & Notes</div><div style="font-size:12px;color:#444;white-space:pre-wrap">${q.notes}</div></div>`:''}
          <div style="text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">Computer-generated quotation. • ${settings.restaurant_name||'Restaurant'}</div>
        </div>
        <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    } else {
      win.document.write(`<html><head><title>Quotation</title><style>${printStyles}</style></head><body>${html}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    }
    win.document.close();
  };

  const setF = (k,v) => setForm(prev => ({...prev,[k]:v}));

  // ══════════════════════════════════════════════════════════════════
  // LIST VIEW
  if (mode === 'list') return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">📋 Quotations</div>
          <div className="ps">Create, manage and print customer quotations</div>
        </div>
        <button className="btn-p" onClick={() => { setCart([]); setForm(blankForm()); setMode('new'); }}
          style={{ padding:'9px 20px', fontSize:14 }}>
          + New Quotation
        </button>
      </div>

      <div style={{ padding:'0 20px 16px', display:'flex', gap:8, alignItems:'center' }}>
        <input placeholder="🔍 Search by name, phone, quote no…"
          value={listSearch} onChange={e => setListSearch(e.target.value)}
          style={{ flex:1, maxWidth:400, padding:'8px 14px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--ink)' }} />
        <button onClick={loadList} className="btn-c" style={{ padding:'8px 16px', fontSize:13 }}>
          {loadingList ? '⏳' : '🔄 Refresh'}
        </button>
      </div>

      <div style={{ padding:'0 20px' }}>
        {loadingList && <div className="loading-wrap">Loading…</div>}

        {!loadingList && filteredList.length === 0 && (
          <div className="empty" style={{ padding:60 }}>
            <div className="ei">📋</div>
            <h4>{quotations.length===0 ? 'No quotations yet' : 'No results'}</h4>
            <p>{quotations.length===0 ? 'Click "+ New Quotation" to create one' : 'Try a different search'}</p>
          </div>
        )}

        {!loadingList && filteredList.length > 0 && (
          <div className="card" style={{ overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--bg)' }}>
                  {['Quote No.','Customer','Date','Valid Till','Amount','Status',''].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:h==='Amount'?'right':'left', color:'var(--ink2)', fontWeight:700, fontSize:11, textTransform:'uppercase', borderBottom:'1.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.map(q => (
                  <tr key={q.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 14px', fontWeight:700, color:'var(--accent)' }}>{q.quotation_number}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontWeight:600 }}>{q.customer_name||'—'}</div>
                      {q.customer_phone && <div style={{ fontSize:11, color:'var(--ink2)' }}>{q.customer_phone}</div>}
                    </td>
                    <td style={{ padding:'10px 14px', color:'var(--ink2)', fontSize:12 }}>{fmtDate(q.date||q.created_at)}</td>
                    <td style={{ padding:'10px 14px', color:'var(--ink2)', fontSize:12 }}>{fmtDate(q.valid_until_fmt||q.valid_until)}</td>
                    <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700 }}>{fmtCur(q.total_amount)}</td>
                    <td style={{ padding:'10px 14px' }}><StatusBadge status={q.status} /></td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button onClick={() => setPreviewQuote(q)}
                          style={{ padding:'5px 10px', borderRadius:7, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:12, color:'var(--ink2)' }}>
                          👁 View
                        </button>
                        <button onClick={() => setDeleteConfirm(q.id)}
                          style={{ padding:'5px 10px', borderRadius:7, border:'1.5px solid #fbb', background:'transparent', cursor:'pointer', fontSize:12, color:'#e84a5f' }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setDeleteConfirm(null)}>
          <div style={{ background:'var(--surface)', borderRadius:16, padding:28, maxWidth:340, width:'90%', textAlign:'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:8 }}>Delete Quotation?</div>
            <div style={{ color:'var(--ink2)', fontSize:13, marginBottom:20 }}>This cannot be undone.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding:'9px 22px', borderRadius:10, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', fontWeight:700, fontSize:13 }}>Cancel</button>
              <button onClick={() => confirmDelete(deleteConfirm)}
                style={{ padding:'9px 22px', borderRadius:10, border:'none', background:'#e84a5f', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* View/print saved quote */}
      {previewQuote && previewQuote !== '__builder__' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setPreviewQuote(null)}>
          <div style={{ background:'#fff', borderRadius:16, maxWidth:720, width:'100%', maxHeight:'92vh', overflow:'auto', color:'#1a1a1a' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid #eee', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>{previewQuote.quotation_number}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => doPrint(previewQuote)}
                  style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#f97316', color:'#fff', fontWeight:700, cursor:'pointer' }}>🖨 Print</button>
                <button onClick={() => setPreviewQuote(null)}
                  style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #ccc', background:'transparent', cursor:'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ padding:24 }}>
              <QuotationPrint
                quoteNum={previewQuote.quotation_number}
                quoteDate={previewQuote.date||previewQuote.created_at?.slice(0,10)}
                validDays={7}
                custName={previewQuote.customer_name} custPhone={previewQuote.customer_phone}
                custAddress={previewQuote.customer_address} eventType={null} pax={null}
                cart={(previewQuote.items||[]).map(i => ({
                  menu_item_id:i.menu_item_id, name:i.item_name,
                  price:parseFloat(i.unit_price), gst_pct:parseFloat(i.gst_percent)||0,
                  qty:i.quantity, notes:i.notes,
                }))}
                subtotal={parseFloat(previewQuote.subtotal)||0}
                totalGst={parseFloat(previewQuote.gst_amount)||0}
                discountAmt={parseFloat(previewQuote.discount_amount)||0}
                finalTotal={parseFloat(previewQuote.total_amount)||0}
                perPax={0} notes={previewQuote.notes} settings={settings}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // NEW QUOTATION BUILDER
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)', overflow:'hidden' }}>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1.5px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => { setMode('list'); setCart([]); setForm(blankForm()); }}
            style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:12, color:'var(--ink2)' }}>
            ← Back
          </button>
          <div style={{ fontWeight:800, fontSize:15 }}>📋 New Quotation</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {cart.length > 0 && (
            <button onClick={() => setPreviewQuote('__builder__')}
              style={{ padding:'7px 14px', borderRadius:9, border:'1.5px solid var(--accent)', background:'transparent', color:'var(--accent)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              👁 Preview
            </button>
          )}
          <button onClick={saveQuotation} disabled={saving || !cart.length}
            style={{ padding:'7px 20px', borderRadius:9, border:'none', background:cart.length?'var(--accent)':'#ccc', color:'#fff', fontWeight:700, fontSize:13, cursor:cart.length?'pointer':'not-allowed' }}>
            {saving ? '⏳ Saving…' : '💾 Save'}
          </button>
          {cart.length > 0 && (
            <button onClick={() => doPrint(null)}
              style={{ padding:'7px 16px', borderRadius:9, border:'none', background:'#f97316', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              🖨 Print
            </button>
          )}
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* LEFT: Menu grid */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:'1.5px solid var(--border)', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>
            <input placeholder="🔍 Search menu…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, background:'var(--bg)', color:'var(--ink)', boxSizing:'border-box', marginBottom:8 }} />
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button onClick={() => setCF('all')}
                style={{ padding:'4px 10px', borderRadius:7, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer',
                  background:courseFilter==='all'?'var(--accent)':'transparent',
                  color:courseFilter==='all'?'#fff':'var(--ink2)',
                  borderColor:courseFilter==='all'?'var(--accent)':'var(--border)' }}>All</button>
              {courses.map(c => (
                <button key={c.id} onClick={() => setCF(courseFilter===c.id?'all':c.id)}
                  style={{ padding:'4px 10px', borderRadius:7, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer',
                    background:courseFilter===c.id?c.color||'var(--accent)':'transparent',
                    color:courseFilter===c.id?'#fff':'var(--ink2)',
                    borderColor:courseFilter===c.id?c.color||'var(--accent)':'var(--border)' }}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:10, alignContent:'start' }}>
            {loadingMaster
              ? <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:'var(--ink2)' }}>Loading…</div>
              : filtered.length===0
                ? <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:'var(--ink2)' }}>No items</div>
                : filtered.map(item => {
                  const inCart = cart.find(c => c.menu_item_id===item.id);
                  return (
                    <div key={item.id} onClick={() => addToCart(item)}
                      style={{ background:'var(--surface)', border:`1.5px solid ${inCart?'var(--accent)':'var(--border)'}`, borderRadius:12, padding:'10px 10px 8px', cursor:'pointer', position:'relative', transition:'border-color .12s' }}>
                      <div style={{ width:'100%', aspectRatio:'1', borderRadius:8, overflow:'hidden', marginBottom:6, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <span style={{ fontSize:22 }}>🍽️</span>}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, lineHeight:1.3, marginBottom:3 }}>{item.name}</div>
                      <div style={{ fontSize:11, color:'var(--accent)', fontWeight:800 }}>{fmtCur(item.selling_price)}</div>
                      {inCart && (
                        <div style={{ position:'absolute', top:5, right:5, background:'var(--accent)', color:'#fff', borderRadius:'50%', width:19, height:19, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>
                          {inCart.qty}
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>
        </div>

        {/* RIGHT: Form */}
        <div style={{ width:370, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--surface)' }}>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>

            {/* Customer */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink2)', textTransform:'uppercase', marginBottom:6 }}>👤 Customer / Event</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[['Name *','custName','text','Customer / Company Name'],
                  ['Phone','custPhone','tel','10-digit mobile'],
                  ['Address','custAddress','text','City / Address'],
                  ['Event Type','eventType','text','e.g. Wedding, Corporate'],
                  ['No. of Pax','pax','number','Number of guests']].map(([label,key,type,ph]) => (
                  <div key={key}>
                    <div style={{ fontSize:10, color:'var(--ink2)', marginBottom:2 }}>{label}</div>
                    <input type={type} placeholder={ph} value={form[key]} onChange={e => setF(key,e.target.value)}
                      style={{ width:'100%', padding:'6px 10px', borderRadius:7, border:'1.5px solid var(--border)', fontSize:12, background:'var(--bg)', color:'var(--ink)', boxSizing:'border-box' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Quote meta */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink2)', textTransform:'uppercase', marginBottom:6 }}>📅 Quote Details</div>
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'var(--ink2)', marginBottom:2 }}>Date</div>
                  <input type="date" value={form.quoteDate} onChange={e => setF('quoteDate',e.target.value)}
                    style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1.5px solid var(--border)', fontSize:12, background:'var(--bg)', color:'var(--ink)', boxSizing:'border-box' }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'var(--ink2)', marginBottom:2 }}>Valid (days)</div>
                  <input type="number" value={form.validDays} min="1" onChange={e => setF('validDays',e.target.value)}
                    style={{ width:'100%', padding:'6px 8px', borderRadius:7, border:'1.5px solid var(--border)', fontSize:12, background:'var(--bg)', color:'var(--ink)', boxSizing:'border-box' }} />
                </div>
              </div>
              {form.quoteDate && <div style={{ fontSize:11, color:'var(--ink2)', marginTop:4 }}>Valid till: <strong>{addDays(form.quoteDate, form.validDays)}</strong></div>}
            </div>

            {/* Cart items */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink2)', textTransform:'uppercase', marginBottom:6 }}>
                🍽️ Items {cart.length>0 && `(${cart.length})`}
              </div>
              {cart.length===0
                ? <div style={{ textAlign:'center', padding:'18px 0', color:'var(--ink2)', fontSize:13 }}>Tap menu items to add</div>
                : cart.map(c => (
                  <div key={c.menu_item_id} style={{ marginBottom:8, padding:'8px 10px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:11 }}>{c.is_veg?'🟢':'🔴'}</span>
                      <span style={{ flex:1, fontWeight:700, fontSize:13 }}>{c.name}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                        <button onClick={() => setQty(c.menu_item_id,c.qty-1)} style={{ width:22,height:22,borderRadius:5,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:14,color:'#e84a5f' }}>−</button>
                        <span style={{ width:22,textAlign:'center',fontWeight:800,fontSize:13 }}>{c.qty}</span>
                        <button onClick={() => setQty(c.menu_item_id,c.qty+1)} style={{ width:22,height:22,borderRadius:5,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:14,color:'#1db97e' }}>+</button>
                      </div>
                      <span style={{ fontWeight:700,fontSize:12,minWidth:60,textAlign:'right' }}>{fmtCur(c.price*c.qty)}</span>
                    </div>
                    <input placeholder="Item note…" value={c.notes} onChange={e => setItemNotes(c.menu_item_id,e.target.value)}
                      style={{ width:'100%',padding:'4px 8px',borderRadius:5,border:'1px solid var(--border)',fontSize:11,background:'var(--surface)',color:'var(--ink2)',boxSizing:'border-box' }} />
                  </div>
                ))}
            </div>

            {/* Discount */}
            {cart.length>0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11,fontWeight:700,color:'var(--ink2)',textTransform:'uppercase',marginBottom:6 }}>🏷️ Discount</div>
                <div style={{ display:'flex',gap:6,marginBottom:6 }}>
                  {[['none','None'],['percentage','% Off'],['amount','₹ Off']].map(([v,l]) => (
                    <button key={v} onClick={() => { setF('discType',v); setF('discVal',''); }}
                      style={{ flex:1,padding:'5px 0',borderRadius:7,border:'1.5px solid',fontSize:11,fontWeight:700,cursor:'pointer',
                        background:form.discType===v?'var(--accent)':'transparent',
                        color:form.discType===v?'#fff':'var(--ink2)',
                        borderColor:form.discType===v?'var(--accent)':'var(--border)' }}>{l}</button>
                  ))}
                </div>
                {form.discType!=='none' && (
                  <input type="number" placeholder={form.discType==='percentage'?'Discount %':'Discount ₹'}
                    value={form.discVal} onChange={e => setF('discVal',e.target.value)}
                    style={{ width:'100%',padding:'6px 10px',borderRadius:7,border:'1.5px solid var(--border)',fontSize:12,background:'var(--bg)',color:'var(--ink)',boxSizing:'border-box' }} />
                )}
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10,color:'var(--ink2)',marginBottom:2 }}>Additional Notes / Terms</div>
              <textarea rows={3} placeholder="e.g. 50% advance required, price valid 7 days…"
                value={form.notes} onChange={e => setF('notes',e.target.value)}
                style={{ width:'100%',padding:'7px 10px',borderRadius:7,border:'1.5px solid var(--border)',fontSize:12,background:'var(--bg)',color:'var(--ink)',resize:'vertical',boxSizing:'border-box' }} />
            </div>

            {/* Totals */}
            {cart.length>0 && (
              <div style={{ background:'var(--bg)',borderRadius:10,padding:'12px',marginBottom:8 }}>
                {[['Subtotal',fmtCur(subtotal),'var(--ink)'],
                  totalGst>0    && ['GST',fmtCur(totalGst),'var(--ink2)'],
                  discountAmt>0 && ['Discount',`−${fmtCur(discountAmt)}`,'#e84a5f'],
                ].filter(Boolean).map(([l,v,c]) => (
                  <div key={l} style={{ display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0',color:'var(--ink2)' }}>
                    <span>{l}</span><span style={{ color:c }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop:'1.5px solid var(--border)',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:16 }}>
                  <span>Grand Total</span><span style={{ color:'var(--accent)' }}>{fmtCur(finalTotal)}</span>
                </div>
                {form.pax>0 && <div style={{ textAlign:'right',fontSize:11,color:'var(--ink2)',marginTop:4 }}>Per person ({form.pax} pax): <strong style={{ color:'var(--accent)' }}>{fmtCur(perPax)}</strong></div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden print ref */}
      <div ref={printRef} style={{ display:'none' }}>
        <QuotationPrint
          quoteNum={'QT-PREVIEW'} quoteDate={form.quoteDate} validDays={form.validDays}
          custName={form.custName} custPhone={form.custPhone} custAddress={form.custAddress}
          eventType={form.eventType} pax={form.pax}
          cart={cart} subtotal={subtotal} totalGst={totalGst}
          discountAmt={discountAmt} finalTotal={finalTotal} perPax={perPax}
          notes={form.notes} settings={settings}
        />
      </div>

      {/* Builder preview modal */}
      {previewQuote === '__builder__' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
          onClick={() => setPreviewQuote(null)}>
          <div style={{ background:'#fff',borderRadius:16,maxWidth:720,width:'100%',maxHeight:'92vh',overflow:'auto',color:'#1a1a1a' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid #eee',position:'sticky',top:0,background:'#fff',zIndex:1 }}>
              <div style={{ fontWeight:800,fontSize:16 }}>Quotation Preview</div>
              <div style={{ display:'flex',gap:8 }}>
                <button onClick={() => doPrint(null)} style={{ padding:'7px 16px',borderRadius:8,border:'none',background:'#f97316',color:'#fff',fontWeight:700,cursor:'pointer' }}>🖨 Print</button>
                <button onClick={() => setPreviewQuote(null)} style={{ padding:'7px 14px',borderRadius:8,border:'1px solid #ccc',background:'transparent',cursor:'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ padding:24 }}>
              <QuotationPrint
                quoteNum={'QT-PREVIEW'} quoteDate={form.quoteDate} validDays={form.validDays}
                custName={form.custName} custPhone={form.custPhone} custAddress={form.custAddress}
                eventType={form.eventType} pax={form.pax}
                cart={cart} subtotal={subtotal} totalGst={totalGst}
                discountAmt={discountAmt} finalTotal={finalTotal} perPax={perPax}
                notes={form.notes} settings={settings}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
