import React, { useState, useEffect, useCallback } from 'react';
import { getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from '../../api';
import { useToast } from '../../context/ToastContext';
import Modal from '../ui/Modal';

const ICONS = ['📦','📣','🔧','🏠','💡','🚗','🍽️','🛒','💊','📋','🔑','🧹','🖨️','📡','💼','🎉','🧾','⚙️','🌿','🚰'];
const COLORS = ['#5a5a78','#06b6d4','#b07a00','#1db97e','#e84a5f','#1171ee','#f0a500','#7c3aed','#059669','#dc2626'];

const EMPTY = { name: '', icon: '📦', color: '#5a5a78', include_in_pnl: 0, is_active: 1 };

export default function ExpenseCategoryManagerPage() {
  const toast = useToast();
  const [cats, setCats]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getExpenseCategories();
      if (r.success) setCats(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (cat = null) => {
    setEditing(cat);
    setForm(cat ? { name: cat.name, icon: cat.icon || '📦', color: cat.color || '#5a5a78', include_in_pnl: cat.include_in_pnl || 0, is_active: cat.is_active ?? 1 } : EMPTY);
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast('Name is required', 'er'); return; }
    setSaving(true);
    try {
      if (editing) await updateExpenseCategory(editing.id, form);
      else await createExpenseCategory(form);
      setModal(false);
      await load();
      toast('Category saved ✓');
    } catch (e) { toast('Save failed', 'er'); }
    finally { setSaving(false); }
  };

  const del = async (cat) => {
    if (!window.confirm(`Delete "${cat.name}"? This will fail if expenses are using it.`)) return;
    try {
      const r = await deleteExpenseCategory(cat.id);
      if (r.success) { await load(); toast('Deleted'); }
      else toast(r.message || 'Cannot delete', 'er');
    } catch (e) { toast(e.message || 'Delete failed', 'er'); }
  };

  const togglePnl = async (cat) => {
    try {
      await updateExpenseCategory(cat.id, { ...cat, include_in_pnl: cat.include_in_pnl ? 0 : 1 });
      await load();
      toast(cat.include_in_pnl ? 'Removed from P&L' : 'Added to P&L ✓');
    } catch (e) { toast('Failed', 'er'); }
  };

  const pnlCats  = cats.filter(c => c.include_in_pnl);
  const restCats = cats.filter(c => !c.include_in_pnl);

  return (
    <div style={{ padding: '16px 16px 40px', maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🏷️ Expense Categories</h2>
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>
            Toggle which categories count toward daily Profit &amp; Loss
          </div>
        </div>
        <button className="bsm be" onClick={() => openModal()}>+ Add Category</button>
      </div>

      {/* P&L Info Banner */}
      <div style={{ background: 'rgba(29,185,126,.08)', border: '1.5px solid rgba(29,185,126,.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 20 }}>📊</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1db97e' }}>How this works</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>
            Categories with <strong>Calculate in P&amp;L</strong> toggled ON will have their daily expenses deducted in the Profit &amp; Loss page.
            Salary, advances, rent, electricity, and fuel are already calculated separately — toggle only true miscellaneous categories.
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink2)' }}>Loading…</div>
      ) : (
        <>
          {/* P&L Active */}
          {pnlCats.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1db97e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                ✅ Calculated in P&amp;L ({pnlCats.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pnlCats.map(cat => <CategoryRow key={cat.id} cat={cat} onEdit={openModal} onDelete={del} onToggle={togglePnl} />)}
              </div>
            </div>
          )}

          {/* Not in P&L */}
          {restCats.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                ⬜ Not in P&amp;L ({restCats.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {restCats.map(cat => <CategoryRow key={cat.id} cat={cat} onEdit={openModal} onDelete={del} onToggle={togglePnl} />)}
              </div>
            </div>
          )}

          {cats.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink2)' }}>
              <div style={{ fontSize: 36 }}>🏷️</div>
              <div style={{ marginTop: 10, fontWeight: 600 }}>No categories yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Add your first expense category</div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        footer={<>
          <button className="bsm" onClick={() => setModal(false)}>Cancel</button>
          <button className="bsm be" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <label className="mlabel">Category Name</label>
            <input className="mfi" placeholder="e.g. Marketing" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div>
            <label className="mlabel">Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icon: ic }))}
                  style={{ width: 36, height: 36, borderRadius: 8, border: '2px solid', fontSize: 18, cursor: 'pointer', background: form.icon === ic ? 'var(--accent)' : 'var(--bg)', borderColor: form.icon === ic ? 'var(--accent)' : 'var(--border)' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mlabel">Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLORS.map(col => (
                <button key={col} type="button" onClick={() => setForm(f => ({ ...f, color: col }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid', cursor: 'pointer', background: col, borderColor: form.color === col ? 'var(--ink)' : 'transparent' }} />
              ))}
            </div>
          </div>

          {/* The key toggle */}
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📊 Calculate in P&amp;L</div>
              <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>
                Daily expenses of this category will be deducted in Profit &amp; Loss
              </div>
            </div>
            <Toggle on={!!form.include_in_pnl} onChange={v => setForm(f => ({ ...f, include_in_pnl: v ? 1 : 0 }))} />
          </div>

          {editing && (
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>✅ Active</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>Show this category in expense forms</div>
              </div>
              <Toggle on={!!form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v ? 1 : 0 }))} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function CategoryRow({ cat, onEdit, onDelete, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: (cat.color || '#5a5a78') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {cat.icon || '📦'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{cat.name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 1 }}>
          {cat.include_in_pnl ? <span style={{ color: '#1db97e' }}>✅ Counted in P&L</span> : <span>⬜ Not in P&L</span>}
          {!cat.is_active && <span style={{ marginLeft: 8, color: '#e84a5f' }}>· Inactive</span>}
        </div>
      </div>
      {/* P&L Toggle */}
      <Toggle on={!!cat.include_in_pnl} onChange={() => onToggle(cat)} />
      <button className="bsm be" onClick={() => onEdit(cat)} style={{ padding: '6px 10px', fontSize: 12 }}>✏️</button>
      <button className="bsm bd" onClick={() => onDelete(cat)} style={{ padding: '6px 10px', fontSize: 12 }}>🗑️</button>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)}
      style={{ width: 44, height: 24, borderRadius: 12, background: on ? '#1db97e' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </div>
  );
}
