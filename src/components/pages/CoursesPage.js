import React, { useState, useEffect } from 'react';
import { getCourses, createCourse, updateCourse, deleteCourse, toggleCourse } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtDateShort } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const PALETTE = ['#e8572a','#f4a535','#1db97e','#118ab2','#7b5ea7','#e84a5f','#2d6a4f','#023e8a','#6d4c41','#2e4057'];
const ICONS = ['🍽️','🥗','🍲','🍜','🍣','🥘','🍛','🥩','🍕','🍰','☕','🥤','🍱','🥙','🫕'];

export default function CoursesPage() {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', icon: '🍽️', description: '' });
  const [selColor, setSelColor] = useState('#e8572a');
  const [delModal, setDelModal] = useState(null);

  const load = () => {
    setLoading(true);
    getCourses().then(d => { if (d.success) setCourses(d.data); }).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);

  const openModal = (c = null) => {
    setEditing(c);
    setForm({ name: c?.name || '', icon: c?.icon || '🍽️', description: c?.description || '' });
    setSelColor(c?.color || '#e8572a');
    setModal(true);
  };

  const save = async () => {
    if (!form.name) { toast('Course name required.', 'er'); return; }
    try {
      const payload = { ...form, color: selColor };
      const d = editing ? await updateCourse(editing.id, payload) : await createCourse(payload);
      if (d.success) { toast(editing ? 'Course updated! ✅' : 'Course added! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const toggle = async (c) => {
    try {
      const d = await toggleCourse(c.id, c.is_active ? 0 : 1);
      if (d.success) { toast(c.is_active ? 'Course disabled.' : 'Course enabled.', 'ok'); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteCourse(delModal.id);
      if (d.success) { toast('Course deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  const filtered = courses.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Course Management</div>
          <div className="ps">Manage menu course types like Starter, Main Course, Dessert etc.</div>
        </div>
        <button className="btn-p" onClick={() => openModal()}>+ Add Course</button>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>🗂️</div><div className="scard-text"><div className="sv">{courses.length}</div><div className="sl">Total Courses</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv">{courses.filter(c => c.is_active).length}</div><div className="sl">Active</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>🍱</div><div className="scard-text"><div className="sv">{courses.length}</div><div className="sl">Course Types</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">All Courses</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="vt-wrap">
              <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
              <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0
          ? <div className="empty"><div className="ei">🗂️</div><h4>No courses yet</h4><p>Add Starter, Main Course etc.</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Course</th><th>Colour</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="course-row-icon" style={{ background: c.color + '22' }}>{c.icon || '🍽️'}</div>
                        <div>
                          <strong>{c.name}</strong>
                          {c.description && <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{c.description}</div>}
                        </div>
                      </div></td>
                      <td><div style={{ width: 26, height: 26, borderRadius: 6, background: c.color, display: 'inline-block', border: '1px solid rgba(0,0,0,.1)' }} /></td>
                      <td><span className={"badge " + (c.is_active ? 'on' : 'off')}>{c.is_active ? '● Active' : '● Inactive'}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--ink2)' }}>{fmtDateShort(c.created_at)}</td>
                      <td><div className="tact">
                        <button className="bsm be" onClick={() => openModal(c)}>✏️ Edit</button>
                        <button className="bsm bt" onClick={() => toggle(c)}>{c.is_active ? 'Disable' : 'Enable'}</button>
                        <button className="bsm bd" onClick={() => setDelModal(c)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {filtered.map(c => (
                <div key={c.id} className="inv-card" style={{ borderTop: '3px solid ' + c.color }}>
                  <div className="inv-card-top">
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: c.color + '22', flexShrink: 0 }}>
                      {c.icon || '🍽️'}
                    </div>
                    <div className="inv-card-info">
                      <h4>{c.name}</h4>
                      <p>{c.description || 'No description'}</p>
                    </div>
                    <span className={"badge " + (c.is_active ? 'on' : 'off')}>{c.is_active ? '✓' : '✕'}</span>
                  </div>
                  <div className="inv-card-body">
                    <div className="inv-kv">
                      <div className="k">Colour</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, background: c.color, border: '1px solid rgba(0,0,0,.1)' }} />
                        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{c.color}</span>
                      </div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Created</div>
                      <div className="v" style={{ fontSize: 13 }}>{fmtDateShort(c.created_at)}</div>
                    </div>
                  </div>
                  <div className="inv-card-foot">
                    <button className="bsm be" onClick={() => openModal(c)}>✏️ Edit</button>
                    <button className="bsm bt" onClick={() => toggle(c)}>{c.is_active ? 'Disable' : 'Enable'}</button>
                    <button className="bsm bd" onClick={() => setDelModal(c)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Course' : 'Add Course'}
        subtitle="Define a menu course type"
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="mlabel">Course Name *</label>
            <input className="mfi" placeholder="e.g. Main Course" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Icon</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {ICONS.map(ic => (
                <button key={ic} type="button" className={"iopt " + (form.icon === ic ? 'sel' : '')} onClick={() => setForm(f => ({ ...f, icon: ic }))}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="mlabel">Colour</label>
            <div className="color-row">
              {PALETTE.map(c => (
                <div key={c} className={"copt " + (selColor === c ? 'sel' : '')} style={{ background: c }} onClick={() => setSelColor(c)} />
              ))}
            </div>
          </div>
          <div>
            <label className="mlabel">Description</label>
            <input className="mfi" placeholder="Optional description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Course" message={'Delete "' + delModal?.name + '"?'} />
    </div>
  );
}
