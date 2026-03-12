import React, { useState, useEffect } from 'react';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const EMPTY = { code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_amount: '', max_discount: '', usage_limit: '', valid_from: '', valid_until: '', is_active: true };

export default function CouponsPage() {
  const toast = useToast();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [delModal, setDelModal] = useState(null);

  const load = async () => { setLoading(true); try { const d = await getCoupons(); if (d.success) setCoupons(d.data); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const openModal = (c = null) => { setEditing(c); setForm(c ? { ...c, valid_from: c.valid_from?.split('T')[0]||'', valid_until: c.valid_until?.split('T')[0]||'' } : EMPTY); setModal(true); };

  const save = async () => {
    if (!form.code || !form.discount_value) { toast('Code and discount value required.', 'er'); return; }
    try {
      const d = editing ? await updateCoupon(editing.id, form) : await createCoupon(form);
      if (d.success) { toast(editing ? 'Coupon updated!' : 'Coupon created!', 'ok'); setModal(false); load(); }
      else toast(d.message, 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const del = async () => {
    try { const d = await deleteCoupon(delModal.id); if (d.success) { toast('Deleted.', 'ok'); setDelModal(null); load(); } else toast(d.message, 'er'); }
    catch { toast('Error', 'er'); }
  };

  const today = new Date().toISOString().split('T')[0];
  const isExpired = (c) => c.valid_until && c.valid_until.split('T')[0] < today;

  return (
    <div>
      <div className="ph">
        <div className="ph-left"><div className="pt">Coupon Manager</div><div className="ps">Create and manage discount coupons</div></div>
        <button className="btn-p" onClick={() => openModal()}>+ New Coupon</button>
      </div>
      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>🎟️</div><div className="scard-text"><div className="sv">{coupons.length}</div><div className="sl">Total Coupons</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #1db97e' }}><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv" style={{ color: '#1db97e' }}>{coupons.filter(c => c.is_active && !isExpired(c)).length}</div><div className="sl">Active</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>📊</div><div className="scard-text"><div className="sv">{coupons.reduce((s, c) => s + (c.used_count||0), 0)}</div><div className="sl">Total Uses</div></div></div>
      </div>
      <div className="card">
        <div className="ch"><div className="ct">All Coupons</div></div>
        {loading ? <div className="loading-wrap">Loading…</div> : coupons.length === 0 ?
          <div className="empty"><div className="ei">🎟️</div><h4>No coupons yet</h4></div> : (
          <div className="overflow-x">
            <table>
              <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Valid Until</th><th>Uses</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id}>
                    <td><strong style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 14 }}>{c.code}</strong>{c.description && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{c.description}</div>}</td>
                    <td><strong>{c.discount_type === 'percentage' ? `${c.discount_value}%` : fmtCur(c.discount_value)}</strong>{c.max_discount && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>max {fmtCur(c.max_discount)}</div>}</td>
                    <td style={{ fontSize: 13 }}>{c.min_order_amount > 0 ? fmtCur(c.min_order_amount) : '—'}</td>
                    <td style={{ fontSize: 13, color: isExpired(c) ? 'var(--red)' : 'var(--ink2)' }}>{c.valid_until ? c.valid_until.split('T')[0] : '∞'}</td>
                    <td style={{ fontSize: 13 }}>{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                    <td><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isExpired(c) ? 'rgba(232,74,95,.1)' : c.is_active ? 'rgba(29,185,126,.1)' : 'rgba(200,200,200,.2)', color: isExpired(c) ? 'var(--red)' : c.is_active ? 'var(--green)' : 'var(--ink2)' }}>{isExpired(c) ? 'Expired' : c.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><div className="tact"><button className="bsm be" onClick={() => openModal(c)}>✏️</button><button className="bsm bd" onClick={() => setDelModal(c)}>🗑️</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal show={modal} onClose={() => setModal(false)} title={editing ? 'Edit Coupon' : 'New Coupon'} subtitle="Configure discount offer" wide
        footer={<><button className="btn-c" onClick={() => setModal(false)}>Cancel</button><button className="btn-p" onClick={save}>Save</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="mgrid">
            <div><label className="mlabel">Coupon Code *</label><input className="mfi" placeholder="SAVE10" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} autoFocus style={{ textTransform: 'uppercase' }} /></div>
            <div><label className="mlabel">Description</label><input className="mfi" placeholder="10% off on orders above ₹200" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div>
            <label className="mlabel">Discount Type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['percentage','amount'].map(dt => (
                <button key={dt} type="button" className={'topt' + (form.discount_type === dt ? ' sel' : '')} style={{ flex: 1 }}
                  onClick={() => setForm(f => ({ ...f, discount_type: dt }))}>
                  <div className="tname">{dt === 'percentage' ? '% Percentage' : '₹ Fixed Amount'}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="mgrid">
            <div><label className="mlabel">Discount Value * {form.discount_type === 'percentage' ? '(%)' : '(₹)'}</label><input className="mfi" type="number" min="0" placeholder={form.discount_type === 'percentage' ? '10' : '50'} value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} /></div>
            <div><label className="mlabel">Min Order Amount (₹)</label><input className="mfi" type="number" min="0" placeholder="0" value={form.min_order_amount} onChange={e => setForm(f => ({ ...f, min_order_amount: e.target.value }))} /></div>
            {form.discount_type === 'percentage' && <div><label className="mlabel">Max Discount (₹)</label><input className="mfi" type="number" min="0" placeholder="No limit" value={form.max_discount} onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))} /></div>}
            <div><label className="mlabel">Usage Limit</label><input className="mfi" type="number" min="0" placeholder="Unlimited" value={form.usage_limit} onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))} /></div>
            <div><label className="mlabel">Valid From</label><input className="mfi" type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} /></div>
            <div><label className="mlabel">Valid Until</label><input className="mfi" type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
          </div>
          {editing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="isActive" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor="isActive" className="mlabel" style={{ marginBottom: 0 }}>Active</label>
            </div>
          )}
        </div>
      </Modal>
      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del} title="Delete Coupon" message={`Delete coupon "${delModal?.code}"?`} />
    </div>
  );
}
