import React, { useState, useEffect } from 'react';
import { getSalaries, createSalary, updateSalary, deleteSalary } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const EMPTY = { role_name: '', salary_type: 'monthly', amount: '', hours_per_day: 8, days_per_month: 26, per_minute: 0, notes: '' };
const ROLE_ICONS = { Chef: '👨‍🍳', Manager: '👔', Waiter: '🧑‍🍽️', Helper: '🤝', Cashier: '💵', default: '👤' };

export default function SalaryPage() {
  const toast = useToast();
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [delModal, setDelModal] = useState(null);

  const calcPerMin = (f) => {
    const amt = parseFloat(f.amount) || 0;
    const hrs = parseFloat(f.hours_per_day) || 8;
    const days = parseFloat(f.days_per_month) || 26;
    return (amt / (days * hrs * 60)).toFixed(4);
  };

  const getRoleIcon = (name) => {
    const k = Object.keys(ROLE_ICONS).find(k => name?.toLowerCase().includes(k.toLowerCase()));
    return k ? ROLE_ICONS[k] : ROLE_ICONS.default;
  };

  const load = () => {
    setLoading(true);
    getSalaries().then(d => { if (d.success) setSalaries(d.data); }).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);

  const openModal = (s = null) => {
    setEditing(s);
    setForm(s ? { role_name: s.role_name, salary_type: s.salary_type, amount: s.amount, hours_per_day: s.hours_per_day, days_per_month: s.days_per_month, per_minute: s.per_minute, notes: s.notes || '' } : EMPTY);
    setModal(true);
  };

  const save = async () => {
    if (!form.role_name || !form.amount) { toast('Role name and amount required.', 'er'); return; }
    const payload = { ...form, per_minute: parseFloat(calcPerMin(form)) };
    try {
      const d = editing ? await updateSalary(editing.id, payload) : await createSalary(payload);
      if (d.success) { toast(editing ? 'Role updated! ✅' : 'Role added! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteSalary(delModal.id);
      if (d.success) { toast('Deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Salary Manager</div>
          <div className="ps">Define staff roles and salary — auto-calculates ₹ per minute for recipe costing</div>
        </div>
        <button className="btn-p" onClick={() => openModal()}>+ Add Role</button>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>👥</div><div className="scard-text"><div className="sv">{salaries.length}</div><div className="sl">Total Roles</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>💰</div><div className="scard-text"><div className="sv small">{fmtCur(salaries.reduce((s, x) => s + parseFloat(x.amount || 0), 0))}</div><div className="sl">Total Monthly</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">All Roles</div>
          <div className="vt-wrap">
            <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
            <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : salaries.length === 0
          ? <div className="empty"><div className="ei">💰</div><h4>No roles yet</h4><p>Add chef, manager etc.</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Role</th><th>Type</th><th>Amount</th><th>Hrs/Day</th><th>Days/Month</th><th>₹/Min</th><th>Actions</th></tr></thead>
                <tbody>
                  {salaries.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{getRoleIcon(s.role_name)}</span>
                          <div>
                            <strong>{s.role_name}</strong>
                            {s.notes && <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{s.notes}</div>}
                          </div>
                        </div>
                      </td>
                      <td><span className="badge on">{s.salary_type}</span></td>
                      <td><strong>{fmtCur(s.amount)}</strong></td>
                      <td>{s.hours_per_day}h</td>
                      <td>{s.days_per_month}d</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>₹{parseFloat(s.per_minute).toFixed(4)}</td>
                      <td><div className="tact">
                        <button className="bsm be" onClick={() => openModal(s)}>✏️ Edit</button>
                        <button className="bsm bd" onClick={() => setDelModal(s)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {salaries.map(s => (
                <div key={s.id} className="inv-card">
                  <div className="inv-card-top">
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: 'rgba(232,87,42,.10)', flexShrink: 0 }}>
                      {getRoleIcon(s.role_name)}
                    </div>
                    <div className="inv-card-info">
                      <h4>{s.role_name}</h4>
                      <p>{s.notes || s.salary_type + ' salary'}</p>
                    </div>
                    <span className="badge on">{s.salary_type}</span>
                  </div>
                  <div className="inv-card-body">
                    <div className="inv-kv">
                      <div className="k">Monthly Amount</div>
                      <div className="v">{fmtCur(s.amount)}</div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">₹ Per Minute</div>
                      <div className="v" style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)' }}>₹{parseFloat(s.per_minute).toFixed(4)}</div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Hrs / Day</div>
                      <div className="v">{s.hours_per_day}h</div>
                    </div>
                    <div className="inv-kv">
                      <div className="k">Days / Month</div>
                      <div className="v">{s.days_per_month}d</div>
                    </div>
                  </div>
                  <div className="inv-card-foot">
                    <button className="bsm be" onClick={() => openModal(s)}>✏️ Edit</button>
                    <button className="bsm bd" onClick={() => setDelModal(s)}>🗑️ Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Role' : 'Add Salary Role'}
        subtitle="Staff salary details for recipe costing"
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div className="mgrid">
          <div className="mfull">
            <label className="mlabel">Role Name *</label>
            <input className="mfi" placeholder="e.g. Chef" value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Salary Type</label>
            <select className="mfi" value={form.salary_type} onChange={e => setForm(f => ({ ...f, salary_type: e.target.value }))}>
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          <div>
            <label className="mlabel">Amount (₹) *</label>
            <input className="mfi" type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Hours/Day</label>
            <input className="mfi" type="number" placeholder="8" value={form.hours_per_day} onChange={e => setForm(f => ({ ...f, hours_per_day: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Days/Month</label>
            <input className="mfi" type="number" placeholder="26" value={form.days_per_month} onChange={e => setForm(f => ({ ...f, days_per_month: e.target.value }))} />
          </div>
          {form.amount && (
            <div className="mfull" style={{ background: 'rgba(29,185,126,.07)', borderRadius: 10, padding: '12px 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>₹/min: {calcPerMin(form)}</span>
              <span style={{ fontSize: 12, color: 'var(--ink2)', marginLeft: 12 }}>Auto-calculated</span>
            </div>
          )}
          <div className="mfull">
            <label className="mlabel">Notes</label>
            <input className="mfi" placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Role" message={'Delete "' + delModal?.role_name + '"?'} />
    </div>
  );
}
