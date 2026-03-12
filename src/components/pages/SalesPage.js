import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getTables, getMenuItems, createOrder, updateOrderItems, sendKOT,
         generateBill, markPaid, cancelOrder, getOrder, validateCoupon, getCoupons, getSettings,
         updateOrderItem, deleteOrderItem, reKot } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import { useWS, useWSEvent } from '../../context/WSContext';
import ConfirmModal from '../ui/ConfirmModal';

// ── Bill Print Component (rendered off-screen for PDF/print) ─────
// ── Real QR Code (SVG, no library) ──────────────────────────────
// Uses proper Reed-Solomon QR encoding for scannable codes
function QRCode({ value = '', size = 120 }) {
  const matrix = React.useMemo(() => buildQR(value), [value]);
  if (!matrix) return <div style={{ width:size, height:size, background:'#f5f5f5', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#999' }}>QR</div>;
  const n = matrix.length;
  const cell = size / (n + 8);
  const off  = cell * 4;
  return (
    <svg width={size} height={size} style={{ display:'block', background:'#fff', borderRadius:4 }}>
      {matrix.map((row, r) => row.map((dark, c) => dark ? (
        <rect key={`${r}-${c}`} x={off+c*cell} y={off+r*cell} width={cell} height={cell} fill="#000"/>
      ) : null))}
    </svg>
  );
}

/* Minimal QR Version 1-M encoder */
function buildQR(text) {
  try {
    // Encode as byte mode
    const bytes = [];
    for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0xff);

    // Data codewords for Version 1-M (16 data codewords, 10 EC codewords)
    const bits = [];
    const pushBits = (val, len) => { for (let i=len-1;i>=0;i--) bits.push((val>>i)&1); };

    pushBits(0b0100, 4);       // byte mode
    pushBits(bytes.length, 8); // char count
    bytes.forEach(b => pushBits(b, 8));

    // Terminator
    for (let i=0;i<4&&bits.length<128;i++) bits.push(0);
    while (bits.length%8) bits.push(0);
    const pads=[0xEC,0x11]; let pi=0;
    while (bits.length<128) { pushBits(pads[pi%2],8); pi++; }

    // Bytes from bits
    const data = [];
    for (let i=0;i<16;i++) { let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i*8+j]; data.push(b); }

    // Reed-Solomon EC (generator poly for 10 EC codewords)
    const gen=[251,67,46,61,118,70,64,94,32,45];
    const ec=[...data];
    for (let i=0;i<16;i++) {
      const c=ec.shift(); ec.push(0);
      if(c) for(let j=0;j<10;j++) ec[j]^=gfMul(gen[j],c);
    }
    const codewords=[...data,...ec.slice(0,10)];

    // Place in 21x21 matrix
    const N=21;
    const M=Array.from({length:N},()=>Array(N).fill(null)); // null=unfilled
    const F=Array.from({length:N},()=>Array(N).fill(false)); // function modules

    const setFinder=(r,c)=>{
      for(let dr=-1;dr<=7;dr++) for(let dc=-1;dc<=7;dc++) {
        const nr=r+dr, nc=c+dc;
        if(nr<0||nr>=N||nc<0||nc>=N) continue;
        F[nr][nc]=true;
        const dark=(dr>=0&&dr<=6&&dc>=0&&dc<=6)&&(dr===0||dr===6||dc===0||dc===6||(dr>=2&&dr<=4&&dc>=2&&dc<=4));
        M[nr][nc]=dark;
      }
    };
    setFinder(0,0); setFinder(0,14); setFinder(14,0);

    // Separators already covered; timing patterns
    for(let i=8;i<13;i++) { M[6][i]=i%2===0; M[i][6]=i%2===0; F[6][i]=true; F[i][6]=true; }

    // Dark module
    M[13][8]=true; F[13][8]=true;

    // Format info (mask 0, level M = 101010000010010)
    const fmt=[1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];
    const fmtPos=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    fmtPos.forEach(([r,c],i)=>{ M[r][c]=fmt[i]?true:false; F[r][c]=true; });
    const fmtPos2=[[8,13],[8,14],[8,15],[8,16],[8,17],[8,18],[8,19],[8,20],[13,8],[14,8],[15,8],[16,8],[17,8],[18,8],[19,8]];
    fmtPos2.forEach(([r,c],i)=>{ M[r][c]=fmt[i]?true:false; F[r][c]=true; });

    // Data placement (zigzag, mask 0: (r+c)%2===0)
    let bit=0; const cw=codewords;
    let cwBits=[];
    cw.forEach(b=>{ for(let i=7;i>=0;i--) cwBits.push((b>>i)&1); });

    let up=true, col=N-1;
    while(col>0) {
      if(col===6) col--;
      for(let row=0;row<N;row++) {
        const r=up?N-1-row:row;
        for(let dc=0;dc<2;dc++) {
          const c=col-dc;
          if(!F[r][c] && bit<cwBits.length) {
            const raw=cwBits[bit++];
            // mask 0: invert if (r+c)%2===0
            M[r][c]=(r+c)%2===0 ? raw===0 : raw===1;
          }
        }
      }
      up=!up; col-=2;
    }

    // Fill any remaining nulls with false
    return M.map(row=>row.map(v=>v===null?false:v));
  } catch(e) {
    console.warn('QR build error:', e);
    return null;
  }
}

function gfMul(a,b) {
  if(a===0||b===0) return 0;
  const LOG=[]; const EXP=[];
  let x=1;
  for(let i=0;i<255;i++) { EXP[i]=x; LOG[x]=i; x<<=1; if(x&256) x^=285; }
  return EXP[(LOG[a]+LOG[b])%255];
}


