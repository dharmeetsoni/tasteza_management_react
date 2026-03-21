import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  updatePurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder,
  deletePurchaseOrder, getInventory, getUnits, getVendors, getSettings
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur, fmtDate } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const STATUS_META = {
  pending:   { label: 'Pending',   color: '#b07a00', bg: 'rgba(244,165,53,.12)',  icon: '🕐' },
  partial:   { label: 'Partial',   color: '#118ab2', bg: 'rgba(17,138,178,.12)',  icon: '📦' },
  received:  { label: 'Received',  color: '#1db97e', bg: 'rgba(29,185,126,.12)', icon: '✅' },
  cancelled: { label: 'Cancelled', color: '#e84a5f', bg: 'rgba(232,74,95,.10)',  icon: '❌' },
};

// ── Unit conversion table (mirrors inventoryDeduct.js) ───────────────────────
// mult = how many base-units this unit contains (g=1, kg=1000, ml=1, l=1000)
const UNIT_TABLE = [
  { mult: 1000000, keys: ['tonne','ton','t'] },
  { mult: 1000,    keys: ['kg','kgs','kilogram','kilograms','kilo'] },
  { mult: 1,       keys: ['g','gm','gr','gram','grams','grm'] },
  { mult: 0.001,   keys: ['mg','milligram','milligrams'] },
  { mult: 1000,    keys: ['l','lt','ltr','litre','liter','liters','litres','lts'] },
  { mult: 1,       keys: ['ml','millilitre','milliliter','mls'] },
  { mult: 240,     keys: ['cup','cups'] },
  { mult: 15,      keys: ['tbsp','tablespoon','tablespoons'] },
  { mult: 5,       keys: ['tsp','teaspoon','teaspoons'] },
  { mult: 1,       keys: ['pcs','pc','piece','pieces','nos','no','number',
                           'portion','portions','plate','plates',
                           'unit','units','serve','serves','each'] },
];

function getUnitMult(abbr, name, convFactor) {
  const a = (abbr  || '').trim().toLowerCase();
  const n = (name  || '').trim().toLowerCase();
  for (const e of UNIT_TABLE) {
    if (e.keys.includes(a) || e.keys.includes(n)) return e.mult;
  }
  const cf = parseFloat(convFactor);
  return cf > 0 ? cf : 1;
}

// Convert a quantity/price between two units using unit objects {abbreviation, name, conversion_factor}
// convertPrice(100, kgUnit, gUnit) → 0.1  (₹100/kg → ₹0.1/g)
// Price scales INVERSELY to unit size: bigger unit = higher price per unit
function convertPrice(price, fromUnit, toUnit) {
  if (!fromUnit || !toUnit || fromUnit.id === toUnit.id) return price;
  const fromMult = getUnitMult(fromUnit.abbreviation, fromUnit.name, fromUnit.conversion_factor);
  const toMult   = getUnitMult(toUnit.abbreviation,   toUnit.name,   toUnit.conversion_factor);
  if (fromMult === toMult || fromMult === 0) return price;
  // e.g. kg(1000) → g(1): price * (1/1000) = price * (toMult/fromMult)
  return price * (toMult / fromMult);
}

// Convert a quantity between two units
// convertQty(1, kgUnit, gUnit) → 1000
function convertQty(qty, fromUnit, toUnit) {
  if (!fromUnit || !toUnit || fromUnit.id === toUnit.id) return qty;
  const fromMult = getUnitMult(fromUnit.abbreviation, fromUnit.name, fromUnit.conversion_factor);
  const toMult   = getUnitMult(toUnit.abbreviation,   toUnit.name,   toUnit.conversion_factor);
  if (fromMult === toMult || toMult === 0) return qty;
  return qty * (fromMult / toMult);
}

