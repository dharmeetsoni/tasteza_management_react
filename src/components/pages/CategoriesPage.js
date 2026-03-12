import React, { useState, useEffect } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtDateShort } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const CAT_ICONS = ['🥩','🥦','🧅','🍅','🧀','🥚','🐟','🍗','🧂','🥛','🌾','🫙','🍋','🧄','🌶️','🥬','🧃','🛢️'];

export default function CategoriesPage() {
  const toast = useToast();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', image_url: '' });
  const [selIcon, setSelIcon] = useState('🥩');
  const [delModal, setDelModal] = useState(null);

  const load = () => {
    setLoading(true);
    getCategories().then(d => { if (d.success) setCats(d.data); }).finally(() => setLoading(false));
  };

  useEffect(() => { void load(); }, []);

  const openModal = (cat = null) => {
    setEditing(cat);
    setForm({ name: cat?.name || '', description: cat?.description || '', image_url: cat?.image_url || '' });
    setSelIcon(cat?.image_url?.startsWith('icon:') ? cat.image_url.replace('icon:', '').split('|')[0] : '🥩');
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast('Category name is required.', 'er'); return; }
    const payload = { ...form, image_url: `icon:${selIcon}` };
    try {
      const d = editing
        ? await updateCategory(editing.id, payload)
        : await createCategory(payload);
      if (d.success) { toast(editing ? 'Category updated! ✅' : 'Category created! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Server error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteCategory(delModal.id);
      if (d.success) { toast('Category deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const filtered = cats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Categories</div>
          <div className="ps">Organise inventory items into categories</div>
        </div>
        <button className="btn-p" onClick={() => openModal()}>+ Add Category</button>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>🏷️</div><div className="scard-text"><div className="sv">{cats.length}</div><div className="sl">Total</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv">{cats.filter(c => c.is_active).length}</div><div className="sl">Active</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>📦</div><div className="scard-text"><div className="sv">{cats.length}</div><div className="sl">Categories</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">All Categories</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vt-wrap">
              <button className={`vt-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>☰ Table</button>
              <button className={`vt-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0
          ? <div className="empty"><div className="ei">🏷️</div><h4>No categories yet</h4><p>Add your first category</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Category</th><th>Description</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(c => {
                    const icon = c.image_url?.startsWith('icon:') ? c.image_url.replace('icon:', '').split('|')[0] : '📦';
                    return (
                      <tr key={c.id}>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="cicon" style={{ background: 'rgba(232,87,42,.08)' }}>{icon}</div>
                          <strong>{c.name}</strong>
                        </div></td>
                        <td style={{ color: 'var(--ink2)', fontSize: 13 }}>{c.description || '—'}</td>
                        <td><span className={`badge ${c.is_active ? 'on' : 'off'}`}>{c.is_active ? '● Active' : '● Inactive'}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--ink2)' }}>{fmtDateShort(c.created_at)}</td>
                        <td><div className="tact">
                          <button className="bsm be" onClick={() => openModal(c)}>✏️ Edit</button>
                          <button className="bsm bd" onClick={() => setDelModal(c)}>🗑️</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {filtered.map(c => {
                const icon = c.image_url?.startsWith('icon:') ? c.image_url.replace('icon:', '').split('|')[0] : '📦';
                return (
                  <div key={c.id} className="inv-card">
                    <div className="inv-card-top">
                      <div className="cicon" style={{ background: 'rgba(232,87,42,.10)', width: 48, height: 48, fontSize: 24 }}>{icon}</div>
                      <div className="inv-card-info">
                        <h4>{c.name}</h4>
                        <p>{c.description || 'No description'}</p>
                      </div>
                      <span className={`badge ${c.is_active ? 'on' : 'off'}`}>{c.is_active ? '✓' : '✕'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)' }}>Created {fmtDateShort(c.created_at)}</div>
                    <div className="inv-card-foot">
                      <button className="bsm be" onClick={() => openModal(c)}>✏️ Edit</button>
                      <button className="bsm bd" onClick={() => setDelModal(c)}>🗑️ Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* Category Modal */}
      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        subtitle={editing ? 'Update category details' : 'Create a new inventory category'}
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="mlabel">Category Name *</label>
            <input className="mfi" placeholder="e.g. Vegetables" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Description</label>
            <input className="mfi" placeholder="Optional description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Icon</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {CAT_ICONS.map(ic => (
                <button key={ic} type="button" className={`iopt ${selIcon === ic ? 'sel' : ''}`} onClick={() => setSelIcon(ic)}>{ic}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Category" message={`Delete "${delModal?.name}"? This may affect inventory items.`} />
    </div>
  );
}
