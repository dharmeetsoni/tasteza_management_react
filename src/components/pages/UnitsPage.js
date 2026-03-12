import React, { useState, useEffect } from 'react';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtDateShort } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const UNIT_TYPES = ['weight', 'volume', 'count', 'other'];
const TYPE_ICONS = { weight: '⚖️', volume: '🧪', count: '🔢', other: '📐' };
const TYPE_EXAMPLES = { weight: 'kg, g, oz…', volume: 'L, ml, cup…', count: 'pcs, nos…', other: 'custom' };
const typeColors = { weight: '#118ab2', volume: '#1db97e', count: '#b07a00', other: '#7b5ea7' };

export default function UnitsPage() {
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', abbreviation: '', type: 'other' });
  const [delModal, setDelModal] = useState(null);

  const load = () => {
    setLoading(true);
    getUnits().then(d => { if (d.success) setUnits(d.data); }).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);

  const openModal = (u = null) => {
    setEditing(u);
    setForm({ name: u?.name || '', abbreviation: u?.abbreviation || '', type: u?.type || 'other' });
    setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.abbreviation) { toast('Name and abbreviation required.', 'er'); return; }
    try {
      const d = editing ? await updateUnit(editing.id, form) : await createUnit(form);
      if (d.success) { toast(editing ? 'Unit updated! ✅' : 'Unit created! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Server error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteUnit(delModal.id);
      if (d.success) { toast('Unit deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error deleting unit.', 'er'); }
  };

  const filtered = units.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.abbreviation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Units of Measurement</div>
          <div className="ps">Manage units used in inventory and recipes</div>
        </div>
        <button className="btn-p" onClick={() => openModal()}>+ Add Unit</button>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>⚖️</div><div className="scard-text"><div className="sv">{units.length}</div><div className="sl">Total Units</div></div></div>
        {UNIT_TYPES.map(t => (
          <div key={t} className="scard">
            <div style={{ fontSize: 20 }}>{TYPE_ICONS[t]}</div>
            <div className="sv">{units.filter(u => u.type === t).length}</div>
            <div className="sl" style={{ textTransform: 'capitalize' }}>{t}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">All Units</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vt-wrap">
              <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
              <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0
          ? <div className="empty"><div className="ei">⚖️</div><h4>No units yet</h4><p>Add your first unit</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Unit Name</th><th>Abbreviation</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td><code style={{ background: 'rgba(232,87,42,.08)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 }}>{u.abbreviation}</code></td>
                      <td><span className={"utype " + u.type}>{u.type}</span></td>
                      <td><span className={"badge " + (u.is_active ? 'on' : 'off')}>{u.is_active ? '● Active' : '● Inactive'}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--ink2)' }}>{fmtDateShort(u.created_at)}</td>
                      <td><div className="tact">
                        <button className="bsm be" onClick={() => openModal(u)}>✏️ Edit</button>
                        <button className="bsm bd" onClick={() => setDelModal(u)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {filtered.map(u => (
                <div key={u.id} className="inv-card">
                  <div className="inv-card-top">
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: typeColors[u.type] + '18', flexShrink: 0 }}>
                      {TYPE_ICONS[u.type]}
                    </div>
                    <div className="inv-card-info">
                      <h4>{u.name}</h4>
                      <p style={{ textTransform: 'capitalize' }}>{TYPE_EXAMPLES[u.type]}</p>
                    </div>
                    <span className={"badge " + (u.is_active ? 'on' : 'off')}>{u.is_active ? '✓' : '✕'}</span>
                  </div>
                  <div className="inv-card-body">
                    <div className="inv-kv">
                      <div className="k">Abbreviation</div>
                      <div className="v" style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 18 }}>{u.abbreviation}</div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Type</div>
                      <div className="v" style={{ fontSize: 14 }}><span className={"utype " + u.type}>{u.type}</span></div>
                    </div>
                  </div>
                  <div className="inv-card-foot">
                    <button className="bsm be" onClick={() => openModal(u)}>✏️ Edit</button>
                    <button className="bsm bd" onClick={() => setDelModal(u)}>🗑️ Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Unit' : 'Add Unit'}
        subtitle="Define a unit of measurement"
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="mgrid">
            <div>
              <label className="mlabel">Unit Name *</label>
              <input className="mfi" placeholder="e.g. Kilogram" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="mlabel">Abbreviation *</label>
              <input className="mfi" placeholder="e.g. kg" value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mlabel">Type</label>
            <div className="type-grid">
              {UNIT_TYPES.map(t => (
                <button key={t} type="button" className={"topt " + (form.type === t ? 'sel' : '')} onClick={() => setForm(f => ({ ...f, type: t }))}>
                  <div className="tname">{TYPE_ICONS[t]} <span style={{ textTransform: 'capitalize' }}>{t}</span></div>
                  <div className="texm">{TYPE_EXAMPLES[t]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Unit" message={'Delete "' + delModal?.name + '"? This may affect inventory items.'} />
    </div>
  );
}