// ─────────────────────────────────────────────────────────────────────────────
// PO Print Slip — A4 printable purchase order
// ─────────────────────────────────────────────────────────────────────────────
const POPrint = React.forwardRef(({ po, settings }, ref) => {
  if (!po) return null;
  const items    = po.items || [];
  const now      = new Date();
  const printDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const printTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const expectedDate = po.expected_date
    ? new Date(po.expected_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const total = items.reduce((s, i) => s + parseFloat(i.total_price || 0), 0);

  const row = (label, value) => value ? (
    <tr>
      <td style={{ padding: '3px 0', color: '#555', fontSize: 12, width: 130, verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '3px 0', fontWeight: 600, fontSize: 12 }}>{value}</td>
    </tr>
  ) : null;

  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', width: '100%', maxWidth: 720, margin: '0 auto', padding: 32, background: '#fff', color: '#111' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #111' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>{settings?.restaurant_name || 'Restaurant'}</div>
          {settings?.address && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{settings.address}</div>}
          {settings?.phone  && <div style={{ fontSize: 11, color: '#555' }}>📞 {settings.phone}</div>}
          {settings?.email  && <div style={{ fontSize: 11, color: '#555' }}>✉️ {settings.email}</div>}
          {settings?.gst_number && <div style={{ fontSize: 11, color: '#555' }}>GST: {settings.gst_number}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1, color: '#c0392b' }}>PURCHASE ORDER</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', marginTop: 4 }}>{po.po_number}</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>Printed: {printDate} {printTime}</div>
          <div style={{ marginTop: 6, display: 'inline-block', padding: '3px 10px', borderRadius: 4,
            background: STATUS_META[po.status]?.bg || '#eee',
            color: STATUS_META[po.status]?.color || '#333',
            fontWeight: 700, fontSize: 12, border: `1px solid ${STATUS_META[po.status]?.color || '#ccc'}` }}>
            {STATUS_META[po.status]?.icon} {STATUS_META[po.status]?.label}
          </div>
        </div>
      </div>

      {/* Supplier + Order info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#555', marginBottom: 8, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Supplier / Vendor</div>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {row('Name',    po.supplier)}
              {row('Phone',   po.supplier_phone)}
              {row('Address', po.supplier_address)}
              {row('Invoice', po.invoice_no)}
            </tbody>
          </table>
          {!po.supplier && <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>No supplier details</div>}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#555', marginBottom: 8, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Order Details</div>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {row('PO Number',    po.po_number)}
              {row('Expected By',  expectedDate)}
              {row('Created By',   po.created_by_name)}
              {row('Bill Amount',  po.bill_amount ? `₹${parseFloat(po.bill_amount).toFixed(2)}` : null)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0, fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#111', color: '#fff' }}>
            <th style={{ padding: '8px 10px', textAlign: 'left',  fontWeight: 700, width: 32  }}>#</th>
            <th style={{ padding: '8px 10px', textAlign: 'left',  fontWeight: 700             }}>Item</th>
            <th style={{ padding: '8px 10px', textAlign: 'left',  fontWeight: 700, width: 100 }}>Category</th>
            <th style={{ padding: '8px 10px', textAlign: 'center',fontWeight: 700, width: 80  }}>Qty</th>
            <th style={{ padding: '8px 10px', textAlign: 'center',fontWeight: 700, width: 60  }}>Unit</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, width: 100 }}>₹/Unit</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, width: 110 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8f8f8', borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ padding: '8px 10px', color: '#888', fontSize: 11 }}>{i + 1}</td>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.item_name}</td>
              <td style={{ padding: '8px 10px', fontSize: 11, color: '#666' }}>{item.category_name || '—'}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.ordered_qty}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: '#666' }}>{item.unit_abbr || '—'}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{parseFloat(item.unit_price).toFixed(2)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>₹{parseFloat(item.total_price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f0f0f0', borderTop: '2px solid #111' }}>
            <td colSpan={5} />
            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>Order Total</td>
            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, fontSize: 16 }}>₹{total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      {po.notes && (
        <div style={{ marginTop: 20, padding: '10px 14px', background: '#fffbe6', border: '1px solid #ffe08a', borderRadius: 6, fontSize: 12 }}>
          <strong>Notes:</strong> {po.notes}
        </div>
      )}

      {/* Signature row */}
      <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        {['Prepared By', 'Authorised By', 'Received By'].map(label => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #888', paddingTop: 6, fontSize: 11, color: '#666' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#aaa', borderTop: '1px solid #eee', paddingTop: 10 }}>
        Generated by {settings?.restaurant_name || 'Tasteza'} · {printDate}
      </div>
    </div>
  );
});

const EMPTY_FORM = { vendor_id: '', supplier: '', supplier_phone: '', supplier_address: '', expected_date: '', notes: '' };
const EMPTY_ITEM = { inventory_item_id: '', unit_id: '', quantity: '', unit_price: '', total: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// ItemSearchPicker — searchable multi-select inventory picker (like image 2)
// ─────────────────────────────────────────────────────────────────────────────
function ItemSearchPicker({ invItems, onSelect }) {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState(new Set());
  const inputRef = useRef(null);
  const dropRef  = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? invItems.filter(i =>
          i.name.toLowerCase().includes(q) ||
          (i.category_name || '').toLowerCase().includes(q))
      : invItems;
  }, [invItems, query]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (item) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    });
  };

  const confirmSelection = () => {
    const picked = invItems.filter(i => selected.has(i.id));
    onSelect(picked);
    setSelected(new Set());
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button type="button" className="btn-add-row"
        onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 50); }}>
        + Add Items
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 1200,
          background: 'var(--surface)', border: '2px solid var(--accent)',
          borderRadius: 14, boxShadow: '0 8px 36px rgba(0,0,0,.18)',
          width: 540, maxHeight: 440, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search input */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg)', borderRadius: 8, padding: '7px 11px',
              border: '1.5px solid var(--border)' }}>
              <span style={{ fontSize: 14 }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search items…"
                style={{ flex: 1, border: 'none', background: 'transparent',
                  outline: 'none', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink2)', fontSize: 14, lineHeight: 1 }}>✕</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 5,
              display: 'flex', justifyContent: 'space-between' }}>
              <span>{filtered.length} items{query ? ' matched' : ' — type to filter'}</span>
              {selected.size > 0 && (
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{selected.size} selected</span>
              )}
            </div>
          </div>

          {/* Items 2-column grid */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--ink2)', fontSize: 13 }}>
                No items found
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {filtered.map(item => {
                  const isSel = selected.has(item.id);
                  return (
                    <div key={item.id} onClick={() => toggle(item)} style={{
                      padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                      border: `2px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSel ? 'rgba(232,87,42,.06)' : 'var(--bg)',
                      transition: 'all .12s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', lineHeight: 1.3 }}>{item.name}</div>
                        {isSel && (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--accent)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 900 }}>✓</div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 2 }}>
                        {item.category_name || 'Uncategorized'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                          {item.purchase_price
                            ? `₹${parseFloat(item.purchase_price).toFixed(2)}/${item.unit_abbr || 'unit'}`
                            : '₹—'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink2)' }}>
                          stock: {parseFloat(item.current_stock || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--ink2)', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="button" className="btn-p"
              onClick={confirmSelection}
              disabled={selected.size === 0}
              style={{ padding: '7px 20px', fontSize: 13, opacity: selected.size === 0 ? .4 : 1 }}>
              Add {selected.size > 0 ? `${selected.size} ` : ''}Item{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PoItemRow — one row in the order items table
// ─────────────────────────────────────────────────────────────────────────────
function PoItemRow({ item, idx, units, invItems, onChange, onRemove }) {
  const inv = invItems.find(i => i.id === parseInt(item.inventory_item_id));
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '24px 1fr 88px 90px 108px 96px 28px',
      gap: 8, alignItems: 'center',
      padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.012)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)' }}>{idx + 1}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {inv?.name ?? <span style={{ color: 'var(--ink2)', fontStyle: 'italic' }}>—</span>}
        </div>
        {inv && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{inv.category_name}</div>}
      </div>

      <input className="ri-qty" type="number" min="0" placeholder="0"
        value={item.quantity}
        onChange={e => onChange(idx, 'quantity', e.target.value)}
        style={{ width: '100%', textAlign: 'center' }} />

      <select className="ri-sel" value={item.unit_id}
        onChange={e => onChange(idx, 'unit_id', e.target.value)}
        style={{ width: '100%' }}>
        <option value="">Unit</option>
        {units.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
      </select>

      <input className="ri-qty" type="number" min="0" placeholder="₹0"
        value={item.unit_price}
        onChange={e => onChange(idx, 'unit_price', e.target.value)}
        style={{ width: '100%', textAlign: 'right' }} />

      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13,
        color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtCur(item.total)}
      </div>

      <button type="button" className="ing-remove-btn" onClick={() => onRemove(idx)}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PoFormContent — defined OUTSIDE PurchaseOrderPage so React never remounts it
// on state changes inside the parent, which was causing focus to jump.
// ─────────────────────────────────────────────────────────────────────────────
function PoFormContent({ form, setForm, poItems, units, invItems, vendors, updatePoItem, removePoItem, addPickedItems, poTotal }) {
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  // When vendor is selected, auto-fill supplier fields and filter items by vendor's categories
  const selectedVendor = useMemo(() =>
    vendors.find(v => v.id === parseInt(form.vendor_id)) || null,
  [vendors, form.vendor_id]);

  const handleVendorChange = (e) => {
    const vid = e.target.value;
    const vendor = vendors.find(v => v.id === parseInt(vid));
    setForm(f => ({
      ...f,
      vendor_id: vid,
      supplier:         vendor ? vendor.name          : f.supplier,
      supplier_phone:   vendor ? (vendor.phone || '')  : f.supplier_phone,
      supplier_address: vendor ? (vendor.address || '') : f.supplier_address,
    }));
  };

  // Filter inventory items to vendor's categories (if vendor selected and has categories)
  const filteredInvItems = useMemo(() => {
    if (!selectedVendor || !selectedVendor.category_ids?.length) return invItems;
    return invItems.filter(item => selectedVendor.category_ids.includes(item.category_id));
  }, [invItems, selectedVendor]);

  const hasItems = poItems.some(r => r.inventory_item_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Vendor selector ── */}
      <div className="recipe-section">
        <div className="recipe-section-title">🏪 Vendor / Supplier</div>

        {/* Quick vendor pick */}
        <div style={{ marginBottom: 14 }}>
          <label className="mlabel">Select Vendor</label>
          <select className="mfi" value={form.vendor_id} onChange={handleVendorChange}
            style={{ fontWeight: form.vendor_id ? 700 : 400 }}>
            <option value="">— Choose a vendor or fill manually below —</option>
            {vendors.filter(v => v.is_active).map(v => (
              <option key={v.id} value={v.id}>
                {v.name}{v.category_names?.length ? ` (${v.category_names.join(', ')})` : ''}
              </option>
            ))}
          </select>
          {selectedVendor && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 9,
              background: 'rgba(29,185,126,.07)', border: '1.5px solid rgba(29,185,126,.2)',
              fontSize: 12, color: 'var(--green)', fontWeight: 600, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              ✅ Showing <strong>{filteredInvItems.length}</strong> items from {selectedVendor.category_names.length > 0
                ? selectedVendor.category_names.join(', ')
                : 'all categories'}
              {selectedVendor.phone && <span>📞 {selectedVendor.phone}</span>}
            </div>
          )}
        </div>

        <div className="mgrid">
          <div>
            <label className="mlabel">Supplier Name</label>
            <input className="mfi" placeholder="e.g. Fresh Farms"
              value={form.supplier} onChange={set('supplier')} />
          </div>
          <div>
            <label className="mlabel">Phone</label>
            <input className="mfi" placeholder="Contact number"
              value={form.supplier_phone} onChange={set('supplier_phone')} />
          </div>
          <div>
            <label className="mlabel">Expected Delivery Date</label>
            <input className="mfi" type="date"
              value={form.expected_date} onChange={set('expected_date')} />
          </div>
          <div>
            <label className="mlabel">Notes</label>
            <input className="mfi" placeholder="Optional notes"
              value={form.notes} onChange={set('notes')} />
          </div>
          <div className="mfull">
            <label className="mlabel">Supplier Address</label>
            <input className="mfi" placeholder="Optional address"
              value={form.supplier_address} onChange={set('supplier_address')} />
          </div>
        </div>
      </div>

      <hr className="mdiv" />

      {/* ── Order items ── */}
      <div className="recipe-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div className="recipe-section-title" style={{ marginBottom: 0 }}>🧺 Order Items *</div>
            {selectedVendor && filteredInvItems.length < invItems.length && (
              <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 3 }}>
                Filtered to {selectedVendor.category_names.join(' / ')} items
              </div>
            )}
          </div>
          <ItemSearchPicker invItems={filteredInvItems} onSelect={addPickedItems} />
        </div>

        <div className="ri-table">
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 88px 90px 108px 96px 28px',
            gap: 8, padding: '8px 14px',
            background: 'var(--bg)', borderBottom: '2px solid var(--border)',
          }}>
            {['#', 'Item', 'Qty', 'Unit', '₹/Unit', 'Total', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)',
                textTransform: 'uppercase', letterSpacing: .4,
                textAlign: i >= 4 && i <= 5 ? 'right' : i === 2 ? 'center' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Empty state */}
          {!hasItems && (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ink2)' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>🧺</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No items added yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {selectedVendor
                  ? <>Click <strong>+ Add Items</strong> to pick from <strong>{selectedVendor.category_names.join(' / ')}</strong> items</>
                  : <>Select a vendor above to filter items, or click <strong>+ Add Items</strong> to pick from all inventory</>}
              </div>
            </div>
          )}

          {/* Rows */}
          {poItems.map((item, idx) =>
            item.inventory_item_id ? (
              <PoItemRow
                key={`${item.inventory_item_id}-${idx}`}
                item={item} idx={idx} units={units} invItems={invItems}
                onChange={updatePoItem} onRemove={removePoItem}
              />
            ) : null
          )}

          {/* Total */}
          {hasItems && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              padding: '12px 16px', gap: 14, borderTop: '2px solid var(--border)',
              background: 'rgba(232,87,42,.03)' }}>
              <span style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>Order Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums' }}>
                {fmtCur(poTotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseOrderPage — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function PurchaseOrderPage() {
  const toast = useToast();
  const [orders, setOrders]     = useState([]);
  const [invItems, setInvItems] = useState([]);
  const [units, setUnits]       = useState([]);
  const [vendors, setVendors]   = useState([]);
  const [settings, setSettings] = useState({});
  const printRef = useRef(null);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatus] = useState('');
  const [search, setSearch]     = useState('');
  const [view, setView]         = useState('table');

  const [createModal, setCreateModal]   = useState(false);
  const [editModal, setEditModal]       = useState(null);
  const [viewModal, setViewModal]       = useState(null);
  const [receiveModal, setReceiveModal] = useState(null);
  const [cancelModal, setCancelModal]   = useState(null);
  const [deleteModal, setDeleteModal]   = useState(null);
  const [viewLoading, setViewLoading]   = useState(false);

  const [form, setForm]       = useState(EMPTY_FORM);
  const [poItems, setPoItems] = useState([{ ...EMPTY_ITEM }]);
  const [receiveData, setReceiveData] = useState({ invoice_no: '', bill_amount: '', notes: '', items: [] });

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, inv, u, v, s] = await Promise.all([getPurchaseOrders(), getInventory(), getUnits(), getVendors(), getSettings()]);
      if (o.success)   setOrders(o.data);
      if (inv.success) setInvItems(inv.data);
      if (u.success)   setUnits(u.data);
      if (v.success)   setVendors(v.data);
      if (s.success)   setSettings(s.data || {});
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => orders.filter(o => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search && !o.po_number.toLowerCase().includes(search.toLowerCase())
                && !(o.supplier || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [orders, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { pending: 0, partial: 0, received: 0, cancelled: 0 };
    orders.forEach(o => { if (c[o.status] !== undefined) c[o.status]++; });
    return c;
  }, [orders]);

  // ── PO item helpers ──────────────────────────────────────────────────────
  const updatePoItem = useCallback((idx, field, val) => {
    setPoItems(prev => {
      const next = [...prev];
      const old  = next[idx];
      next[idx]  = { ...old, [field]: val };

      // ── Unit change: convert unit_price proportionally ──────────────────
      // e.g. switching from kg → g: ₹100/kg becomes ₹0.1/g
      if (field === 'unit_id' && old.unit_id && val && old.unit_price) {
        const fromUnit = units.find(u => u.id === parseInt(old.unit_id));
        const toUnit   = units.find(u => u.id === parseInt(val));
        if (fromUnit && toUnit && fromUnit.id !== toUnit.id) {
          const newPrice = convertPrice(parseFloat(old.unit_price), fromUnit, toUnit);
          next[idx].unit_price = +newPrice.toFixed(4);
        }
      }

      const q = parseFloat(field === 'quantity'   ? val : next[idx].quantity)   || 0;
      const p = parseFloat(field === 'unit_price' ? val : next[idx].unit_price) || 0;
      next[idx].total = +(q * p).toFixed(2);
      return next;
    });
  }, [units]);

  const removePoItem = useCallback((idx) => {
    setPoItems(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ ...EMPTY_ITEM }];
    });
  }, []);

  const addPickedItems = useCallback((picked) => {
    setPoItems(prev => {
      const existing = prev.filter(r => r.inventory_item_id);
      const existingIds = new Set(existing.map(r => parseInt(r.inventory_item_id)));
      const newRows = picked
        .filter(item => !existingIds.has(item.id))
        .map(item => ({
          inventory_item_id: item.id,
          unit_id: item.unit_id || '',
          quantity: '',
          unit_price: item.purchase_price || '',
          total: 0,
        }));
      const merged = [...existing, ...newRows];
      return merged.length ? merged : [{ ...EMPTY_ITEM }];
    });
  }, []);

  const poTotal = poItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

  // ── Modal openers ────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setPoItems([{ ...EMPTY_ITEM }]);
    setCreateModal(true);
  };

  const openEdit = async (po) => {
    setViewLoading(true);
    try {
      const d = await getPurchaseOrder(po.id);
      if (d.success) {
        const p = d.data;
        setForm({
          vendor_id:        p.vendor_id  ? String(p.vendor_id) : '',
          supplier:         p.supplier   || '',
          supplier_phone:   p.supplier_phone   || '',
          supplier_address: p.supplier_address || '',
          expected_date:    p.expected_date?.split('T')[0] || '',
          notes:            p.notes || '',
        });
        setPoItems(p.items.map(i => ({ id: i.id, inventory_item_id: i.inventory_item_id, unit_id: i.unit_id || '', quantity: i.ordered_qty, unit_price: i.unit_price, total: i.total_price })));
        setEditModal(p);
      }
    } finally { setViewLoading(false); }
  };

  const openView = async (po) => {
    setViewLoading(true);
    setViewModal({ ...po, items: [] });
    try {
      const d = await getPurchaseOrder(po.id);
      if (d.success) setViewModal(d.data);
    } finally { setViewLoading(false); }
  };

  const openReceive = async (po) => {
    setViewLoading(true);
    try {
      const d = await getPurchaseOrder(po.id);
      if (d.success) {
        const p = d.data;
        setReceiveData({
          invoice_no: p.invoice_no || '', bill_amount: p.bill_amount || '', notes: '',
          items: p.items.map(i => ({
            item_id:          i.id,
            item_name:        i.item_name,
            inventory_item_id: i.inventory_item_id,
            unit_id:          i.unit_id,          // current PO unit
            unit_abbr:        i.unit_abbr,
            ordered_qty:      i.ordered_qty,
            already_received: i.received_qty || 0,
            received_qty:     Math.max(0, parseFloat(i.ordered_qty) - parseFloat(i.received_qty || 0)),
            unit_price:       i.unit_price,
            new_unit_price:   i.unit_price,
            receive_unit_id:  i.unit_id,          // unit user wants to receive in (can change)
            receive_unit_abbr: i.unit_abbr,
          }))
        });
        setReceiveModal(p);
      }
    } finally { setViewLoading(false); }
  };

  // ── Print PO ──────────────────────────────────────────────────────────────
  const printPO = async (po) => {
    let fullPO = po;
    if (!po.items || !po.items.length) {
      const d = await getPurchaseOrder(po.id);
      if (d.success) fullPO = d.data;
    }
    const items = fullPO.items || [];
    const total = items.reduce((s, i) => s + parseFloat(i.total_price || 0), 0);
    const now = new Date();
    const printDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const printTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const expectedDate = fullPO.expected_date
      ? new Date(fullPO.expected_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    const statusMeta = { pending:'#b07a00', partial:'#118ab2', received:'#1db97e', cancelled:'#e84a5f' };
    const statusLabel = { pending:'Pending', partial:'Partial', received:'Received', cancelled:'Cancelled' };
    const sc = statusMeta[fullPO.status] || '#888';
    const sl = statusLabel[fullPO.status] || fullPO.status;

    const infoRow = (l, v) => v ? `<tr><td style="padding:3px 0;color:#555;font-size:12px;width:130px;vertical-align:top">${l}</td><td style="padding:3px 0;font-weight:600;font-size:12px">${v}</td></tr>` : '';

    const itemRows = items.map((item, i) => `
      <tr style="background:${i%2===0?'#fff':'#f8f8f8'};border-bottom:1px solid #e0e0e0">
        <td style="padding:8px 10px;color:#888;font-size:11px">${i+1}</td>
        <td style="padding:8px 10px;font-weight:600">${item.item_name||''}</td>
        <td style="padding:8px 10px;font-size:11px;color:#666">${item.category_name||'—'}</td>
        <td style="padding:8px 10px;text-align:center">${item.ordered_qty}</td>
        <td style="padding:8px 10px;text-align:center;font-size:11px;color:#666">${item.unit_abbr||'—'}</td>
        <td style="padding:8px 10px;text-align:right">₹${parseFloat(item.unit_price).toFixed(2)}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700">₹${parseFloat(item.total_price).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>PO - ${fullPO.po_number}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;background:#fff;padding:32px}
      @media print{body{padding:16px}@page{margin:10mm;size:A4}}
      table{border-collapse:collapse;width:100%}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111">
      <div>
        <div style="font-size:22px;font-weight:900">${settings?.restaurant_name||'Restaurant'}</div>
        ${settings?.address?`<div style="font-size:11px;color:#555;margin-top:2px">${settings.address}</div>`:''}
        ${settings?.phone?`<div style="font-size:11px;color:#555">📞 ${settings.phone}</div>`:''}
        ${settings?.email?`<div style="font-size:11px;color:#555">✉️ ${settings.email}</div>`:''}
        ${settings?.gst_number?`<div style="font-size:11px;color:#555">GST: ${settings.gst_number}</div>`:''}
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:900;color:#c0392b">PURCHASE ORDER</div>
        <div style="font-size:22px;font-weight:900;font-family:monospace;margin-top:4px">${fullPO.po_number}</div>
        <div style="font-size:11px;color:#555;margin-top:6px">Printed: ${printDate} ${printTime}</div>
        <div style="margin-top:6px;display:inline-block;padding:3px 10px;border-radius:4px;color:${sc};font-weight:700;font-size:12px;border:1px solid ${sc}">${sl}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div>
        <div style="font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">Supplier / Vendor</div>
        <table style="width:auto"><tbody>
          ${infoRow('Name', fullPO.supplier)}
          ${infoRow('Phone', fullPO.supplier_phone)}
          ${infoRow('Address', fullPO.supplier_address)}
          ${infoRow('Invoice', fullPO.invoice_no)}
          ${!fullPO.supplier?'<tr><td style="font-size:12px;color:#999;font-style:italic">No supplier details</td></tr>':''}
        </tbody></table>
      </div>
      <div>
        <div style="font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">Order Details</div>
        <table style="width:auto"><tbody>
          ${infoRow('PO Number', fullPO.po_number)}
          ${infoRow('Expected By', expectedDate)}
          ${infoRow('Created By', fullPO.created_by_name)}
          ${fullPO.bill_amount?infoRow('Bill Amount',`₹${parseFloat(fullPO.bill_amount).toFixed(2)}`):'' }
        </tbody></table>
      </div>
    </div>
    <table>
      <thead>
        <tr style="background:#111;color:#fff">
          <th style="padding:8px 10px;text-align:left;width:32px">#</th>
          <th style="padding:8px 10px;text-align:left">Item</th>
          <th style="padding:8px 10px;text-align:left;width:100px">Category</th>
          <th style="padding:8px 10px;text-align:center;width:80px">Qty</th>
          <th style="padding:8px 10px;text-align:center;width:60px">Unit</th>
          <th style="padding:8px 10px;text-align:right;width:100px">₹/Unit</th>
          <th style="padding:8px 10px;text-align:right;width:110px">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background:#f0f0f0;border-top:2px solid #111">
          <td colspan="5"></td>
          <td style="padding:10px;text-align:right;font-weight:700;font-size:13px">Order Total</td>
          <td style="padding:10px;text-align:right;font-weight:900;font-size:16px">₹${total.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    ${fullPO.notes?`<div style="margin-top:20px;padding:10px 14px;background:#fffbe6;border:1px solid #ffe08a;border-radius:6px;font-size:12px"><strong>Notes:</strong> ${fullPO.notes}</div>`:''}
    <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px">
      ${['Prepared By','Authorised By','Received By'].map(l=>`<div style="text-align:center"><div style="border-top:1px solid #888;padding-top:6px;font-size:11px;color:#666">${l}</div></div>`).join('')}
    </div>
    <div style="margin-top:24px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px">
      Generated by ${settings?.restaurant_name||'Tasteza'} · ${printDate}
    </div>
    <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>`;

    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(html);
    win.document.close();
  };

  const saveCreate = async () => {
    const validItems = poItems.filter(i => i.inventory_item_id && i.quantity);
    if (!validItems.length) { toast('Add at least one item with quantity.', 'er'); return; }
    try {
      const d = await createPurchaseOrder({ ...form, items: validItems });
      if (d.success) { toast(`Order ${d.data.po_number} created! ✅`, 'ok'); setCreateModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const saveEdit = async () => {
    const validItems = poItems.filter(i => i.inventory_item_id && i.quantity);
    if (!validItems.length) { toast('Add at least one item.', 'er'); return; }
    try {
      const d = await updatePurchaseOrder(editModal.id, { ...form, items: validItems });
      if (d.success) { toast('Order updated! ✅', 'ok'); setEditModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const doReceive = async () => {
    if (!receiveData.items.some(i => parseFloat(i.received_qty) > 0)) {
      toast('Enter received quantity for at least one item.', 'er'); return;
    }
    try {
      const d = await receivePurchaseOrder(receiveModal.id, {
        invoice_no: receiveData.invoice_no, bill_amount: receiveData.bill_amount, notes: receiveData.notes,
        items: receiveData.items.map(i => ({
          item_id:          i.item_id,
          received_qty:     i.received_qty,
          new_unit_price:   i.new_unit_price,
          receive_unit_id:  i.receive_unit_id,   // unit received in (may differ from PO unit)
        }))
      });
      if (d.success) { toast('Stock updated! ✅', 'ok'); setReceiveModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const doCancel = async () => {
    try {
      const d = await cancelPurchaseOrder(cancelModal.id);
      if (d.success) { toast('Order cancelled.', 'ok'); setCancelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const doDelete = async () => {
    try {
      const d = await deletePurchaseOrder(deleteModal.id);
      if (d.success) { toast('Order deleted.', 'ok'); setDeleteModal(null); load(); }
      else toast(err?.response?.data?.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const StatusBadge = ({ status }) => {
    const m = STATUS_META[status] || STATUS_META.pending;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: m.bg, color: m.color }}>
        {m.icon} {m.label}
      </span>
    );
  };

  // ── Shared form props ────────────────────────────────────────────────────
  const formProps = {
    form, setForm, poItems, units, invItems, vendors,
    updatePoItem, removePoItem, addPickedItems, poTotal
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Purchase Orders</div>
          <div className="ps">Create orders, track delivery and receive items to auto-update inventory</div>
        </div>
        <button className="btn-p" onClick={openCreate}>+ New Order</button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>📋</div><div className="scard-text"><div className="sv">{orders.length}</div><div className="sl">Total Orders</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #b07a00' }}><div style={{ fontSize: 20 }}>🕐</div><div className="scard-text"><div className="sv" style={{ color: '#b07a00' }}>{counts.pending}</div><div className="sl">Pending</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #118ab2' }}><div style={{ fontSize: 20 }}>📦</div><div className="scard-text"><div className="sv" style={{ color: '#118ab2' }}>{counts.partial}</div><div className="sl">Partial</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv">{counts.received}</div><div className="sl">Received</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #e84a5f' }}><div style={{ fontSize: 20 }}>❌</div><div className="scard-text"><div className="sv" style={{ color: '#e84a5f' }}>{counts.cancelled}</div><div className="sl">Cancelled</div></div></div>
      </div>

      {/* List card */}
      <div className="card">
        <div className="ch">
          <div className="ct">All Purchase Orders</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vt-wrap">
              <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
              <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search PO# or supplier…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="fsel" value={statusFilter} onChange={e => setStatus(e.target.value)}>
              <option value="">All Status ({orders.length})</option>
              <option value="pending">🕐 Pending ({counts.pending})</option>
              <option value="partial">📦 Partial ({counts.partial})</option>
              <option value="received">✅ Received ({counts.received})</option>
              <option value="cancelled">❌ Cancelled ({counts.cancelled})</option>
            </select>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0 ? (
          <div className="empty"><div className="ei">📋</div><h4>No purchase orders</h4><p>Create your first order</p></div>
        ) : view === 'table' ? (
          <div className="overflow-x">
            <table>
              <thead>
                <tr>
                  <th>PO Number</th><th>Supplier</th><th>Items</th>
                  <th>Total Amount</th><th>Expected</th><th>Status</th>
                  <th>Created By</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 13 }}>{o.po_number}</strong>
                      <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{fmtDate(o.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.supplier || '—'}</div>
                      {o.supplier_phone && <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{o.supplier_phone}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{o.item_count} item{o.item_count !== 1 ? 's' : ''}</td>
                    <td><strong>{fmtCur(o.total_amount)}</strong></td>
                    <td style={{ fontSize: 13, color: 'var(--ink2)' }}>{o.expected_date ? o.expected_date.split('T')[0] : '—'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ fontSize: 13 }}>{o.created_by_name}</td>
                    <td>
                      <div className="tact">
                        <button className="bsm bo" onClick={() => openView(o)}>👁️</button>
                        <button className="bsm" onClick={() => printPO(o)} title="Print" style={{ background:'rgba(99,102,241,.1)', color:'#6366f1' }}>🖨️</button>
                        {o.status === 'pending' && <>
                          <button className="bsm be" onClick={() => openEdit(o)}>✏️</button>
                          <button className="bsm bt" style={{ background: 'rgba(29,185,126,.1)', color: 'var(--green)' }}
                            onClick={() => openReceive(o)}>📥 Receive</button>
                          <button className="bsm bd" onClick={() => setCancelModal(o)}>✕</button>
                        </>}
                        {o.status === 'partial' && (
                          <button className="bsm bt" style={{ background: 'rgba(29,185,126,.1)', color: 'var(--green)' }}
                            onClick={() => openReceive(o)}>📥 Receive</button>
                        )}
                        <button className="bsm bd" onClick={() => setDeleteModal(o)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="inv-grid" style={{ padding: 20 }}>
            {filtered.map(o => {
              const m = STATUS_META[o.status] || STATUS_META.pending;
              return (
                <div key={o.id} className="inv-card" style={{ borderTop: `3px solid ${m.color}` }}>
                  <div className="inv-card-top">
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: m.bg, flexShrink: 0 }}>{m.icon}</div>
                    <div className="inv-card-info"><h4 style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{o.po_number}</h4><p>{o.supplier || 'No supplier'}</p></div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="inv-card-body">
                    <div className="inv-kv"><div className="k">Total</div><div className="v">{fmtCur(o.total_amount)}</div></div>
                    <div className="inv-kv"><div className="k">Items</div><div className="v">{o.item_count}</div></div>
                    <div className="inv-kv"><div className="k">Expected</div><div className="v" style={{ fontSize: 13 }}>{o.expected_date ? o.expected_date.split('T')[0] : '—'}</div></div>
                    <div className="inv-kv"><div className="k">Created</div><div className="v" style={{ fontSize: 12 }}>{fmtDate(o.created_at)}</div></div>
                  </div>
                  <div className="inv-card-foot">
                    <button className="bsm bo" onClick={() => openView(o)}>👁️ View</button>
                    <button className="bsm" onClick={() => printPO(o)} title="Print" style={{ background:'rgba(99,102,241,.1)', color:'#6366f1' }}>🖨️</button>
                    {(o.status === 'pending' || o.status === 'partial') && (
                      <button className="bsm bt" style={{ background: 'rgba(29,185,126,.1)', color: 'var(--green)' }} onClick={() => openReceive(o)}>📥 Receive</button>
                    )}
                    {o.status === 'pending' && <button className="bsm be" onClick={() => openEdit(o)}>✏️</button>}
                    <button className="bsm bd" onClick={() => setDeleteModal(o)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ─────────────────────────────────────────────────── */}
      <Modal show={createModal} onClose={() => setCreateModal(false)}
        title="New Purchase Order" subtitle="Create an order for inventory items" wide
        footer={<>
          <button className="btn-c" onClick={() => setCreateModal(false)}>Cancel</button>
          <button className="btn-p" onClick={saveCreate}>Create Order</button>
        </>}>
        <PoFormContent {...formProps} />
      </Modal>

      {/* ── EDIT MODAL ───────────────────────────────────────────────────── */}
      <Modal show={!!editModal} onClose={() => setEditModal(null)}
        title={`Edit Order — ${editModal?.po_number}`} subtitle="Edit pending order" wide
        footer={<>
          <button className="btn-c" onClick={() => setEditModal(null)}>Cancel</button>
          <button className="btn-p" onClick={saveEdit}>Save Changes</button>
        </>}>
        <PoFormContent {...formProps} />
      </Modal>

      {/* ── VIEW MODAL ───────────────────────────────────────────────────── */}
      <Modal show={!!viewModal} onClose={() => setViewModal(null)}
        title={viewModal?.po_number || ''}
        subtitle={`${STATUS_META[viewModal?.status]?.icon || ''} ${viewModal?.supplier || 'No supplier'}`}
        wide>
        {viewLoading || !viewModal?.items ? <div className="loading-wrap">Loading…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="view-strip">
              <div className="vs-item"><div className="vs-label">Status</div><div className="vs-val"><StatusBadge status={viewModal.status} /></div></div>
              <div className="vs-item"><div className="vs-label">Total</div><div className="vs-val" style={{ color: 'var(--accent)' }}>{fmtCur(viewModal.total_amount)}</div></div>
              {viewModal.bill_amount && <div className="vs-item"><div className="vs-label">Bill Amt</div><div className="vs-val">{fmtCur(viewModal.bill_amount)}</div></div>}
              <div className="vs-item"><div className="vs-label">Items</div><div className="vs-val">{viewModal.items?.length || 0}</div></div>
              <div className="vs-item"><div className="vs-label">Expected</div><div className="vs-val" style={{ fontSize: 14 }}>{viewModal.expected_date?.split('T')[0] || '—'}</div></div>
            </div>
            {(viewModal.supplier || viewModal.supplier_phone || viewModal.supplier_address) && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, border: '1.5px solid var(--border)' }}>
                <div className="view-section-title">🏪 Supplier</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  {viewModal.supplier && <div><span style={{ color: 'var(--ink2)' }}>Name: </span><strong>{viewModal.supplier}</strong></div>}
                  {viewModal.supplier_phone && <div><span style={{ color: 'var(--ink2)' }}>Phone: </span><strong>{viewModal.supplier_phone}</strong></div>}
                  {viewModal.invoice_no && <div><span style={{ color: 'var(--ink2)' }}>Invoice: </span><strong>{viewModal.invoice_no}</strong></div>}
                </div>
                {viewModal.supplier_address && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 8 }}>{viewModal.supplier_address}</div>}
              </div>
            )}
            <div>
              <div className="view-section-title">🧺 Order Items</div>
              <div className="view-table">
                <div className="vt-head">
                  <div style={{ flex: 2 }}>Item</div>
                  <div style={{ width: 100 }}>Ordered</div><div style={{ width: 100 }}>Received</div>
                  <div style={{ width: 100 }}>₹/Unit</div><div style={{ width: 110, textAlign: 'right' }}>Total</div>
                </div>
                {(viewModal.items || []).map((item, idx) => {
                  const pending = parseFloat(item.ordered_qty) - parseFloat(item.received_qty || 0);
                  return (
                    <div key={idx} className="vt-row">
                      <div style={{ flex: 2 }}><strong>{item.item_name}</strong><div style={{ fontSize: 11, color: 'var(--ink2)' }}>{item.category_name}</div></div>
                      <div style={{ width: 100 }}>{item.ordered_qty} {item.unit_abbr}</div>
                      <div style={{ width: 100 }}>
                        <span style={{ color: parseFloat(item.received_qty) >= parseFloat(item.ordered_qty) ? 'var(--green)' : parseFloat(item.received_qty) > 0 ? '#118ab2' : 'var(--ink2)' }}>
                          {item.received_qty || 0} {item.unit_abbr}
                        </span>
                        {pending > 0 && <div style={{ fontSize: 10, color: '#b07a00' }}>Pending: {pending}</div>}
                      </div>
                      <div style={{ width: 100 }}>{fmtCur(item.unit_price)}</div>
                      <div style={{ width: 110, textAlign: 'right', fontWeight: 700 }}>{fmtCur(item.total_price)}</div>
                    </div>
                  );
                })}
                <div className="vt-row vt-subtotal">
                  <div style={{ flex: 2 }}>Grand Total</div>
                  <div style={{ width: 100 }} /><div style={{ width: 100 }} /><div style={{ width: 100 }} />
                  <div style={{ width: 110, textAlign: 'right' }}>{fmtCur(viewModal.total_amount)}</div>
                </div>
              </div>
            </div>
            {(viewModal.notes || viewModal.receive_notes) && (
              <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                {viewModal.notes && <div>📝 {viewModal.notes}</div>}
                {viewModal.receive_notes && <div style={{ marginTop: 4 }}>📥 {viewModal.receive_notes}</div>}
              </div>
            )}
            {(viewModal.status === 'pending' || viewModal.status === 'partial') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-p" onClick={() => { setViewModal(null); openReceive(viewModal); }}>📥 Receive Items</button>
              </div>
            )}
          </div>
        )}
        <div className="mft">
            <button className="btn-c" onClick={() => setViewModal(null)}>Close</button>
            <button className="btn-p" style={{ background:'#6366f1' }} onClick={() => printPO(viewModal)}>🖨️ Print PO</button>
        </div>
      </Modal>

      {/* ── RECEIVE MODAL ────────────────────────────────────────────────── */}
      <Modal show={!!receiveModal} onClose={() => setReceiveModal(null)}
        title={`Receive Items — ${receiveModal?.po_number}`}
        subtitle="Enter quantities received. Stock will be updated immediately."
        wide
        footer={<>
          <button className="btn-c" onClick={() => setReceiveModal(null)}>Cancel</button>
          <button className="btn-p" style={{ background: 'var(--green)' }} onClick={doReceive}>✅ Confirm Receipt & Update Stock</button>
        </>}>
        {receiveModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="recipe-section">
              <div className="recipe-section-title">🧾 Bill Details</div>
              <div className="mgrid">
                <div>
                  <label className="mlabel">Invoice / Bill No.</label>
                  <input className="mfi" placeholder="e.g. INV-2024-001" value={receiveData.invoice_no}
                    onChange={e => setReceiveData(d => ({ ...d, invoice_no: e.target.value }))} />
                </div>
                <div>
                  <label className="mlabel">Bill Amount (₹)</label>
                  <input className="mfi" type="number" placeholder="Total billed amount" value={receiveData.bill_amount}
                    onChange={e => setReceiveData(d => ({ ...d, bill_amount: e.target.value }))} />
                </div>
                <div className="mfull">
                  <label className="mlabel">Receive Notes</label>
                  <input className="mfi" placeholder="e.g. Some items damaged…" value={receiveData.notes}
                    onChange={e => setReceiveData(d => ({ ...d, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <hr className="mdiv" />
            <div className="recipe-section">
              <div className="recipe-section-title">📦 Items Received</div>
              <div className="ri-table">
                <div className="ri-thead">
                  <div style={{ flex: 2 }}>Item</div>
                  <div style={{ width: 80 }}>Ordered</div>
                  <div style={{ width: 75 }}>Rcvd</div>
                  <div style={{ width: 100 }}>Receiving Qty *</div>
                  <div style={{ width: 110 }}>Receive In</div>
                  <div style={{ width: 110 }}>₹/Unit (Actual)</div>
                  <div style={{ width: 90, textAlign: 'right' }}>Value</div>
                </div>
                {receiveData.items.map((item, idx) => {
                  const max = parseFloat(item.ordered_qty) - parseFloat(item.already_received || 0);
                  const priceChanged = parseFloat(item.new_unit_price) !== parseFloat(item.unit_price);
                  const unitChanged  = item.receive_unit_id !== item.unit_id;
                  return (
                    <div key={idx} className="ri-row2">
                      <div style={{ flex: 2 }}>
                        <strong>{item.item_name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--ink2)' }}>
                          PO unit: {item.unit_abbr}
                        </div>
                      </div>
                      <div style={{ width: 80, fontSize: 13 }}>
                        {item.ordered_qty} {item.unit_abbr}
                      </div>
                      <div style={{ width: 75, fontSize: 13, color: item.already_received > 0 ? '#118ab2' : 'var(--ink2)' }}>
                        {item.already_received || 0}
                      </div>
                      <div style={{ width: 100 }}>
                        <input className="ri-qty" type="number" min="0" placeholder="0"
                          value={item.received_qty} style={{ width: '100%' }}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setReceiveData(d => ({ ...d, items: d.items.map((x, i) => i === idx ? { ...x, received_qty: val } : x) }));
                          }} />
                        {max > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--ink2)', marginTop: 2 }}>
                            max {max} {item.unit_abbr}
                          </div>
                        )}
                      </div>
                      <div style={{ width: 110 }}>
                        <select className="ri-sel" style={{ width: '100%' }}
                          value={item.receive_unit_id || ''}
                          onChange={e => {
                            const newUnitId = parseInt(e.target.value);
                            const fromUnit  = units.find(u => u.id === parseInt(item.receive_unit_id || item.unit_id));
                            const toUnit    = units.find(u => u.id === newUnitId);
                            const newAbbr   = toUnit?.abbreviation || item.unit_abbr;
                            // Convert price when unit changes
                            const newPrice  = (fromUnit && toUnit)
                              ? +convertPrice(parseFloat(item.new_unit_price || item.unit_price), fromUnit, toUnit).toFixed(4)
                              : item.new_unit_price;
                            setReceiveData(d => ({ ...d, items: d.items.map((x, i) => i === idx ? {
                              ...x,
                              receive_unit_id:   newUnitId,
                              receive_unit_abbr: newAbbr,
                              new_unit_price:    newPrice,
                            } : x) }));
                          }}>
                          {units.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                        </select>
                        {unitChanged && (
                          <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, fontWeight: 700 }}>
                            ≠ PO unit ({item.unit_abbr})
                          </div>
                        )}
                      </div>
                      <div style={{ width: 110 }}>
                        <input className="ri-qty" type="number" min="0" placeholder="₹0"
                          value={item.new_unit_price} style={{ width: '100%' }}
                          onChange={e => {
                            setReceiveData(d => ({ ...d, items: d.items.map((x, i) => i === idx ? { ...x, new_unit_price: e.target.value } : x) }));
                          }} />
                        {priceChanged && (
                          <div style={{ fontSize: 10, marginTop: 2, color: '#f59e0b', fontWeight: 700 }}>
                            was ₹{parseFloat(item.unit_price).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                        {fmtCur((parseFloat(item.received_qty) || 0) * parseFloat(item.new_unit_price || item.unit_price))}
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', background: 'rgba(29,185,126,.04)', borderTop: '2px solid rgba(29,185,126,.2)' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>Stock Value Being Added</span>
                  <strong style={{ color: 'var(--green)', fontSize: 16 }}>
                    {fmtCur(receiveData.items.reduce((s, i) => s + (parseFloat(i.received_qty) || 0) * parseFloat(i.new_unit_price || i.unit_price), 0))}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── CONFIRM MODALS ───────────────────────────────────────────────── */}
      <ConfirmModal show={!!cancelModal} onClose={() => setCancelModal(null)} onConfirm={doCancel}
        title="Cancel Order" message={`Cancel order ${cancelModal?.po_number}? This cannot be undone.`} />
      <ConfirmModal show={!!deleteModal} onClose={() => setDeleteModal(null)} onConfirm={doDelete}
        title="Delete Order" message={`Permanently delete ${deleteModal?.po_number}?`} />

    </div>
  );
}