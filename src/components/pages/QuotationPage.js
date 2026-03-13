import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getMenuItemsAll, getCourses, getSettings,
  getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation,
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
  return <span style={{ background:s.bg, color:s.color, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{s.label}</span>;
}

// ── PDF-style Quotation Print Layout (matches uploaded design) ─────
function QuotationPrint({ quoteNum, quoteDate, validDays, custName, custPhone, custAddress,
                          custEmail, eventType, pax, cart, subtotal, totalGst, discountAmt,
                          finalTotal, perPax, notes, settings }) {
  const purple = '#7c3aed';
  const lightPurple = '#f5f0ff';

  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", fontSize:13, color:'#1a1a1a', maxWidth:700, margin:'0 auto', background:'#fff', padding:'32px 36px' }}>

      {/* Footer note at top like PDF */}
      <div style={{ fontSize:10, color:'#999', textAlign:'center', marginBottom:16 }}>
        This is an electronically generated document, no signature is required.
      </div>

      {/* Header: Title + Logo */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:32, fontWeight:800, color:purple, marginBottom:16 }}>Quotation</div>
          <table style={{ borderCollapse:'collapse', fontSize:13 }}>
            <tbody>
              <tr>
                <td style={{ color:'#888', paddingRight:24, paddingBottom:6, whiteSpace:'nowrap' }}>Quotation No #</td>
                <td style={{ fontWeight:700, paddingBottom:6 }}>{quoteNum}</td>
              </tr>
              <tr>
                <td style={{ color:'#888', paddingRight:24, paddingBottom:6 }}>Quotation Date</td>
                <td style={{ fontWeight:700, paddingBottom:6 }}>{fmtDate(quoteDate)}</td>
              </tr>
              <tr>
                <td style={{ color:'#888', paddingRight:24 }}>Valid Till Date</td>
                <td style={{ fontWeight:700 }}>{addDays(quoteDate, validDays)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Logo or restaurant name as styled badge */}
        <div style={{ textAlign:'right' }}>
          {settings.logo_url
            ? <img src={settings.logo_url} alt="logo" style={{ maxHeight:80, maxWidth:160, objectFit:'contain' }} />
            : (
              <div style={{ background:purple, borderRadius:12, padding:'14px 20px', textAlign:'center', minWidth:120 }}>
                <div style={{ color:'#fff', fontWeight:900, fontSize:18, letterSpacing:1 }}>{settings.restaurant_name || 'Restaurant'}</div>
                {settings.tagline && <div style={{ color:'rgba(255,255,255,.7)', fontSize:10, marginTop:4 }}>{settings.tagline}</div>}
              </div>
            )
          }
        </div>
      </div>

      {/* From / For boxes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:28 }}>
        {/* Quotation From */}
        <div style={{ background:lightPurple, borderRadius:8, padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:purple, marginBottom:10 }}>Quotation From</div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{settings.restaurant_name || 'Restaurant'}</div>
          {settings.address && <div style={{ fontSize:12, color:'#555', lineHeight:1.6 }}>{settings.address}</div>}
          {settings.email && <div style={{ fontSize:12, color:'#555', marginTop:4 }}><strong>Email:</strong> {settings.email}</div>}
          {settings.phone && <div style={{ fontSize:12, color:'#555' }}><strong>Phone:</strong> {settings.phone}</div>}
          {settings.gst_number && <div style={{ fontSize:12, color:'#555' }}><strong>GST:</strong> {settings.gst_number}</div>}
        </div>

        {/* Quotation For */}
        <div style={{ background:lightPurple, borderRadius:8, padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:purple, marginBottom:10 }}>Quotation For</div>
          {custName    && <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{custName}</div>}
          {custAddress && <div style={{ fontSize:12, color:'#555', lineHeight:1.6 }}>{custAddress}</div>}
          {custPhone   && <div style={{ fontSize:12, color:'#555', marginTop:4 }}><strong>Phone:</strong> {custPhone}</div>}
          {custEmail   && <div style={{ fontSize:12, color:'#555' }}><strong>Email:</strong> {custEmail}</div>}
          {eventType   && <div style={{ fontSize:12, color:'#555', marginTop:4 }}><strong>Event:</strong> {eventType}</div>}
          {pax         && <div style={{ fontSize:12, color:'#555' }}><strong>Guests:</strong> {pax}</div>}
          {!custName && !custAddress && <div style={{ fontSize:12, color:'#bbb' }}>—</div>}
        </div>
      </div>

      {/* Items table */}
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:20 }}>
        <thead>
          <tr style={{ background:purple }}>
            <th style={{ padding:'10px 14px', textAlign:'left',  color:'#fff', fontSize:12, fontWeight:700, width:36 }}></th>
            <th style={{ padding:'10px 14px', textAlign:'left',  color:'#fff', fontSize:12, fontWeight:700 }}>Item</th>
            <th style={{ padding:'10px 14px', textAlign:'right', color:'#fff', fontSize:12, fontWeight:700, width:80 }}>Quantity</th>
            <th style={{ padding:'10px 14px', textAlign:'right', color:'#fff', fontSize:12, fontWeight:700, width:90 }}>Rate</th>
            <th style={{ padding:'10px 14px', textAlign:'right', color:'#fff', fontSize:12, fontWeight:700, width:110 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item, i) => (
            <tr key={item.menu_item_id||i} style={{ borderBottom:'1px solid #eee' }}>
              <td style={{ padding:'10px 14px', color:'#999', fontSize:12, verticalAlign:'top' }}>{i+1}.</td>
              <td style={{ padding:'10px 14px', verticalAlign:'top' }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{item.name||item.item_name}</div>
                {item.notes && (
                  <div style={{ marginTop:4 }}>
                    {item.notes.split('\n').map((line, j) => (
                      <div key={j} style={{ fontSize:12, color:'#666', paddingLeft:8 }}>{line}</div>
                    ))}
                  </div>
                )}
                {(item.gst_pct||item.gst_percent||0) > 0 &&
                  <div style={{ fontSize:11, color:purple, marginTop:2 }}>+{item.gst_pct||item.gst_percent}% GST</div>}
              </td>
              <td style={{ padding:'10px 14px', textAlign:'right', verticalAlign:'top', fontSize:13 }}>{item.qty||item.quantity}</td>
              <td style={{ padding:'10px 14px', textAlign:'right', verticalAlign:'top', color:'#555', fontSize:13 }}>₹{parseFloat(item.price||item.unit_price).toLocaleString('en-IN')}</td>
              <td style={{ padding:'10px 14px', textAlign:'right', verticalAlign:'top', fontWeight:600, fontSize:13 }}>₹{((item.price||item.unit_price)*(item.qty||item.quantity)).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals — right aligned like PDF */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:24 }}>
        <table style={{ borderCollapse:'collapse', minWidth:280 }}>
          <tbody>
            {subtotal !== finalTotal && (
              <tr>
                <td style={{ padding:'5px 14px', color:'#666', fontSize:13 }}>Subtotal</td>
                <td style={{ padding:'5px 14px', textAlign:'right', fontSize:13 }}>₹{subtotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
              </tr>
            )}
            {totalGst > 0 && (
              <tr>
                <td style={{ padding:'5px 14px', color:'#666', fontSize:13 }}>GST</td>
                <td style={{ padding:'5px 14px', textAlign:'right', fontSize:13 }}>₹{totalGst.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
              </tr>
            )}
            {discountAmt > 0 && (
              <tr>
                <td style={{ padding:'5px 14px', color:'#e84a5f', fontSize:13 }}>Discount</td>
                <td style={{ padding:'5px 14px', textAlign:'right', color:'#e84a5f', fontSize:13 }}>−₹{discountAmt.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
              </tr>
            )}
            <tr style={{ borderTop:'2px solid #1a1a1a' }}>
              <td style={{ padding:'10px 14px', fontWeight:800, fontSize:15 }}>Total (INR)</td>
              <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:800, fontSize:15 }}>₹{finalTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
            </tr>
            {pax > 0 && (
              <tr>
                <td style={{ padding:'4px 14px', color:'#888', fontSize:12 }}>Per person ({pax} pax)</td>
                <td style={{ padding:'4px 14px', textAlign:'right', color:'#888', fontSize:12 }}>₹{perPax.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Terms / Notes */}
      {notes && (
        <div style={{ borderTop:'1px solid #eee', paddingTop:16, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:6 }}>Terms & Notes</div>
          <div style={{ fontSize:12, color:'#666', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{notes}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop:'1px solid #eee', paddingTop:12, textAlign:'center', fontSize:10, color:'#999', marginTop:8 }}>
        This is an electronically generated document, no signature is required.
      </div>
    </div>
  );
}

function blankForm() {
  return { custName:'', custPhone:'', custEmail:'', custAddress:'', eventType:'', pax:'',
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

  // 'list' | 'new' | 'edit'
  const [mode,      setMode]      = useState('list');
  const [editingId, setEditingId] = useState(null);

  const [form,   setForm]   = useState(blankForm);
  const [cart,   setCart]   = useState([]);
  const [search, setSearch] = useState('');
  const [courseFilter, setCF] = useState('all');
  const [saving, setSaving] = useState(false);

  // null | '__builder__' | quotation-object
  const [previewQuote, setPreviewQuote] = useState(null);

  // ── Load ───────────────────────────────────────────────
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
      else toast(r.message || 'Failed to load quotations', 'er');
    } catch(err) {
      toast(err?.response?.data?.message || err?.message || 'Failed to load quotations', 'er');
    } finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadMaster(); loadList(); }, [loadMaster, loadList]);

  // ── Cart ───────────────────────────────────────────────
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

  // ── Open Edit ──────────────────────────────────────────
  const openEdit = async (q) => {
    try {
      const r = await getQuotation(q.id);
      if (!r.success) { toast('Failed to load quotation', 'er'); return; }
      const full = r.data;
      setForm({
        custName:    full.customer_name    || '',
        custPhone:   full.customer_phone   || '',
        custEmail:   full.customer_email   || '',
        custAddress: full.customer_address || '',
        eventType:   '',
        pax:         '',
        quoteDate:   full.date || todayStr(),
        validDays:   '7',
        notes:       full.notes || '',
        discType:    full.discount_type  || 'none',
        discVal:     full.discount_value || '',
      });
      setCart((full.items||[]).map(i => ({
        menu_item_id: i.menu_item_id || i.id,
        name:         i.item_name,
        price:        parseFloat(i.unit_price),
        gst_pct:      parseFloat(i.gst_percent)||0,
        qty:          i.quantity,
        notes:        i.notes || '',
        is_veg:       true,
      })));
      setEditingId(full.id);
      setMode('edit');
    } catch(err) {
      toast(err?.response?.data?.message || 'Failed to load', 'er');
    }
  };

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
      const payload = {
        customer_name:    form.custName.trim(),
        customer_phone:   form.custPhone   || null,
        customer_email:   form.custEmail   || null,
        customer_address: form.custAddress || null,
        notes: [
          form.eventType && `Event: ${form.eventType}`,
          form.pax       && `Pax: ${form.pax}`,
          form.notes,
        ].filter(Boolean).join('\n') || null,
        valid_until:   validUntilDate,
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
      };

      let r;
      if (mode === 'edit' && editingId) {
        r = await updateQuotation(editingId, payload);
        if (r.success) toast('Quotation updated! ✅', 'ok');
      } else {
        r = await createQuotation(payload);
        if (r.success) toast(`${r.data.quotation_number} saved! ✅`, 'ok');
      }

      if (r.success) {
        await loadList();
        setMode('list');
        setCart([]);
        setForm(blankForm());
        setEditingId(null);
      } else {
        toast(r.message || 'Failed to save', 'er');
      }
    } catch(err) {
      toast(err?.response?.data?.message || 'Error saving', 'er');
    } finally { setSaving(false); }
  };

  // ── Preview saved quote (fetch full record with items) ─
  const openPreview = async (q) => {
    try {
      const r = await getQuotation(q.id);
      if (!r.success) { toast('Failed to load quotation', 'er'); return; }
      setPreviewQuote(r.data);
    } catch(err) {
      toast(err?.response?.data?.message || 'Failed to load', 'er');
    }
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
  const buildPrintHtml = (props) => {
    const { quoteNum, quoteDate, validDays, custName, custPhone, custEmail, custAddress,
            eventType, pax, cart: c, subtotal: sub, totalGst: gst, discountAmt: disc,
            finalTotal: tot, perPax: pp, notes, settings: s } = props;
    const purple = '#7c3aed';
    const lightPurple = '#f5f0ff';
    const validTill = addDays(quoteDate, validDays);
    const rows = c.map((item, i) => `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:10px 14px;color:#999;font-size:12px;vertical-align:top">${i+1}.</td>
        <td style="padding:10px 14px;vertical-align:top">
          <div style="font-weight:600;font-size:13px">${item.name||item.item_name}</div>
          ${item.notes ? item.notes.split('\n').map(l=>`<div style="font-size:12px;color:#666;padding-left:8px">${l}</div>`).join('') : ''}
          ${(item.gst_pct||item.gst_percent||0)>0 ? `<div style="font-size:11px;color:${purple};margin-top:2px">+${item.gst_pct||item.gst_percent}% GST</div>` : ''}
        </td>
        <td style="padding:10px 14px;text-align:right;vertical-align:top;font-size:13px">${item.qty||item.quantity}</td>
        <td style="padding:10px 14px;text-align:right;vertical-align:top;color:#555;font-size:13px">₹${parseFloat(item.price||item.unit_price).toLocaleString('en-IN')}</td>
        <td style="padding:10px 14px;text-align:right;vertical-align:top;font-weight:600;font-size:13px">₹${((item.price||item.unit_price)*(item.qty||item.quantity)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      </tr>`).join('');

    const subtotalRow = sub !== tot ? `<tr><td style="padding:5px 14px;color:#666;font-size:13px">Subtotal</td><td style="padding:5px 14px;text-align:right;font-size:13px">₹${sub.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>` : '';
    const gstRow = gst>0 ? `<tr><td style="padding:5px 14px;color:#666;font-size:13px">GST</td><td style="padding:5px 14px;text-align:right;font-size:13px">₹${gst.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>` : '';
    const discRow = disc>0 ? `<tr><td style="padding:5px 14px;color:#e84a5f;font-size:13px">Discount</td><td style="padding:5px 14px;text-align:right;color:#e84a5f;font-size:13px">−₹${disc.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>` : '';
    const paxRow = pp>0 ? `<tr><td style="padding:4px 14px;color:#888;font-size:12px">Per person (${pax} pax)</td><td style="padding:4px 14px;text-align:right;color:#888;font-size:12px">₹${pp.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>` : '';

    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a1a;max-width:700px;margin:0 auto;background:#fff;padding:32px 36px">
        <div style="font-size:10px;color:#999;text-align:center;margin-bottom:16px">This is an electronically generated document, no signature is required.</div>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
          <div>
            <div style="font-size:32px;font-weight:800;color:${purple};margin-bottom:16px">Quotation</div>
            <table style="border-collapse:collapse;font-size:13px">
              <tr><td style="color:#888;padding-right:24px;padding-bottom:6px">Quotation No #</td><td style="font-weight:700;padding-bottom:6px">${quoteNum}</td></tr>
              <tr><td style="color:#888;padding-right:24px;padding-bottom:6px">Quotation Date</td><td style="font-weight:700;padding-bottom:6px">${fmtDate(quoteDate)}</td></tr>
              <tr><td style="color:#888;padding-right:24px">Valid Till Date</td><td style="font-weight:700">${validTill}</td></tr>
            </table>
          </div>
          <div style="background:${purple};border-radius:12px;padding:14px 20px;text-align:center;min-width:120px">
            <div style="color:#fff;font-weight:900;font-size:18px;letter-spacing:1px">${s.restaurant_name||'Restaurant'}</div>
            ${s.tagline ? `<div style="color:rgba(255,255,255,.7);font-size:10px;margin-top:4px">${s.tagline}</div>` : ''}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px">
          <div style="background:${lightPurple};border-radius:8px;padding:16px 18px">
            <div style="font-size:13px;font-weight:700;color:${purple};margin-bottom:10px">Quotation From</div>
            <div style="font-weight:700;font-size:14px;margin-bottom:6px">${s.restaurant_name||'Restaurant'}</div>
            ${s.address ? `<div style="font-size:12px;color:#555;line-height:1.6">${s.address}</div>` : ''}
            ${s.email   ? `<div style="font-size:12px;color:#555;margin-top:4px"><strong>Email:</strong> ${s.email}</div>` : ''}
            ${s.phone   ? `<div style="font-size:12px;color:#555"><strong>Phone:</strong> ${s.phone}</div>` : ''}
            ${s.gst_number ? `<div style="font-size:12px;color:#555"><strong>GST:</strong> ${s.gst_number}</div>` : ''}
          </div>
          <div style="background:${lightPurple};border-radius:8px;padding:16px 18px">
            <div style="font-size:13px;font-weight:700;color:${purple};margin-bottom:10px">Quotation For</div>
            ${custName    ? `<div style="font-weight:700;font-size:14px;margin-bottom:6px">${custName}</div>` : ''}
            ${custAddress ? `<div style="font-size:12px;color:#555;line-height:1.6">${custAddress}</div>` : ''}
            ${custPhone   ? `<div style="font-size:12px;color:#555;margin-top:4px"><strong>Phone:</strong> ${custPhone}</div>` : ''}
            ${custEmail   ? `<div style="font-size:12px;color:#555"><strong>Email:</strong> ${custEmail}</div>` : ''}
            ${eventType   ? `<div style="font-size:12px;color:#555;margin-top:4px"><strong>Event:</strong> ${eventType}</div>` : ''}
            ${pax         ? `<div style="font-size:12px;color:#555"><strong>Guests:</strong> ${pax}</div>` : ''}
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr style="background:${purple}">
              <th style="padding:10px 14px;text-align:left;color:#fff;font-size:12px;font-weight:700;width:36px"></th>
              <th style="padding:10px 14px;text-align:left;color:#fff;font-size:12px;font-weight:700">Item</th>
              <th style="padding:10px 14px;text-align:right;color:#fff;font-size:12px;font-weight:700;width:80px">Quantity</th>
              <th style="padding:10px 14px;text-align:right;color:#fff;font-size:12px;font-weight:700;width:90px">Rate</th>
              <th style="padding:10px 14px;text-align:right;color:#fff;font-size:12px;font-weight:700;width:110px">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
          <table style="border-collapse:collapse;min-width:280px">
            <tbody>
              ${subtotalRow}${gstRow}${discRow}
              <tr style="border-top:2px solid #1a1a1a">
                <td style="padding:10px 14px;font-weight:800;font-size:15px">Total (INR)</td>
                <td style="padding:10px 14px;text-align:right;font-weight:800;font-size:15px">₹${tot.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
              </tr>
              ${paxRow}
            </tbody>
          </table>
        </div>

        ${notes ? `<div style="border-top:1px solid #eee;padding-top:16px;margin-bottom:16px"><div style="font-size:12px;font-weight:700;color:#555;margin-bottom:6px">Terms &amp; Notes</div><div style="font-size:12px;color:#666;line-height:1.7;white-space:pre-wrap">${notes}</div></div>` : ''}

        <div style="border-top:1px solid #eee;padding-top:12px;text-align:center;font-size:10px;color:#999;margin-top:8px">
          This is an electronically generated document, no signature is required.
        </div>
      </div>`;
  };

  const doPrint = (savedQ) => {
    const win = window.open('', '_blank', 'width=800,height:1000');
    if (!win) { toast('Allow popups to print', 'er'); return; }
    let html;
    if (savedQ && savedQ !== '__builder__') {
      html = buildPrintHtml({
        quoteNum:    savedQ.quotation_number,
        quoteDate:   savedQ.date || savedQ.created_at?.slice(0,10),
        validDays:   7,
        custName:    savedQ.customer_name,
        custPhone:   savedQ.customer_phone,
        custEmail:   savedQ.customer_email,
        custAddress: savedQ.customer_address,
        eventType:   null, pax: null,
        cart: (savedQ.items||[]).map(i => ({
          menu_item_id: i.menu_item_id, name: i.item_name,
          price: parseFloat(i.unit_price), gst_pct: parseFloat(i.gst_percent)||0,
          qty: i.quantity, notes: i.notes,
        })),
        subtotal:    parseFloat(savedQ.subtotal)||0,
        totalGst:    parseFloat(savedQ.gst_amount)||0,
        discountAmt: parseFloat(savedQ.discount_amount)||0,
        finalTotal:  parseFloat(savedQ.total_amount)||0,
        perPax: 0, notes: savedQ.notes, settings,
      });
    } else {
      html = buildPrintHtml({
        quoteNum: 'QT-PREVIEW', quoteDate: form.quoteDate, validDays: form.validDays,
        custName: form.custName, custPhone: form.custPhone, custEmail: form.custEmail,
        custAddress: form.custAddress, eventType: form.eventType, pax: form.pax,
        cart, subtotal, totalGst, discountAmt, finalTotal, perPax,
        notes: form.notes, settings,
      });
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Quotation</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; }
        @media print { @page { margin: 10mm; size: A4; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>${html}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
  };

  const setF = (k,v) => setForm(prev => ({...prev,[k]:v}));

  // ═══════════════════════════════════════════════════════
  // LIST VIEW
  if (mode === 'list') return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">📋 Quotations</div>
          <div className="ps">Create, manage and print customer quotations</div>
        </div>
        <button className="btn-p" onClick={() => { setCart([]); setForm(blankForm()); setEditingId(null); setMode('new'); }}
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
                      <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
                        <button onClick={() => openPreview(q)}
                          style={{ padding:'5px 10px', borderRadius:7, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:12, color:'var(--ink2)' }}>
                          👁
                        </button>
                        <button onClick={() => openEdit(q)}
                          style={{ padding:'5px 10px', borderRadius:7, border:'1.5px solid #a78bfa', background:'transparent', cursor:'pointer', fontSize:12, color:'#7c3aed' }}>
                          ✏️ Edit
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

      {/* View saved quote modal */}
      {previewQuote && previewQuote !== '__builder__' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setPreviewQuote(null)}>
          <div style={{ background:'#fff', borderRadius:16, maxWidth:760, width:'100%', maxHeight:'92vh', overflow:'auto', color:'#1a1a1a' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid #eee', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>{previewQuote.quotation_number}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => doPrint(previewQuote)}
                  style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}>🖨 Print</button>
                <button onClick={() => setPreviewQuote(null)}
                  style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #ccc', background:'transparent', cursor:'pointer' }}>✕</button>
              </div>
            </div>
            <QuotationPrint
              quoteNum={previewQuote.quotation_number}
              quoteDate={previewQuote.date||previewQuote.created_at?.slice(0,10)}
              validDays={7}
              custName={previewQuote.customer_name} custPhone={previewQuote.customer_phone}
              custEmail={previewQuote.customer_email} custAddress={previewQuote.customer_address}
              eventType={null} pax={null}
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
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // NEW / EDIT BUILDER
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)', overflow:'hidden' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1.5px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => { setMode('list'); setCart([]); setForm(blankForm()); setEditingId(null); }}
            style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:12, color:'var(--ink2)' }}>
            ← Back
          </button>
          <div style={{ fontWeight:800, fontSize:15 }}>
            {mode==='edit' ? '✏️ Edit Quotation' : '📋 New Quotation'}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {cart.length > 0 && (
            <button onClick={() => setPreviewQuote('__builder__')}
              style={{ padding:'7px 14px', borderRadius:9, border:'1.5px solid #a78bfa', background:'transparent', color:'#7c3aed', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              👁 Preview
            </button>
          )}
          <button onClick={saveQuotation} disabled={saving || !cart.length}
            style={{ padding:'7px 20px', borderRadius:9, border:'none', background:cart.length?'var(--accent)':'#ccc', color:'#fff', fontWeight:700, fontSize:13, cursor:cart.length?'pointer':'not-allowed' }}>
            {saving ? '⏳ Saving…' : mode==='edit' ? '💾 Update' : '💾 Save'}
          </button>
          {cart.length > 0 && (
            <button onClick={() => doPrint(null)}
              style={{ padding:'7px 16px', borderRadius:9, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
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
                      style={{ background:'var(--surface)', border:`1.5px solid ${inCart?'var(--accent)':'var(--border)'}`, borderRadius:12, padding:'10px 10px 8px', cursor:'pointer', position:'relative' }}>
                      <div style={{ width:'100%', aspectRatio:'1', borderRadius:8, overflow:'hidden', marginBottom:6, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:22 }}>🍽️</span>}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, lineHeight:1.3, marginBottom:3 }}>{item.name}</div>
                      <div style={{ fontSize:11, color:'var(--accent)', fontWeight:800 }}>{fmtCur(item.selling_price)}</div>
                      {inCart && <div style={{ position:'absolute', top:5, right:5, background:'var(--accent)', color:'#fff', borderRadius:'50%', width:19, height:19, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>{inCart.qty}</div>}
                    </div>
                  );
                })}
          </div>
        </div>

        {/* RIGHT: Form */}
        <div style={{ width:380, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--surface)' }}>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>

            {/* Customer */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink2)', textTransform:'uppercase', marginBottom:6 }}>👤 Customer / Event</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[['Name *','custName','text','Customer / Company Name'],
                  ['Phone','custPhone','tel','10-digit mobile'],
                  ['Email','custEmail','email','customer@email.com'],
                  ['Address','custAddress','text','City / Full Address'],
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

            {/* Cart */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ink2)', textTransform:'uppercase', marginBottom:6 }}>🍽️ Items {cart.length>0&&`(${cart.length})`}</div>
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
                    <textarea rows={2} placeholder="Item note / sub-items (one per line)…" value={c.notes} onChange={e => setItemNotes(c.menu_item_id,e.target.value)}
                      style={{ width:'100%',padding:'4px 8px',borderRadius:5,border:'1px solid var(--border)',fontSize:11,background:'var(--surface)',color:'var(--ink2)',boxSizing:'border-box',resize:'vertical' }} />
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
              <div style={{ fontSize:10,color:'var(--ink2)',marginBottom:2 }}>Terms & Notes</div>
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

      {/* Builder preview modal */}
      {previewQuote === '__builder__' && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
          onClick={() => setPreviewQuote(null)}>
          <div style={{ background:'#fff',borderRadius:16,maxWidth:760,width:'100%',maxHeight:'92vh',overflow:'auto',color:'#1a1a1a' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid #eee',position:'sticky',top:0,background:'#fff',zIndex:1 }}>
              <div style={{ fontWeight:800,fontSize:16 }}>Quotation Preview</div>
              <div style={{ display:'flex',gap:8 }}>
                <button onClick={() => doPrint(null)} style={{ padding:'7px 16px',borderRadius:8,border:'none',background:'#7c3aed',color:'#fff',fontWeight:700,cursor:'pointer' }}>🖨 Print</button>
                <button onClick={() => setPreviewQuote(null)} style={{ padding:'7px 14px',borderRadius:8,border:'1px solid #ccc',background:'transparent',cursor:'pointer' }}>✕</button>
              </div>
            </div>
            <QuotationPrint
              quoteNum="QT-PREVIEW" quoteDate={form.quoteDate} validDays={form.validDays}
              custName={form.custName} custPhone={form.custPhone} custEmail={form.custEmail}
              custAddress={form.custAddress} eventType={form.eventType} pax={form.pax}
              cart={cart} subtotal={subtotal} totalGst={totalGst}
              discountAmt={discountAmt} finalTotal={finalTotal} perPax={perPax}
              notes={form.notes} settings={settings}
            />
          </div>
        </div>
      )}
    </div>
  );
}