const BillPrint = React.forwardRef(({ order, settings = {} }, ref) => {
  const restaurantName = settings.restaurant_name || 'Tasteza Restaurant';
  if (!order) return null;
  const items    = order.items || [];
  const cur      = settings.currency_symbol || '₹';
  const color    = settings.primary_color   || '#000';
  const now      = new Date();
  const billDate = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const billTime = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

  return (
    <div ref={ref} style={{ fontFamily:'monospace', fontSize:12, width:300, padding:16, background:'#fff', color:'#000' }}>
      {/* Logo */}
      {settings.show_logo && settings.logo_base64 && (
        <div style={{ textAlign:'center', marginBottom:8 }}>
          <img src={settings.logo_base64} alt="logo" style={{ width: settings.logo_width||120, maxHeight:80, objectFit:'contain' }} />
        </div>
      )}
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:8 }}>
        <div style={{ fontSize:18, fontWeight:900, color }}>{restaurantName}</div>
        {settings.tagline    && <div style={{ fontSize:10, color:'#555', marginTop:2 }}>{settings.tagline}</div>}
        {settings.address    && <div style={{ fontSize:10, color:'#666', marginTop:2, whiteSpace:'pre-line' }}>{settings.address}</div>}
        {settings.phone      && <div style={{ fontSize:10, color:'#666' }}>📞 {settings.phone}</div>}
        {settings.email      && <div style={{ fontSize:10, color:'#666' }}>✉ {settings.email}</div>}
        {settings.gst_number   && <div style={{ fontSize:10, color:'#666' }}>GSTIN: {settings.gst_number}</div>}
        {settings.fssai_number && <div style={{ fontSize:10, color:'#666' }}>FSSAI: {settings.fssai_number}</div>}
        <div style={{ borderTop:'1px dashed #000', margin:'8px 0' }} />
      </div>
      {/* Bill Info */}
      <div style={{ fontSize:11, marginBottom:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span>Bill No: <strong>{order.order_number}</strong></span>
          <span>{billDate}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span>Table: {order.table_number || (order.order_type==='parcel'?'📦 Parcel':'Takeaway')}</span>
          <span>{billTime}</span>
        </div>
        {order.customer_name && <div>Customer: {order.customer_name} {order.customer_phone?`(${order.customer_phone})`:''}</div>}
      </div>
      <div style={{ borderTop:'1px dashed #000', margin:'6px 0' }} />
      {/* Items */}
      <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
        <thead><tr style={{ borderBottom:'1px dashed #000' }}>
          <th style={{ textAlign:'left', paddingBottom:4 }}>Item</th>
          <th style={{ textAlign:'center', width:30 }}>Qty</th>
          <th style={{ textAlign:'right', width:60 }}>Price</th>
          <th style={{ textAlign:'right', width:65 }}>Total</th>
        </tr></thead>
        <tbody>
          {items.map((item,i) => (
            <tr key={i}>
              <td style={{ paddingTop:3 }}>{item.item_name}</td>
              <td style={{ textAlign:'center' }}>{item.quantity}</td>
              <td style={{ textAlign:'right' }}>{cur}{parseFloat(item.unit_price).toFixed(2)}</td>
              <td style={{ textAlign:'right' }}>{cur}{parseFloat(item.unit_price*item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop:'1px dashed #000', margin:'6px 0' }} />
      {/* Totals */}
      <div style={{ fontSize:11 }}>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span>Subtotal</span><span>{cur}{parseFloat(order.subtotal||0).toFixed(2)}</span></div>
        {settings.show_gst_break && parseFloat(order.gst_amount)>0 && (
          <div style={{ display:'flex', justifyContent:'space-between' }}><span>GST</span><span>{cur}{parseFloat(order.gst_amount).toFixed(2)}</span></div>
        )}
        {parseFloat(order.discount_amount)>0 && (
          <div style={{ display:'flex', justifyContent:'space-between', color:'green' }}>
            <span>Discount {order.coupon_code?`(${order.coupon_code})`:''}</span>
            <span>-{cur}{parseFloat(order.discount_amount).toFixed(2)}</span>
          </div>
        )}
        <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:14 }}>
          <span>TOTAL</span><span>{cur}{parseFloat(order.total_amount||0).toFixed(2)}</span>
        </div>
        {order.payment_method && <div style={{ fontSize:10, color:'#666', marginTop:3 }}>Payment: {order.payment_method?.toUpperCase()}</div>}
      </div>
      {/* QR */}
      {settings.show_qr && (
        <div style={{ textAlign:'center', margin:'10px 0' }}>
          <QRCode value={`${order.order_number}|${restaurantName}|${cur}${parseFloat(order.total_amount||0).toFixed(2)}`} size={80} />
        </div>
      )}
      {/* Footer */}
      {settings.show_thank_you && (
        <div style={{ textAlign:'center', marginTop:8, fontSize:10, color:'#555' }}>
          <div style={{ borderTop:'1px dashed #000', paddingTop:6 }}>{settings.bill_footer||'Have a great day! 😊'}</div>
          {settings.website && <div style={{ marginTop:2 }}>{settings.website}</div>}
        </div>
      )}
    </div>
  );
});

export default function SalesPage() {
  const toast = useToast();
  const { connected } = useWS();
  const billRef       = useRef(null);
  const [billSettings, setBillSettings] = React.useState({});

  const [tables, setTables]     = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeView, setActiveView] = useState('tables'); // 'tables' | 'pos'

  // Table management
  const [tableModal, setTableModal] = useState(false);
  const [editTableModal, setEditTableModal] = useState(null);
  const [tableForm, setTableForm] = useState({ table_number: '', table_name: '', capacity: 4, section: 'Main Hall' });
  const [deleteTableModal, setDeleteTableModal] = useState(null);

  // POS state
  const [selectedTable, setSelectedTable] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [cart, setCart] = useState([]); // [{menu_item_id, item_name, quantity, unit_price, gst_percent, kot_instructions}]
  const [orderType, setOrderType] = useState('dine_in');
  const [kotInstructions, setKotInstructions] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCourse, setMenuCourse] = useState('');

  // Bill modal
  const [billModal, setBillModal] = useState(false);
  const [billForm, setBillForm] = useState({ customer_name: '', customer_phone: '', discount_type: '', discount_value: '', coupon_code: '', notes: '', payment_method: 'cash' });
  const [couponResult, setCouponResult] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [billOrder, setBillOrder] = useState(null); // final billed order for receipt

  // Receipt modal
  const [receiptModal, setReceiptModal] = useState(false);

  // KOT preview modal
  const [kotModal, setKotModal] = useState(false);
  const [kotInstModal, setKotInstModal] = useState('');

  // Cancel confirm
  const [cancelModal, setCancelModal] = useState(false);


  // ── Item-level edit / delete / re-KOT state ──────────────────────────────
  // inlineEdit: { itemId, field: 'quantity'|'notes', value } — editing directly on item row
  const [inlineEditId, setInlineEditId]     = useState(null); // which item row is open
  const [inlineQty, setInlineQty]           = useState(1);
  const [inlineNotes, setInlineNotes]       = useState('');
  const [inlineKotNote, setInlineKotNote]   = useState('');
  const [deleteItemModal, setDeleteItemModal] = useState(null);
  const [reKotModal, setReKotModal]         = useState(false);
  const [reKotForm, setReKotForm]           = useState({ reason: '', instructions: '', selectedIds: [] });
  const [itemWorking, setItemWorking]       = useState(false);
  const courses = useMemo(() => {
    const seen = {};
    menuItems.forEach(m => { if (m.course_id && !seen[m.course_id]) seen[m.course_id] = { id: m.course_id, name: m.course_name, icon: m.course_icon, color: m.course_color }; });
    return Object.values(seen);
  }, [menuItems]);

  const filteredMenu = useMemo(() => menuItems.filter(m => {
    if (menuCourse && m.course_id !== parseInt(menuCourse)) return false;
    if (menuSearch && !m.name.toLowerCase().includes(menuSearch.toLowerCase())) return false;
    return true;
  }), [menuItems, menuCourse, menuSearch]);

  // ── Load ──────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [t, m] = await Promise.all([getTables(), getMenuItems()]);
      if (t.success) setTables(t.data);
      if (m.success) setMenuItems(m.data);
    } finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    // Load bill settings once
    getSettings().then(r => { if (r.success && r.data) setBillSettings(r.data); }).catch(() => {});
  }, [load]);

  // ── Real-time WS sync ──────────────────────────────────
  useWSEvent('order_created',  () => { void load(true); });
  useWSEvent('order_updated',  () => { void load(true); });
  useWSEvent('order_paid',     () => { void load(true); });
  useWSEvent('order_cancelled',() => { void load(true); });
  useWSEvent('kot_status',     () => { void load(true); });
  useWSEvent('kot_new',        () => { void load(true); });

  // ── Table selection → open POS ─────────────────────────
  const openTable = async (table) => {
    setSelectedTable(table);
    setOrderType(table.order_id ? table.order_type || 'dine_in' : 'dine_in');
    setMenuSearch('');
    setMenuCourse('');
    setKotInstructions('');
    if (table.order_id) {
      try {
        const d = await getOrder(table.order_id);
        if (d.success) {
          setCurrentOrder(d.data);
          // Rebuild cart from order (un-KOT'd items)
          const pendingItems = d.data.items.filter(i => !i.kot_sent);
          setCart(pendingItems.map(i => ({
            menu_item_id: i.menu_item_id,
            item_name: i.item_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            gst_percent: i.gst_percent,
            kot_instructions: i.kot_instructions || '',
          })));
        }
      } catch {}
    } else {
      setCurrentOrder(null);
      setCart([]);
    }
    setActiveView('pos');
  };

  // ── Cart helpers ───────────────────────────────────────
  const addToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        menu_item_id: item.id,
        item_name: item.name,
        quantity: 1,
        unit_price: parseFloat(item.selling_price),
        gst_percent: parseFloat(item.gst_percent)||0,
        kot_instructions: '',
      }];
    });
  };

  const updateQty = (idx, qty) => {
    if (qty <= 0) { setCart(prev => prev.filter((_, i) => i !== idx)); return; }
    setCart(prev => { const n = [...prev]; n[idx] = { ...n[idx], quantity: qty }; return n; });
  };

  const updateKotNote = (idx, note) => {
    setCart(prev => { const n = [...prev]; n[idx] = { ...n[idx], kot_instructions: note }; return n; });
  };

  const removeFromCart = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));

  const cartSubtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const cartGst = cart.reduce((s, i) => s + i.unit_price * i.quantity * (i.gst_percent / 100), 0);
  const cartTotal = cartSubtotal + cartGst;

  // All items: KOT'd + cart
  const allOrderItems = currentOrder
    ? [...(currentOrder.items || []).filter(i => i.kot_sent), ...cart]
    : cart;
  const allSubtotal = allOrderItems.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
  const allGst = allOrderItems.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity * (parseFloat(i.gst_percent||0) / 100), 0);
  const allTotal = allSubtotal + allGst;

  // ── Save order / add items ─────────────────────────────
  const saveOrder = async () => {
    if (!cart.length) { toast('Add items first.', 'er'); return; }
    try {
      if (!currentOrder) {
        const d = await createOrder({ table_id: selectedTable?.id || null, order_type: orderType, items: cart, kot_instructions: kotInstructions });
        if (d.success) {
          toast('Order created! ✅', 'ok');
          await load();
          // Refresh
          const od = await getOrder(d.data.id);
          if (od.success) { setCurrentOrder(od.data); setCart([]); }
        } else toast(d.message, 'er');
      } else {
        const d = await updateOrderItems(currentOrder.id, { items: cart, kot_instructions: kotInstructions });
        if (d.success) {
          toast('Items updated! ✅', 'ok');
          const od = await getOrder(currentOrder.id);
          if (od.success) { setCurrentOrder(od.data); setCart([]); }
          await load();
        } else toast(d.message, 'er');
      }
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };


  // ── Inline item edit handlers ────────────────────────────────────────────
  const openInlineEdit = (item) => {
    setInlineEditId(item.id);
    setInlineQty(item.quantity);
    setInlineNotes(item.notes || '');
    setInlineKotNote(item.kot_instructions || '');
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
  };

  const saveInlineEdit = async (item) => {
    if (itemWorking) return;
    setItemWorking(true);
    try {
      const d = await updateOrderItem(currentOrder.id, item.id, {
        quantity: Math.max(1, parseInt(inlineQty) || 1),
        notes: inlineNotes,
        kot_instructions: inlineKotNote,
      });
      if (d.success) {
        toast('✅ Item updated', 'ok');
        setInlineEditId(null);
        const fresh = await getOrder(currentOrder.id);
        if (fresh.success) setCurrentOrder(fresh.data);
      } else toast(d.message || 'Update failed', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
    finally { setItemWorking(false); }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemModal) return;
    setItemWorking(true);
    try {
      const d = await deleteOrderItem(currentOrder.id, deleteItemModal.id);
      if (d.success) {
        toast('Item removed ✅', 'ok');
        setDeleteItemModal(null);
        setInlineEditId(null);
        const fresh = await getOrder(currentOrder.id);
        if (fresh.success) {
          setCurrentOrder(fresh.data);
          setCart(prev => prev.filter(c => c.id !== deleteItemModal.id));
        }
      } else toast(d.message || 'Delete failed', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
    finally { setItemWorking(false); }
  };

  const openReKot = () => {
    const kotSentIds = (currentOrder?.items || []).filter(i => i.kot_sent).map(i => i.id);
    setReKotForm({ reason: '', instructions: '', selectedIds: kotSentIds });
    setReKotModal(true);
  };

  const confirmReKot = async () => {
    setItemWorking(true);
    try {
      const d = await reKot(currentOrder.id, {
        item_ids: reKotForm.selectedIds,
        reason: reKotForm.reason,
        instructions: reKotForm.instructions,
      });
      if (d.success) {
        toast('Re-KOT sent! ' + (d.data?.kot_number || '') + ' ✅', 'ok');
        setReKotModal(false);
        const fresh = await getOrder(currentOrder.id);
        if (fresh.success) setCurrentOrder(fresh.data);
      } else toast(d.message || 'Re-KOT failed', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
    finally { setItemWorking(false); }
  };

  // ── KOT ───────────────────────────────────────────────
  const doKOT = async () => {
    if (!cart.length && !currentOrder) { toast('No items to KOT.', 'er'); return; }
    // Save first if needed
    if (cart.length) await saveOrder();
    if (!currentOrder && !cart.length) return;
    setKotModal(true);
    setKotInstModal(kotInstructions);
  };

  const confirmKOT = async () => {
    try {
      const orderId = currentOrder?.id;
      if (!orderId) { toast('Save order first.', 'er'); return; }
      const d = await sendKOT(orderId, { instructions: kotInstModal });
      if (d.success) {
        toast(`KOT sent! ${d.data.kot_number} ✅`, 'ok');
        setKotModal(false);
        const od = await getOrder(orderId);
        if (od.success) { setCurrentOrder(od.data); setCart([]); }
        await load();
      } else toast(d.message, 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  // ── Bill ──────────────────────────────────────────────
  const openBill = () => {
    if (!currentOrder) { toast('No active order.', 'er'); return; }
    setBillForm({ customer_name: currentOrder.customer_name||'', customer_phone: currentOrder.customer_phone||'', discount_type: '', discount_value: '', coupon_code: '', notes: '', payment_method: 'cash' });
    setCouponResult(null);
    setCouponError('');
    setBillModal(true);
  };

  const applyBillDiscount = () => {
    if (!billForm.discount_type) return 0;
    if (billForm.discount_type === 'coupon' && couponResult) return parseFloat(couponResult.calculated_discount);
    if (billForm.discount_type === 'percentage' && billForm.discount_value) return allTotal * parseFloat(billForm.discount_value) / 100;
    if (billForm.discount_type === 'amount' && billForm.discount_value) return parseFloat(billForm.discount_value);
    return 0;
  };
  const billDiscount = applyBillDiscount();
  const billFinalTotal = Math.max(0, allTotal - billDiscount);

  const checkCoupon = async () => {
    if (!billForm.coupon_code) return;
    setCouponError('');
    try {
      const d = await validateCoupon({ code: billForm.coupon_code, order_amount: allSubtotal });
      if (d.success) { setCouponResult(d.data); setBillForm(f => ({ ...f, discount_type: 'coupon' })); }
      else { setCouponResult(null); setCouponError(d.message); }
    } catch (err) { setCouponError(err?.response?.data?.message || 'Invalid coupon'); setCouponResult(null); }
  };

  const confirmBill = async () => {
    if (!billForm.customer_name) { toast('Customer name required.', 'er'); return; }
    try {
      // Save cart items first if any
      if (cart.length) await saveOrder();
      const d = await generateBill(currentOrder.id, {
        customer_name: billForm.customer_name,
        customer_phone: billForm.customer_phone,
        discount_type: billForm.discount_type || null,
        discount_value: billForm.discount_value || 0,
        coupon_code: billForm.discount_type === 'coupon' ? billForm.coupon_code : null,
        notes: billForm.notes,
      });
      if (d.success) {
        const od = await getOrder(currentOrder.id);
        let fullOrder = currentOrder;
        if (od.success) {
          fullOrder = { ...od.data, customer_name: billForm.customer_name, customer_phone: billForm.customer_phone };
          setBillOrder(fullOrder);
          setCurrentOrder(fullOrder);
        }
        setBillModal(false);
        setReceiptModal(true);
        toast('Bill generated! ✅', 'ok');
        await load();
      } else toast(d.message, 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  // ── Pay ───────────────────────────────────────────────
  const doPay = async () => {
    try {
      const d = await markPaid(currentOrder.id, { payment_method: billForm.payment_method });
      if (d.success) { toast('Payment recorded! ✅', 'ok'); setReceiptModal(false); setActiveView('tables'); setCurrentOrder(null); setCart([]); await load(); }
      else toast(d.message, 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  // ── Print / QR ────────────────────────────────────────
  const printBill = () => {
    const content = billRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`<html><head><title>Bill</title><style>body{margin:0;font-family:monospace}@media print{.no-print{display:none}}</style></head><body>${content}<script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    win.document.close();
  };

  // ── Cancel ────────────────────────────────────────────
  const doCancel = async () => {
    if (!currentOrder) return;
    try {
      await cancelOrder(currentOrder.id);
      toast('Order cancelled.', 'ok');
      setCancelModal(false);
      setActiveView('tables');
      setCurrentOrder(null);
      setCart([]);
      await load();
    } catch { toast('Error', 'er'); }
  };

  // ── Table Management ──────────────────────────────────
  const saveTable = async () => {
    if (!tableForm.table_number) { toast('Table number required.', 'er'); return; }
    try {
      const fn = editTableModal
        ? () => import('../../api').then(a => a.updateTable(editTableModal.id, tableForm))
        : () => import('../../api').then(a => a.createTable(tableForm));
      const d = await fn();
      if (d.success) { toast(editTableModal ? 'Table updated!' : 'Table added!', 'ok'); setTableModal(false); setEditTableModal(null); await load(); }
      else toast(d.message, 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const delTable = async () => {
    try {
      const { deleteTable } = await import('../../api');
      await deleteTable(deleteTableModal.id);
      toast('Table removed.', 'ok'); setDeleteTableModal(null); await load();
    } catch { toast('Error', 'er'); }
  };

  const sectionGroups = useMemo(() => {
    const g = {};
    tables.forEach(t => {
      const s = t.section || 'Main Hall';
      if (!g[s]) g[s] = [];
      g[s].push(t);
    });
    return g;
  }, [tables]);

  // ── TABLES VIEW ───────────────────────────────────────
  if (activeView === 'tables') {
    return (
      <div>
        <div className="ph">
          <div className="ph-left">
            <div className="pt">Sales & Tables</div>
            <div className="ps">Select a table to open POS · Red = occupied · Green = available</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:700,background:connected?'rgba(29,185,126,.1)':'rgba(232,74,95,.08)',color:connected?'#1db97e':'#e84a5f',border:`1.5px solid ${connected?'#1db97e':'#e84a5f'}`,display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:connected?'#1db97e':'#e84a5f'}}/>
              {connected ? 'Live' : 'Offline'}
            </div>
            <button className="btn-c" onClick={() => { setTableForm({ table_number: '', table_name: '', capacity: 4, section: 'Main Hall' }); setEditTableModal(null); setTableModal(true); }}>+ Add Table</button>
            <button className="btn-p" onClick={() => { setSelectedTable(null); setCurrentOrder(null); setCart([]); setOrderType('parcel'); setActiveView('pos'); }}>📦 New Parcel</button>
          </div>
        </div>

        <div className="stats-row">
          <div className="scard"><div style={{ fontSize: 20 }}>🪑</div><div className="scard-text"><div className="sv">{tables.length}</div><div className="sl">Total Tables</div></div></div>
          <div className="scard" style={{ borderTop: '3px solid #e84a5f' }}><div style={{ fontSize: 20 }}>🔴</div><div className="scard-text"><div className="sv" style={{ color: '#e84a5f' }}>{tables.filter(t => t.order_id).length}</div><div className="sl">Occupied</div></div></div>
          <div className="scard" style={{ borderTop: '3px solid #1db97e' }}><div style={{ fontSize: 20 }}>🟢</div><div className="scard-text"><div className="sv" style={{ color: '#1db97e' }}>{tables.filter(t => !t.order_id).length}</div><div className="sl">Available</div></div></div>
          <div className="scard accent-card"><div style={{ fontSize: 20 }}>💰</div><div className="scard-text"><div className="sv small">{fmtCur(tables.reduce((s, t) => s + (t.order_id ? parseFloat(t.total_amount||0) : 0), 0))}</div><div className="sl">Active Revenue</div></div></div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : (
          Object.entries(sectionGroups).map(([section, tbls]) => (
            <div key={section} className="card" style={{ marginBottom: 20 }}>
              <div className="ch"><div className="ct">📍 {section}</div><span style={{ fontSize: 12, color: 'var(--ink2)' }}>{tbls.length} tables</span></div>
              <div className="tables-grid">
                {tbls.map(table => {
                  const occupied = !!table.order_id;
                  const statusColor = occupied ? '#e84a5f' : '#1db97e';
                  const statusBg = occupied ? 'rgba(232,74,95,.08)' : 'rgba(29,185,126,.08)';
                  return (
                    <div key={table.id} className="table-card" style={{ borderColor: statusColor, background: statusBg }}
                      onClick={() => openTable(table)}>
                      <div className="tc-top">
                        <div className="tc-num" style={{ color: statusColor }}>{table.table_number}</div>
                        <div className="tc-dot" style={{ background: statusColor }} />
                      </div>
                      <div className="tc-name">{table.table_name || table.table_number}</div>
                      <div className="tc-cap">👥 {table.capacity}</div>
                      {occupied ? (
                        <div className="tc-order">
                          <div className="tc-status">🔴 {table.order_status?.toUpperCase()}</div>
                          <div className="tc-amt">{fmtCur(table.total_amount)}</div>
                          {table.customer_name && <div className="tc-cust">{table.customer_name}</div>}
                        </div>
                      ) : (
                        <div className="tc-free">Available</div>
                      )}
                      <div className="tc-edit-row">
                        <button className="tc-edit-btn" onClick={e => { e.stopPropagation(); setTableForm({ table_number: table.table_number, table_name: table.table_name||'', capacity: table.capacity, section: table.section }); setEditTableModal(table); setTableModal(true); }}>✏️</button>
                        <button className="tc-edit-btn tc-del" onClick={e => { e.stopPropagation(); setDeleteTableModal(table); }}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Add/Edit Table Modal */}
        <Modal show={tableModal} onClose={() => { setTableModal(false); setEditTableModal(null); }}
          title={editTableModal ? 'Edit Table' : 'Add Table'} subtitle="Configure table details"
          footer={<><button className="btn-c" onClick={() => { setTableModal(false); setEditTableModal(null); }}>Cancel</button><button className="btn-p" onClick={saveTable}>Save</button></>}>
          <div className="mgrid">
            <div><label className="mlabel">Table Number *</label><input className="mfi" placeholder="T1" value={tableForm.table_number} onChange={e => setTableForm(f => ({ ...f, table_number: e.target.value }))} autoFocus /></div>
            <div><label className="mlabel">Table Name</label><input className="mfi" placeholder="Window Table" value={tableForm.table_name} onChange={e => setTableForm(f => ({ ...f, table_name: e.target.value }))} /></div>
            <div><label className="mlabel">Capacity</label><input className="mfi" type="number" min="1" value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))} /></div>
            <div><label className="mlabel">Section</label><input className="mfi" placeholder="Main Hall" value={tableForm.section} onChange={e => setTableForm(f => ({ ...f, section: e.target.value }))} /></div>
          </div>
        </Modal>
        <ConfirmModal show={!!deleteTableModal} onClose={() => setDeleteTableModal(null)} onConfirm={delTable}
          title="Remove Table" message={`Remove table ${deleteTableModal?.table_number}?`} />
      </div>
    );
  }

  // ── POS VIEW ──────────────────────────────────────────
  const kotSentItems = currentOrder ? (currentOrder.items||[]).filter(i => i.kot_sent) : [];
  const hasNewItems = cart.length > 0;

  return (
    <div className="pos-wrap">
      {/* POS Header */}
      <div className="pos-header">
        <button className="btn-c pos-back" onClick={() => setActiveView('tables')}>← Tables</button>
        <div className="pos-title">
          {selectedTable ? (
            <>
              <span className="pos-table-badge">{selectedTable.table_number}</span>
              <span style={{ fontSize: 14, color: 'var(--ink2)' }}>{selectedTable.table_name || selectedTable.section}</span>
            </>
          ) : <span className="pos-table-badge" style={{ background: 'var(--accent)' }}>📦 Parcel</span>}
          {currentOrder && <span className="pos-ord-num">{currentOrder.order_number}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="pos-type-toggle">
            {['dine_in','parcel','takeaway'].map(t => (
              <button key={t} className={'pos-ttype' + (orderType === t ? ' sel' : '')}
                onClick={() => setOrderType(t)} disabled={!!currentOrder}>
                {t === 'dine_in' ? '🪑' : t === 'parcel' ? '📦' : '🥡'} {t.replace('_', ' ')}
              </button>
            ))}
          </div>
          {currentOrder && <button className="btn-c" style={{ fontSize: 12, padding: '6px 12px', color: 'var(--red)', borderColor: 'rgba(232,74,95,.3)' }} onClick={() => setCancelModal(true)}>✕ Cancel</button>}
        </div>
      </div>

      <div className="pos-body">
        {/* LEFT: Menu */}
        <div className="pos-menu">
          <div className="pos-menu-top">
            <div className="sw2" style={{ flex: 1 }}><span className="si2">🔍</span><input placeholder="Search menu…" value={menuSearch} onChange={e => setMenuSearch(e.target.value)} /></div>
          </div>
          {/* Course filter tabs */}
          <div className="pos-course-tabs">
            <div className={'pos-ctab' + (!menuCourse ? ' active' : '')} onClick={() => setMenuCourse('')}>All</div>
            {courses.map(c => (
              <div key={c.id} className={'pos-ctab' + (menuCourse === String(c.id) ? ' active' : '')}
                style={menuCourse === String(c.id) ? { background: c.color, borderColor: c.color, color: '#fff' } : {}}
                onClick={() => setMenuCourse(String(c.id))}>
                {c.icon} {c.name}
              </div>
            ))}
          </div>
          {/* Menu items grid */}
          <div className="pos-items-grid">
            {filteredMenu.map(item => {
              const inCart = cart.find(c => c.menu_item_id === item.id);
              return (
                <div key={item.id} className={'pos-item' + (inCart ? ' in-cart' : '')} onClick={() => addToCart(item)}>
                  <div className="pi-veg">
                    <span className={item.is_veg ? 'veg-dot' : 'nonveg-dot'} />
                  </div>
                  <div className="pi-name">{item.name}</div>
                  <div className="pi-price">{fmtCur(item.selling_price)}</div>
                  {parseFloat(item.gst_percent) > 0 && <div className="pi-gst">+{item.gst_percent}% GST</div>}
                  {inCart && <div className="pi-qty-badge">{inCart.quantity}</div>}
                </div>
              );
            })}
            {filteredMenu.length === 0 && <div className="empty" style={{ gridColumn: '1/-1', padding: 30 }}><div className="ei">🍽️</div><p>No items</p></div>}
          </div>
        </div>

        {/* RIGHT: Order Panel */}
        <div className="pos-order">
          <div className="pos-order-title">Order Summary</div>

          {/* KOT'd items — inline editable */}
          {kotSentItems.length > 0 && (
            <div className="pos-kot-section">
              <div className="pos-section-label pos-kot-header">
                <span>✅ KOT Sent <span className="kot-count">{kotSentItems.length}</span></span>
                <button className="rekot-btn" onClick={openReKot}>🔄 Re-KOT</button>
              </div>

              {kotSentItems.map((item) => {
                const isEditing = inlineEditId === item.id;
                return (
                  <div key={item.id} className={`kot-item-row${isEditing ? ' editing' : ''}`}>
                    {/* ── Normal view ── */}
                    {!isEditing && (
                      <div className="kit-normal">
                        <div className="kit-left">
                          <span className="kit-name">{item.item_name}</span>
                          {item.kot_instructions && <span className="kit-note kit-kot-note">🍳 {item.kot_instructions}</span>}
                          {item.notes && <span className="kit-note">📋 {item.notes}</span>}
                        </div>
                        <div className="kit-right">
                          <span className="kit-qty">×{item.quantity}</span>
                          <span className="kit-price">{fmtCur(parseFloat(item.unit_price) * item.quantity)}</span>
                          <button className="kit-btn kit-edit" onClick={() => openInlineEdit(item)} title="Edit">✏️</button>
                          <button className="kit-btn kit-del" onClick={() => setDeleteItemModal(item)} title="Remove">🗑️</button>
                        </div>
                      </div>
                    )}

                    {/* ── Inline edit expanded view ── */}
                    {isEditing && (
                      <div className="kit-editing">
                        <div className="kit-edit-header">
                          <span className="kit-name">{item.item_name}</span>
                          <span className="kit-price-sm">{fmtCur(item.unit_price)} each</span>
                        </div>
                        <div className="kit-edit-row">
                          <label className="kit-label">Qty</label>
                          <div className="kit-qty-ctrl">
                            <button className="kit-qbtn minus"
                              onClick={() => setInlineQty(q => Math.max(1, q - 1))}>−</button>
                            <input className="kit-qinput" type="number" min="1"
                              value={inlineQty}
                              onChange={e => setInlineQty(Math.max(1, parseInt(e.target.value) || 1))} />
                            <button className="kit-qbtn plus"
                              onClick={() => setInlineQty(q => q + 1)}>+</button>
                          </div>
                          <span className="kit-new-total">= {fmtCur(item.unit_price * inlineQty)}</span>
                        </div>
                        <div className="kit-edit-row">
                          <label className="kit-label">🍳 Note</label>
                          <input className="kit-noteinput" placeholder="Kitchen note e.g. no onion, extra spicy…"
                            value={inlineKotNote}
                            onChange={e => setInlineKotNote(e.target.value)} />
                        </div>
                        <div className="kit-edit-row">
                          <label className="kit-label">📋 Misc</label>
                          <input className="kit-noteinput" placeholder="Other notes…"
                            value={inlineNotes}
                            onChange={e => setInlineNotes(e.target.value)} />
                        </div>
                        <div className="kit-edit-actions">
                          <button className="kit-cancel-btn" onClick={cancelInlineEdit}>Cancel</button>
                          <button className="kit-save-btn" onClick={() => saveInlineEdit(item)} disabled={itemWorking}>
                            {itemWorking ? '⏳' : '✅ Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* New items (editable cart) */}
          {hasNewItems && (
            <div className="pos-cart-section">
              <div className="pos-section-label">🆕 New Items</div>
              {cart.map((item, idx) => (
                <div key={idx} className="cart-item-wrap">
                  {/* Top row: name + qty + price + delete */}
                  <div className="ciw-top">
                    <div className="ciw-name-block">
                      <span className="ciw-name">{item.item_name}</span>
                      {parseFloat(item.gst_percent) > 0 && <span className="ciw-gst">+{item.gst_percent}% GST</span>}
                    </div>
                    <div className="ciw-controls">
                      <button className="ciw-qbtn" onClick={() => updateQty(idx, item.quantity - 1)}>−</button>
                      <span className="ciw-qty">{item.quantity}</span>
                      <button className="ciw-qbtn" onClick={() => updateQty(idx, item.quantity + 1)}>+</button>
                    </div>
                    <span className="ciw-price">{fmtCur(item.unit_price * item.quantity)}</span>
                    <button className="ciw-del" onClick={() => removeFromCart(idx)} title="Remove">✕</button>
                  </div>
                  {/* Bottom row: kitchen note */}
                  <div className="ciw-note-row">
                    <span className="ciw-note-icon">🍳</span>
                    <input
                      className="ciw-note-input"
                      placeholder="Kitchen note for this item…"
                      value={item.kot_instructions || ''}
                      onChange={e => updateKotNote(idx, e.target.value)}
                    />
                    {item.kot_instructions && (
                      <button className="ciw-note-clear" onClick={() => updateKotNote(idx, '')} title="Clear">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasNewItems && !kotSentItems.length && (
            <div className="pos-empty">Tap items on the left to add</div>
          )}

          {/* Global KOT note (kept for overall order) */}
          <div className="pos-kot-inst">
            <label className="mlabel" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              🔥 Order Note <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink2)' }}>(applies to whole order)</span>
            </label>
            <input className="mfi" placeholder="e.g. Serve together, high chair needed…"
              value={kotInstructions} onChange={e => setKotInstructions(e.target.value)}
              style={{ fontSize: 12 }} />
          </div>

          {/* Totals */}
          <div className="pos-totals">
            <div className="pos-total-row"><span>Subtotal</span><span>{fmtCur(allSubtotal)}</span></div>
            {allGst > 0 && <div className="pos-total-row"><span>GST</span><span>{fmtCur(allGst)}</span></div>}
            <div className="pos-total-row grand"><span>Total</span><span>{fmtCur(allTotal)}</span></div>
          </div>

          {/* Action buttons */}
          <div className="pos-actions">
            {hasNewItems && (
              <button className="btn-c pos-act-btn" onClick={saveOrder}>💾 Save</button>
            )}
            {(hasNewItems || (currentOrder && !cart.length)) && (
              <button className="pos-act-btn pos-kot-btn" onClick={doKOT}>🔥 KOT</button>
            )}
            {currentOrder && (
              <button className="pos-act-btn pos-bill-btn" onClick={openBill}>🧾 Bill</button>
            )}
          </div>
        </div>
      </div>

      {/* KOT Confirm Modal */}
      <Modal show={kotModal} onClose={() => setKotModal(false)}
        title="Send KOT" subtitle="Kitchen Order Ticket"
        footer={<><button className="btn-c" onClick={() => setKotModal(false)}>Cancel</button><button className="btn-p" style={{ background: '#e87029' }} onClick={confirmKOT}>🔥 Send to Kitchen</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Per-item list with editable notes */}
          <div className="recipe-section" style={{ marginBottom: 0 }}>
            <div className="recipe-section-title">Items for Kitchen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {cart.map((item, i) => (
                <div key={i} className="kot-confirm-item">
                  <div className="kci-top">
                    <span className="kci-name">{item.item_name}</span>
                    <span className="kci-qty">× {item.quantity}</span>
                  </div>
                  <div className="kci-note-row">
                    <span className="kci-note-icon">🍳</span>
                    <input
                      className="kci-note-input"
                      placeholder="Kitchen note for this item…"
                      value={item.kot_instructions || ''}
                      onChange={e => updateKotNote(i, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Order-level instruction */}
          <div>
            <label className="mlabel">Overall Order Note</label>
            <input className="mfi" placeholder="e.g. Serve together, extra napkins…"
              value={kotInstModal} onChange={e => setKotInstModal(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Bill Modal */}
      <Modal show={billModal} onClose={() => setBillModal(false)}
        title="Generate Bill" subtitle="Customer details & discount" wide
        footer={<>
          <button className="btn-c" onClick={() => setBillModal(false)}>Cancel</button>
          <button className="btn-p" onClick={confirmBill}>🧾 Generate Bill</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Items summary ── */}
          <div className="recipe-section" style={{ marginBottom: 0 }}>
            <div className="recipe-section-title">🍽️ Order Items</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '5px 8px', color: 'var(--ink2)', fontWeight: 700 }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '5px 8px', color: 'var(--ink2)', fontWeight: 700, width: 40 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '5px 8px', color: 'var(--ink2)', fontWeight: 700, width: 70 }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '5px 8px', color: 'var(--ink2)', fontWeight: 700, width: 80 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {allOrderItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                      {item.item_name}
                      {(item.kot_instructions) && (
                        <div style={{ fontSize: 10, color: '#e06c00', fontStyle: 'italic' }}>🍳 {item.kot_instructions}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 8px' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ink2)' }}>{fmtCur(item.unit_price)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>{fmtCur(parseFloat(item.unit_price) * item.quantity)}</td>
                  </tr>
                ))}
                {allOrderItems.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: 'var(--ink2)' }}>No items</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Subtotal</td>
                  <td style={{ padding: '6px 8px', fontWeight: 800, textAlign: 'right' }}>{fmtCur(allSubtotal)}</td>
                </tr>
                {allGst > 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '2px 8px', textAlign: 'right', color: 'var(--ink2)', fontSize: 11 }}>GST</td>
                    <td style={{ padding: '2px 8px', textAlign: 'right', color: 'var(--ink2)', fontSize: 11 }}>{fmtCur(allGst)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
          <hr className="mdiv" />

          <div className="recipe-section">
            <div className="recipe-section-title">👤 Customer Details *</div>
            <div className="mgrid">
              <div><label className="mlabel">Customer Name *</label><input className="mfi" placeholder="Enter name" value={billForm.customer_name} onChange={e => setBillForm(f => ({ ...f, customer_name: e.target.value }))} autoFocus /></div>
              <div><label className="mlabel">Mobile Number</label><input className="mfi" placeholder="10-digit mobile" value={billForm.customer_phone} onChange={e => setBillForm(f => ({ ...f, customer_phone: e.target.value }))} /></div>
            </div>
          </div>
          <hr className="mdiv" />
          <div className="recipe-section">
            <div className="recipe-section-title">🏷️ Discount</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['','percentage','amount','coupon'].map(dt => (
                <button key={dt} type="button"
                  className={'topt' + (billForm.discount_type === dt ? ' sel' : '')}
                  style={{ flex: 1, padding: '8px 4px' }}
                  onClick={() => { setBillForm(f => ({ ...f, discount_type: dt, discount_value: '', coupon_code: '' })); setCouponResult(null); setCouponError(''); }}>
                  <div className="tname" style={{ fontSize: 12 }}>{dt === '' ? '❌ None' : dt === 'percentage' ? '% Percent' : dt === 'amount' ? '₹ Amount' : '🎟️ Coupon'}</div>
                </button>
              ))}
            </div>
            {billForm.discount_type === 'percentage' && (
              <div><label className="mlabel">Discount %</label>
                <input className="mfi" type="number" min="0" max="100" placeholder="e.g. 10" value={billForm.discount_value} onChange={e => setBillForm(f => ({ ...f, discount_value: e.target.value }))} /></div>
            )}
            {billForm.discount_type === 'amount' && (
              <div><label className="mlabel">Discount Amount (₹)</label>
                <input className="mfi" type="number" min="0" placeholder="e.g. 50" value={billForm.discount_value} onChange={e => setBillForm(f => ({ ...f, discount_value: e.target.value }))} /></div>
            )}
            {billForm.discount_type === 'coupon' && (
              <div>
                <label className="mlabel">Coupon Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="mfi" placeholder="Enter code" value={billForm.coupon_code}
                    style={{ flex: 1, textTransform: 'uppercase' }}
                    onChange={e => { setBillForm(f => ({ ...f, coupon_code: e.target.value.toUpperCase() })); setCouponResult(null); setCouponError(''); }} />
                  <button className="btn-p" onClick={checkCoupon} style={{ whiteSpace: 'nowrap' }}>Apply</button>
                </div>
                {couponResult && <div style={{ marginTop: 6, padding: '8px 12px', background: 'rgba(29,185,126,.1)', borderRadius: 8, color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>✅ {couponResult.description || couponResult.code} — Save {fmtCur(couponResult.calculated_discount)}</div>}
                {couponError && <div style={{ marginTop: 6, color: 'var(--red)', fontSize: 13 }}>❌ {couponError}</div>}
              </div>
            )}
          </div>
          <hr className="mdiv" />
          {/* Bill summary */}
          <div className="cost-summary">
            <div className="cs-row"><span>Subtotal</span><span>{fmtCur(allSubtotal)}</span></div>
            {allGst > 0 && <div className="cs-row"><span>GST</span><span>{fmtCur(allGst)}</span></div>}
            {billDiscount > 0 && <div className="cs-row" style={{ color: 'var(--green)' }}><span>Discount</span><span>− {fmtCur(billDiscount)}</span></div>}
            <div className="cs-total"><span>Grand Total</span><span>{fmtCur(billFinalTotal)}</span></div>
          </div>
          <div>
            <label className="mlabel">Payment Method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['cash','card','upi','other'].map(pm => (
                <button key={pm} type="button" className={'topt' + (billForm.payment_method === pm ? ' sel' : '')} style={{ flex: 1 }}
                  onClick={() => setBillForm(f => ({ ...f, payment_method: pm }))}>
                  <div className="tname" style={{ fontSize: 12 }}>{pm === 'cash' ? '💵' : pm === 'card' ? '💳' : pm === 'upi' ? '📱' : '🔄'} {pm.toUpperCase()}</div>
                </button>
              ))}
            </div>
          </div>
          <div><label className="mlabel">Notes</label><input className="mfi" placeholder="Any bill notes…" value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal show={receiptModal} onClose={() => { setReceiptModal(false); setActiveView('tables'); }}
        title="Bill Receipt" subtitle="Print or share with customer" wide>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Bill preview */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 16, background: '#fff' }}>
              <BillPrint ref={billRef} order={billOrder || currentOrder} settings={billSettings} />
            </div>
          </div>
          {/* Actions */}
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn-p" style={{ padding: '12px 20px' }} onClick={printBill}>🖨️ Print Bill</button>

            {/* Items list on receipt */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ padding: '7px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--ink2)', borderBottom: '1px solid var(--border)' }}>🍽️ Items</div>
              {((billOrder || currentOrder)?.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.item_name}</div>
                    {item.kot_instructions && <div style={{ fontSize: 10, color: '#e06c00', fontStyle: 'italic' }}>🍳 {item.kot_instructions}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: 8 }}>
                    <span style={{ color: 'var(--ink2)' }}>×{item.quantity}</span>
                    <span style={{ fontWeight: 700, marginLeft: 8 }}>{fmtCur(parseFloat(item.unit_price) * item.quantity)}</span>
                  </div>
                </div>
              ))}
              {(((billOrder || currentOrder)?.items || []).length === 0) && (
                <div style={{ padding: 12, color: 'var(--ink2)', fontSize: 12, textAlign: 'center' }}>No items</div>
              )}
            </div>

            <div className="pos-totals" style={{ margin: 0 }}>
              <div className="pos-total-row"><span>Subtotal</span><span>{fmtCur((billOrder||currentOrder)?.subtotal)}</span></div>
              {parseFloat((billOrder||currentOrder)?.gst_amount) > 0 && <div className="pos-total-row"><span>GST</span><span>{fmtCur((billOrder||currentOrder)?.gst_amount)}</span></div>}
              {parseFloat((billOrder||currentOrder)?.discount_amount) > 0 && <div className="pos-total-row" style={{ color: 'var(--green)' }}><span>Discount</span><span>− {fmtCur((billOrder||currentOrder)?.discount_amount)}</span></div>}
              <div className="pos-total-row grand"><span>TOTAL</span><span>{fmtCur((billOrder||currentOrder)?.total_amount)}</span></div>
            </div>
            <div>
              <label className="mlabel">Payment Method</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['cash','card','upi','other'].map(pm => (
                  <button key={pm} type="button" className={'topt' + (billForm.payment_method === pm ? ' sel' : '')} style={{ flex: 1 }}
                    onClick={() => setBillForm(f => ({ ...f, payment_method: pm }))}>
                    <div className="tname" style={{ fontSize: 11 }}>{pm === 'cash' ? '💵' : pm === 'card' ? '💳' : pm === 'upi' ? '📱' : '🔄'}</div>
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-p" style={{ background: 'var(--green)', padding: '14px 20px', fontSize: 15, fontWeight: 700 }} onClick={doPay}>✅ Mark as Paid & Close</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal show={cancelModal} onClose={() => setCancelModal(false)} onConfirm={doCancel}
        title="Cancel Order" message="Cancel this order? This cannot be undone." />

      {/* ── Delete KOT'd Item Confirm ──────────────────────────────── */}
      <ConfirmModal
        show={!!deleteItemModal}
        onClose={() => setDeleteItemModal(null)}
        onConfirm={confirmDeleteItem}
        title="Remove Item"
        message={`Remove "${deleteItemModal?.item_name}" (×${deleteItemModal?.quantity}) from this order? This cannot be undone.`}
        icon="⚠️" confirmLabel="Remove Item" dangerous
      />

      {/* ── Re-KOT Modal ──────────────────────────────────────────── */}
      <Modal show={reKotModal} onClose={() => setReKotModal(false)}
        title="Re-KOT" subtitle="Send kitchen a correction notice"
        footer={<>
          <button className="btn-c" onClick={() => setReKotModal(false)}>Cancel</button>
          <button className="btn-p" style={{ background: '#e06c00' }} onClick={confirmReKot} disabled={itemWorking || !reKotForm.selectedIds.length}>
            {itemWorking ? '⏳ Sending…' : '🔄 Send Re-KOT'}
          </button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink2)', background: 'rgba(232,175,0,.1)', borderRadius: 8, padding: '8px 12px' }}>
            📢 A Re-KOT prints a correction ticket (RKOT-XXXXXX) in the kitchen showing the updated quantities/items.
          </div>

          {/* Item checkboxes */}
          <div className="mfield">
            <label className="mlabel">Select Items to Re-KOT</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {(currentOrder?.items || []).filter(i => i.kot_sent).map(item => {
                const checked = reKotForm.selectedIds.includes(item.id);
                return (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: checked ? 'rgba(232,112,41,.08)' : 'var(--surface)', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, transition: 'all .15s' }}>
                    <input type="checkbox" checked={checked}
                      onChange={e => setReKotForm(f => ({
                        ...f,
                        selectedIds: e.target.checked
                          ? [...f.selectedIds, item.id]
                          : f.selectedIds.filter(id => id !== item.id)
                      }))} />
                    <span style={{ flex: 1, fontWeight: 500 }}>{item.item_name}</span>
                    <span style={{ color: checked ? 'var(--accent)' : 'var(--ink2)', fontWeight: 700 }}>× {item.quantity}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <button className="btn-c" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setReKotForm(f => ({ ...f, selectedIds: (currentOrder?.items || []).filter(i => i.kot_sent).map(i => i.id) }))}>
                Select All
              </button>
              <button className="btn-c" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setReKotForm(f => ({ ...f, selectedIds: [] }))}>
                Clear
              </button>
            </div>
          </div>

          <div className="mfield">
            <label className="mlabel">Reason for Re-KOT</label>
            <input className="mfi" placeholder="e.g. Quantity changed, item added, mistake correction…"
              value={reKotForm.reason}
              onChange={e => setReKotForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="mfield">
            <label className="mlabel">Additional Kitchen Instructions</label>
            <textarea className="mfi" rows="2" placeholder="Any special notes for kitchen…"
              style={{ resize: 'none' }}
              value={reKotForm.instructions}
              onChange={e => setReKotForm(f => ({ ...f, instructions: e.target.value }))} />
          </div>
        </div>
      </Modal>

    </div>
  );
}
