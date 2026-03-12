import React, { useState, useEffect } from 'react';
import { getFuels, createFuel, updateFuel, deleteFuel } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const FUEL_ICONS = ['🔥','⛽','🪵','♨️','💡','🌿'];
const EMPTY = { fuel_name: '', fuel_type: 'gas', fuel_unit: 'cylinder', cost_per_unit: '', burn_duration_hours: 8, per_minute: 0, icon: '🔥', notes: '' };
const FUEL_COLORS = { gas: '#e8572a', electric: '#118ab2', wood: '#6d4c41', coal: '#2e4057', other: '#7b5ea7' };

export default function FuelPage() {
  const toast = useToast();
  const [fuels, setFuels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [delModal, setDelModal] = useState(null);

  const calcPerMin = (f) => {
    const cost = parseFloat(f.cost_per_unit) || 0;
    const hrs = parseFloat(f.burn_duration_hours) || 8;
    return (cost / (hrs * 60)).toFixed(4);
  };

  const load = () => {
    setLoading(true);
    getFuels().then(d => { if (d.success) setFuels(d.data); }).finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);

  const openModal = (f = null) => {
    setEditing(f);
    setForm(f ? { fuel_name: f.fuel_name, fuel_type: f.fuel_type, fuel_unit: f.fuel_unit, cost_per_unit: f.cost_per_unit, burn_duration_hours: f.burn_duration_hours, per_minute: f.per_minute, icon: f.icon || '🔥', notes: f.notes || '' } : EMPTY);
    setModal(true);
  };

  const save = async () => {
    if (!form.fuel_name || !form.cost_per_unit) { toast('Fuel name and cost required.', 'er'); return; }
    const payload = { ...form, per_minute: parseFloat(calcPerMin(form)) };
    try {
      const d = editing ? await updateFuel(editing.id, payload) : await createFuel(payload);
      if (d.success) { toast(editing ? 'Fuel updated! ✅' : 'Fuel added! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteFuel(delModal.id);
      if (d.success) { toast('Deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Fuel Manager</div>
          <div className="ps">Manage fuel profiles — gas, electric, wood — for recipe cost calculation</div>
        </div>
        <button className="btn-p" onClick={() => openModal()}>+ Add Fuel</button>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>🔥</div><div className="scard-text"><div className="sv">{fuels.length}</div><div className="sl">Fuel Profiles</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>💸</div><div className="scard-text"><div className="sv small">{fmtCur(fuels.reduce((s, f) => s + parseFloat(f.cost_per_unit || 0), 0))}</div><div className="sl">Total Cost</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">All Fuel Profiles</div>
          <div className="vt-wrap">
            <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
            <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : fuels.length === 0
          ? <div className="empty"><div className="ei">🔥</div><h4>No fuel profiles</h4><p>Add LPG, electric, wood etc.</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Fuel</th><th>Type</th><th>Unit</th><th>Cost/Unit</th><th>Burn Hours</th><th>₹/Min</th><th>Actions</th></tr></thead>
                <tbody>
                  {fuels.map(f => (
                    <tr key={f.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{f.icon || '🔥'}</span>
                        <strong>{f.fuel_name}</strong>
                      </div></td>
                      <td><span className="badge on">{f.fuel_type}</span></td>
                      <td style={{ fontSize: 13 }}>{f.fuel_unit}</td>
                      <td><strong>{fmtCur(f.cost_per_unit)}</strong></td>
                      <td>{f.burn_duration_hours}h</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>₹{parseFloat(f.per_minute).toFixed(4)}</td>
                      <td><div className="tact">
                        <button className="bsm be" onClick={() => openModal(f)}>✏️ Edit</button>
                        <button className="bsm bd" onClick={() => setDelModal(f)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {fuels.map(f => {
                const color = FUEL_COLORS[f.fuel_type] || '#7b5ea7';
                return (
                  <div key={f.id} className="inv-card" style={{ borderTop: '3px solid ' + color }}>
                    <div className="inv-card-top">
                      <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: color + '18', flexShrink: 0 }}>
                        {f.icon || '🔥'}
                      </div>
                      <div className="inv-card-info">
                        <h4>{f.fuel_name}</h4>
                        <p>{f.fuel_unit} · {f.fuel_type}</p>
                      </div>
                      <span className="badge on">{f.fuel_type}</span>
                    </div>
                    <div className="inv-card-body">
                      <div className="inv-kv">
                        <div className="k">Cost / Unit</div>
                        <div className="v">{fmtCur(f.cost_per_unit)}</div>
                      </div>
                      <div className="inv-kv">
                        <div className="k">Burn Hours</div>
                        <div className="v">{f.burn_duration_hours}h</div>
                      </div>
                      <div className="inv-kv" style={{ gridColumn: '1/-1' }}>
                        <div className="k">₹ Per Minute</div>
                        <div className="v" style={{ fontFamily: 'monospace', fontSize: 13, color }}>₹{parseFloat(f.per_minute).toFixed(4)}</div>
                      </div>
                    </div>
                    {f.notes && <div style={{ fontSize: 12, color: 'var(--ink2)', padding: '0 2px' }}>{f.notes}</div>}
                    <div className="inv-card-foot">
                      <button className="bsm be" onClick={() => openModal(f)}>✏️ Edit</button>
                      <button className="bsm bd" onClick={() => setDelModal(f)}>🗑️ Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Fuel' : 'Add Fuel Profile'}
        subtitle="Define a fuel/energy source for costing"
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div className="mgrid">
          <div className="mfull">
            <label className="mlabel">Fuel Name *</label>
            <input className="mfi" placeholder="e.g. LPG Gas" value={form.fuel_name} onChange={e => setForm(f => ({ ...f, fuel_name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Type</label>
            <select className="mfi" value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
              <option value="gas">Gas</option>
              <option value="electric">Electric</option>
              <option value="wood">Wood</option>
              <option value="coal">Coal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="mlabel">Unit</label>
            <input className="mfi" placeholder="e.g. cylinder, kWh" value={form.fuel_unit} onChange={e => setForm(f => ({ ...f, fuel_unit: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Cost Per Unit (₹) *</label>
            <input className="mfi" type="number" placeholder="0" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} />
          </div>
          <div>
            <label className="mlabel">Burn Duration (hours)</label>
            <input className="mfi" type="number" placeholder="8" value={form.burn_duration_hours} onChange={e => setForm(f => ({ ...f, burn_duration_hours: e.target.value }))} />
          </div>
          {form.cost_per_unit && (
            <div className="mfull" style={{ background: 'rgba(232,87,42,.06)', borderRadius: 10, padding: '12px 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>₹/min: {calcPerMin(form)}</span>
              <span style={{ fontSize: 12, color: 'var(--ink2)', marginLeft: 12 }}>Auto-calculated</span>
            </div>
          )}
          <div className="mfull">
            <label className="mlabel">Icon</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {FUEL_ICONS.map(ic => (
                <button key={ic} type="button" className={"iopt " + (form.icon === ic ? 'sel' : '')} onClick={() => setForm(f => ({ ...f, icon: ic }))}>{ic}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Fuel" message={'Delete "' + delModal?.fuel_name + '"?'} />
    </div>
  );
}
