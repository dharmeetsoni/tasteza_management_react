import React, { useState, useEffect } from 'react';
import { getInventory, getCategories, getUnits, createInventoryItem, updateInventoryItem, deleteInventoryItem, adjustStock, getItemPurchases } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const EMPTY_FORM = { name: '', category_id: '', unit_id: '', current_quantity: '', min_quantity: '', purchase_price: '', selling_price: '', supplier: '', notes: '' };

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeCat, setActiveCat] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [delModal, setDelModal] = useState(null);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ adjustment_type: 'add', quantity: '', reason: '' });
  const [histModal, setHistModal] = useState(null);
  const [histData, setHistData] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, c, u] = await Promise.all([getInventory(), getCategories(), getUnits()]);
      if (inv.success) setItems(inv.data);
      if (c.success) setCats(c.data);
      if (u.success) setUnits(u.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const openModal = (item = null) => {
    setEditing(item);
    setForm(item ? { name: item.name, category_id: item.category_id, unit_id: item.unit_id, current_quantity: item.current_quantity, min_quantity: item.min_quantity || '', purchase_price: item.purchase_price || '', selling_price: item.selling_price || '', supplier: item.supplier || '', notes: item.notes || '' } : EMPTY_FORM);
    setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.category_id || !form.unit_id) { toast('Name, category and unit are required.', 'er'); return; }
    try {
      const d = editing ? await updateInventoryItem(editing.id, form) : await createInventoryItem(form);
      if (d.success) { toast(editing ? 'Item updated! ✅' : 'Item created! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteInventoryItem(delModal.id);
      if (d.success) { toast('Item deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  const doAdjust = async () => {
    if (!adjustForm.quantity || adjustForm.quantity <= 0) { toast('Quantity required.', 'er'); return; }
    try {
      const d = await adjustStock(adjustModal.id, adjustForm);
      if (d.success) { toast('Stock adjusted! ✅', 'ok'); setAdjustModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  const openHist = async (item) => {
    setHistModal(item); setHistData([]);
    try {
      const d = await getItemPurchases(item.id);
      if (d.success) setHistData(d.data);
    } catch {}
  };

  const stockStatus = (item) => {
    const qty = parseFloat(item.current_quantity) || 0;
    if (qty <= 0) return 'empty';
    if (item.min_quantity && qty <= parseFloat(item.min_quantity)) return 'low';
    return 'ok';
  };

  const filtered = items.filter(i => {
    if (activeCat && i.category_id !== parseInt(activeCat)) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && i.category_id !== parseInt(catFilter)) return false;
    if (statusFilter && stockStatus(i) !== statusFilter) return false;
    return true;
  });

  const totalValue = items.reduce((s, i) => s + ((parseFloat(i.current_quantity) || 0) * (parseFloat(i.purchase_price) || 0)), 0);
  const lowCount = items.filter(i => stockStatus(i) === 'low').length;
  const outCount = items.filter(i => stockStatus(i) === 'empty').length;

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Inventory</div>
          <div className="ps">Track stock levels, set reorder points, manage all items</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-p" onClick={() => openModal()}>+ Add Item</button>
        </div>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>📦</div><div className="scard-text"><div className="sv">{items.length}</div><div className="sl">Total Items</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>⚠️</div><div className="scard-text"><div className="sv" style={{ color: 'var(--red)' }}>{lowCount}</div><div className="sl">Low Stock</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>❌</div><div className="scard-text"><div className="sv" style={{ color: 'var(--red)' }}>{outCount}</div><div className="sl">Out of Stock</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>💰</div><div className="scard-text"><div className="sv small">{fmtCur(totalValue)}</div><div className="sl">Stock Value</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct" id="invCardTitle">
            {activeCat ? cats.find(c => c.id === parseInt(activeCat))?.name || 'All Items' : 'All Items'}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vt-wrap">
              <button className={`vt-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>☰ Table</button>
              <button className={`vt-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="fsel" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="fsel" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="low">Low Stock</option>
              <option value="ok">In Stock</option>
              <option value="empty">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Category tabs */}
        <div className="cat-tabs">
          <div className={`ctab ${activeCat === '' ? 'active' : ''}`} onClick={() => setActiveCat('')}>All</div>
          {cats.map(c => {
            const icon = c.image_url?.startsWith('icon:') ? c.image_url.replace('icon:', '').split('|')[0] : '📦';
            return (
              <div key={c.id} className={`ctab ${activeCat === String(c.id) ? 'active' : ''}`} onClick={() => setActiveCat(String(c.id))}>
                <span className="cn">{icon}</span>{c.name}
              </div>
            );
          })}
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0
          ? <div className="empty"><div className="ei">📦</div><h4>No items found</h4><p>Add your first inventory item</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Min Qty</th><th>Purchase Price</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(i => {
                    const st = stockStatus(i);
                    return (
                      <tr key={i.id}>
                        <td><strong>{i.name}</strong>{i.supplier && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{i.supplier}</div>}</td>
                        <td style={{ fontSize: 13 }}>{i.category_name || '—'}</td>
                        <td><strong>{i.current_quantity}</strong> <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{i.unit_abbr}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--ink2)' }}>{i.min_quantity || '—'}</td>
                        <td>{fmtCur(i.purchase_price)}</td>
                        <td><span className={`badge ${st}`}>{st === 'ok' ? '● In Stock' : st === 'low' ? '⚠ Low' : '● Empty'}</span></td>
                        <td><div className="tact">
                          <button className="bsm be" onClick={() => openModal(i)}>✏️</button>
                          <button className="bsm bt" onClick={() => { setAdjustModal(i); setAdjustForm({ adjustment_type: 'add', quantity: '', reason: '' }); }}>±</button>
                          <button className="bsm bo" onClick={() => openHist(i)}>📋</button>
                          <button className="bsm bd" onClick={() => setDelModal(i)}>🗑️</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid">
              {filtered.map(i => {
                const st = stockStatus(i);
                return (
                  <div key={i.id} className="inv-card">
                    <div className="inv-card-top">
                      <div className="cicon" style={{ background: 'rgba(232,87,42,.08)', fontSize: 22 }}>📦</div>
                      <div className="inv-card-info">
                        <h4>{i.name}</h4>
                        <p>{i.category_name}</p>
                      </div>
                      <span className={`badge ${st}`}>{st === 'ok' ? '✓' : st === 'low' ? '⚠' : '✕'}</span>
                    </div>
                    <div className="inv-card-body">
                      <div className="inv-kv"><div className="k">Stock</div><div className="v">{i.current_quantity} {i.unit_abbr}</div></div>
                      <div className="inv-kv"><div className="k">Price</div><div className="v">{fmtCur(i.purchase_price)}</div></div>
                    </div>
                    <div className="inv-card-foot">
                      <button className="bsm be" onClick={() => openModal(i)}>✏️ Edit</button>
                      <button className="bsm bt" onClick={() => { setAdjustModal(i); setAdjustForm({ adjustment_type: 'add', quantity: '', reason: '' }); }}>± Stock</button>
                      <button className="bsm bd" onClick={() => setDelModal(i)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* Item Modal */}
      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Item' : 'Add Inventory Item'}
        subtitle="Fill in item details"
        wide
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div className="mgrid">
          <div className="mfull">
            <label className="mlabel">Item Name *</label>
            <input className="mfi" placeholder="e.g. Onion" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Category *</label>
            <select className="mfi" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">Select…</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mlabel">Unit *</label>
            <select className="mfi" value={form.unit_id} onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}>
              <option value="">Select…</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
            </select>
          </div>
          <div>
            <label className="mlabel">Current Quantity</label>
            <input className="mfi" type="number" placeholder="0" value={form.current_quantity} onChange={e => setForm(f => ({ ...f, current_quantity: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Min Quantity</label>
            <input className="mfi" type="number" placeholder="Reorder point" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Purchase Price</label>
            <input className="mfi" type="number" placeholder="₹0.00" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Selling Price</label>
            <input className="mfi" type="number" placeholder="₹0.00" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} />
          </div>
          <div className="mfull">
            <label className="mlabel">Supplier</label>
            <input className="mfi" placeholder="Supplier name" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal show={!!adjustModal} onClose={() => setAdjustModal(null)}
        title={`Adjust Stock — ${adjustModal?.name}`}
        subtitle="Add or remove stock quantity"
        footer={<>
          <button className="btn-c" onClick={() => setAdjustModal(null)}>Cancel</button>
          <button className="btn-p" onClick={doAdjust}>Adjust</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="mlabel">Type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className={`topt ${adjustForm.adjustment_type === 'add' ? 'sel' : ''}`} style={{ flex: 1 }} onClick={() => setAdjustForm(f => ({ ...f, adjustment_type: 'add' }))}>
                <div className="tname">➕ Add Stock</div>
              </button>
              <button type="button" className={`topt ${adjustForm.adjustment_type === 'remove' ? 'sel' : ''}`} style={{ flex: 1 }} onClick={() => setAdjustForm(f => ({ ...f, adjustment_type: 'remove' }))}>
                <div className="tname">➖ Remove Stock</div>
              </button>
            </div>
          </div>
          <div>
            <label className="mlabel">Quantity *</label>
            <input className="mfi" type="number" placeholder="Enter quantity" value={adjustForm.quantity} onChange={e => setAdjustForm(f => ({ ...f, quantity: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Reason</label>
            <input className="mfi" placeholder="e.g. Daily usage, Purchase…" value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Purchase History Modal */}
      <Modal show={!!histModal} onClose={() => setHistModal(null)}
        title={`Purchase History — ${histModal?.name}`}
        subtitle="All past purchases for this item">
        <div>
          {histData.length === 0
            ? <div className="empty" style={{ padding: 30 }}><div className="ei">📋</div><p>No purchases recorded</p></div>
            : <div className="ph-list">
              {histData.map(p => (
                <div key={p.id} className="ph-row">
                  <div>
                    <div className="ph-qty">{p.quantity} × {fmtCur(p.price_per_unit)}</div>
                    <div className="ph-note">{p.supplier || '—'} {p.invoice_no ? `· ${p.invoice_no}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{fmtCur(p.total_amount)}</div>
                    <div className="ph-cost">{p.purchase_date?.split('T')[0]}</div>
                  </div>
                </div>
              ))}
            </div>
          }
          <div className="mft"><button className="btn-c" onClick={() => setHistModal(null)}>Close</button></div>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Item" message={`Delete "${delModal?.name}"? This cannot be undone.`} />
    </div>
  );
}
