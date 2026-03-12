import React, { useState, useEffect } from 'react';
import { getPurchases, getInventory, getCategories, createPurchase } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur, fmtDateShort } from '../../utils';
import Modal from '../ui/Modal';

const EMPTY = { inventory_item_id: '', quantity: '', price_per_unit: '', purchase_date: new Date().toISOString().split('T')[0], supplier: '', invoice_no: '', notes: '' };

export default function PurchasesPage() {
  const toast = useToast();
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [view, setView] = useState('table');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try {
      const [p, inv, c] = await Promise.all([getPurchases(), getInventory(), getCategories()]);
      if (p.success) setPurchases(p.data);
      if (inv.success) setItems(inv.data);
      if (c.success) setCats(c.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!form.inventory_item_id || !form.quantity || !form.price_per_unit || !form.purchase_date) {
      toast('Item, quantity, price and date are required.', 'er'); return;
    }
    try {
      const total = parseFloat(form.quantity) * parseFloat(form.price_per_unit);
      const d = await createPurchase({ ...form, total_amount: total });
      if (d.success) { toast('Purchase recorded! ✅', 'ok'); setModal(false); setForm(EMPTY); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const filtered = purchases.filter(p => {
    if (search && !p.item_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && p.category_id !== parseInt(catFilter)) return false;
    return true;
  });

  const totalSpend = purchases.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0);
  const thisMonth = purchases.filter(p => new Date(p.purchase_date).getMonth() === new Date().getMonth());
  const monthSpend = thisMonth.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0);

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Purchase History</div>
          <div className="ps">All inventory purchases and spend tracking</div>
        </div>
        <button className="btn-p" onClick={() => { setForm(EMPTY); setModal(true); }}>🛒 Record Purchase</button>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>📋</div><div className="scard-text"><div className="sv">{purchases.length}</div><div className="sl">Total Purchases</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>📅</div><div className="scard-text"><div className="sv">{thisMonth.length}</div><div className="sl">This Month</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>💸</div><div className="scard-text"><div className="sv small">{fmtCur(totalSpend)}</div><div className="sl">Total Spend</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>🗓️</div><div className="scard-text"><div className="sv small">{fmtCur(monthSpend)}</div><div className="sl">Month Spend</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">All Purchases</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vt-wrap">
              <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
              <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="fsel" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0
          ? <div className="empty"><div className="ei">🛒</div><h4>No purchases yet</h4><p>Record your first purchase</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th>Supplier</th><th>Date</th><th>Invoice</th></tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.item_name}</strong></td>
                      <td style={{ fontSize: 13 }}>{p.category_name || '—'}</td>
                      <td><strong>{p.quantity}</strong> <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{p.unit_abbr}</span></td>
                      <td>{fmtCur(p.price_per_unit)}</td>
                      <td><strong>{fmtCur(p.total_amount)}</strong></td>
                      <td style={{ fontSize: 13 }}>{p.supplier || '—'}</td>
                      <td style={{ fontSize: 13 }}>{fmtDateShort(p.purchase_date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--ink2)' }}>{p.invoice_no || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {filtered.map(p => (
                <div key={p.id} className="inv-card">
                  <div className="inv-card-top">
                    <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(232,87,42,.10)', flexShrink: 0 }}>🛒</div>
                    <div className="inv-card-info">
                      <h4>{p.item_name}</h4>
                      <p>{p.category_name || 'Uncategorised'}</p>
                    </div>
                  </div>
                  <div className="inv-card-body">
                    <div className="inv-kv">
                      <div className="k">Quantity</div>
                      <div className="v">{p.quantity} <span style={{ fontSize: 12 }}>{p.unit_abbr}</span></div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Price/Unit</div>
                      <div className="v">{fmtCur(p.price_per_unit)}</div>
                    </div>
                    <div className="inv-kv" style={{ gridColumn: '1/-1' }}>
                      <div className="k">Total Amount</div>
                      <div className="v" style={{ color: 'var(--accent)' }}>{fmtCur(p.total_amount)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>
                    <span>{p.supplier || 'No supplier'}</span>
                    <span>{fmtDateShort(p.purchase_date)}</span>
                  </div>
                  {p.invoice_no && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>Invoice: {p.invoice_no}</div>}
                </div>
              ))}
            </div>
          )
        }
      </div>

      <Modal show={modal} onClose={() => setModal(false)}
        title="Record Purchase" subtitle="Log a new inventory purchase" wide
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div className="mgrid">
          <div className="mfull">
            <label className="mlabel">Inventory Item *</label>
            <select className="mfi" value={form.inventory_item_id} onChange={e => setForm(f => ({ ...f, inventory_item_id: e.target.value }))}>
              <option value="">Select item…</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category_name})</option>)}
            </select>
          </div>
          <div>
            <label className="mlabel">Quantity *</label>
            <input className="mfi" type="number" placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Price Per Unit *</label>
            <input className="mfi" type="number" placeholder="₹0.00" value={form.price_per_unit} onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Purchase Date *</label>
            <input className="mfi" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Supplier</label>
            <input className="mfi" placeholder="Supplier name" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Invoice No.</label>
            <input className="mfi" placeholder="Optional" value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} />
          </div>
          {form.quantity && form.price_per_unit && (
            <div className="mfull" style={{ background: 'rgba(232,87,42,.06)', borderRadius: 10, padding: '12px 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Total: {fmtCur(parseFloat(form.quantity) * parseFloat(form.price_per_unit))}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
