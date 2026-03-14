import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getVendors, createVendor, updateVendor, deleteVendor, getCategories } from '../../api';
import { useToast } from '../../context/ToastContext';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const EMPTY_FORM = {
  name: '', contact_name: '', phone: '', email: '',
  address: '', notes: '', is_active: 1, category_ids: [],
};

// ── Category multi-select checkboxes ─────────────────────────────────────────
function CategoryPicker({ categories, selected, onChange }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: 8, maxHeight: 200, overflowY: 'auto',
      padding: 12, borderRadius: 10, border: '1.5px solid var(--border)',
      background: 'var(--bg)',
    }}>
      {categories.map(cat => {
        const checked = selected.includes(cat.id);
        return (
          <label key={cat.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 8, cursor: 'pointer',
            background: checked ? 'rgba(232,87,42,.08)' : 'transparent',
            border: `1.5px solid ${checked ? 'var(--accent)' : 'transparent'}`,
            transition: 'all .12s', fontSize: 13, fontWeight: checked ? 700 : 500,
            color: checked ? 'var(--accent)' : 'var(--ink)',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(
                checked ? selected.filter(id => id !== cat.id) : [...selected, cat.id]
              )}
              style={{ display: 'none' }}
            />
            <div style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: `2px solid ${checked ? 'var(--accent)' : 'var(--ink2)'}`,
              background: checked ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
            </div>
            {cat.name}
          </label>
        );
      })}
      {categories.length === 0 && (
        <div style={{ color: 'var(--ink2)', fontSize: 13, padding: 4 }}>No categories found</div>
      )}
    </div>
  );
}

// ── Vendor form (outside parent to avoid remount focus loss) ──────────────────
function VendorForm({ form, setForm, categories }) {
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Basic info */}
      <div className="recipe-section">
        <div className="recipe-section-title">🏪 Vendor Details</div>
        <div className="mgrid">
          <div>
            <label className="mlabel">Vendor / Company Name *</label>
            <input className="mfi" placeholder="e.g. Lakshmi Vegetables" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="mlabel">Contact Person</label>
            <input className="mfi" placeholder="Contact person name" value={form.contact_name} onChange={set('contact_name')} />
          </div>
          <div>
            <label className="mlabel">Phone</label>
            <input className="mfi" placeholder="Mobile / WhatsApp number" value={form.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="mlabel">Email</label>
            <input className="mfi" type="email" placeholder="vendor@email.com" value={form.email} onChange={set('email')} />
          </div>
          <div className="mfull">
            <label className="mlabel">Address</label>
            <input className="mfi" placeholder="Shop / office address" value={form.address} onChange={set('address')} />
          </div>
          <div className="mfull">
            <label className="mlabel">Notes</label>
            <input className="mfi" placeholder="e.g. Delivers every Monday, COD only…" value={form.notes} onChange={set('notes')} />
          </div>
        </div>
      </div>

      <hr className="mdiv" />

      {/* Category mapping */}
      <div className="recipe-section">
        <div style={{ marginBottom: 10 }}>
          <div className="recipe-section-title" style={{ marginBottom: 4 }}>🏷️ Supplies Categories</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
            Select which inventory categories this vendor supplies. This filters items on Purchase Orders.
          </div>
        </div>
        <CategoryPicker
          categories={categories}
          selected={form.category_ids}
          onChange={ids => setForm(f => ({ ...f, category_ids: ids }))}
        />
        {form.category_ids.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {form.category_ids.map(id => {
              const cat = categories.find(c => c.id === id);
              return cat ? (
                <span key={id} style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                  background: 'rgba(232,87,42,.12)', color: 'var(--accent)',
                  border: '1px solid rgba(232,87,42,.2)',
                }}>
                  {cat.name}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VendorPage() {
  const toast = useToast();
  const [vendors, setVendors]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]     = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [viewModal, setViewModal]     = useState(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([getVendors(), getCategories()]);
      if (v.success) setVendors(v.data);
      if (c.success) setCategories(c.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => vendors.filter(v => {
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) &&
        !(v.contact_name||'').toLowerCase().includes(search.toLowerCase()) &&
        !(v.phone||'').includes(search)) return false;
    if (catFilter && !v.category_ids.includes(parseInt(catFilter))) return false;
    if (activeFilter === '1' && !v.is_active) return false;
    if (activeFilter === '0' && v.is_active) return false;
    return true;
  }), [vendors, search, catFilter, activeFilter]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setCreateModal(true);
  };

  const openEdit = (vendor) => {
    setForm({
      name: vendor.name || '', contact_name: vendor.contact_name || '',
      phone: vendor.phone || '', email: vendor.email || '',
      address: vendor.address || '', notes: vendor.notes || '',
      is_active: vendor.is_active ?? 1,
      category_ids: vendor.category_ids || [],
    });
    setEditModal(vendor);
  };

  const saveCreate = async () => {
    if (!form.name.trim()) { toast('Vendor name is required.', 'er'); return; }
    try {
      const d = await createVendor(form);
      if (d.success) { toast('Vendor created! ✅', 'ok'); setCreateModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const saveEdit = async () => {
    if (!form.name.trim()) { toast('Vendor name is required.', 'er'); return; }
    try {
      const d = await updateVendor(editModal.id, form);
      if (d.success) { toast('Vendor updated! ✅', 'ok'); setEditModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const doDelete = async () => {
    try {
      const d = await deleteVendor(deleteModal.id);
      if (d.success) { toast('Vendor deleted.', 'ok'); setDeleteModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const toggleActive = async (vendor) => {
    try {
      await updateVendor(vendor.id, { ...vendor, category_ids: vendor.category_ids, is_active: vendor.is_active ? 0 : 1 });
      load();
    } catch { toast('Update failed', 'er'); }
  };

  const formProps = { form, setForm, categories };

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Vendors</div>
          <div className="ps">Manage suppliers — link each vendor to the inventory categories they supply</div>
        </div>
        <button className="btn-p" onClick={openCreate}>+ Add Vendor</button>
      </div>

      {/* Stats strip */}
      <div className="stats-row">
        <div className="scard">
          <div style={{ fontSize: 22 }}>🏪</div>
          <div className="scard-text"><div className="sv">{vendors.length}</div><div className="sl">Total Vendors</div></div>
        </div>
        <div className="scard" style={{ borderTop: '3px solid var(--green)' }}>
          <div style={{ fontSize: 22 }}>✅</div>
          <div className="scard-text"><div className="sv" style={{ color: 'var(--green)' }}>{vendors.filter(v => v.is_active).length}</div><div className="sl">Active</div></div>
        </div>
        <div className="scard" style={{ borderTop: '3px solid #94a3b8' }}>
          <div style={{ fontSize: 22 }}>⏸️</div>
          <div className="scard-text"><div className="sv" style={{ color: '#94a3b8' }}>{vendors.filter(v => !v.is_active).length}</div><div className="sl">Inactive</div></div>
        </div>
        <div className="scard" style={{ borderTop: '3px solid var(--accent)' }}>
          <div style={{ fontSize: 22 }}>🏷️</div>
          <div className="scard-text"><div className="sv" style={{ color: 'var(--accent)' }}>{categories.length}</div><div className="sl">Categories</div></div>
        </div>
      </div>

      {/* Vendor list */}
      <div className="card">
        <div className="ch">
          <div className="ct">All Vendors</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="sw2">
              <span className="si2">🔍</span>
              <input placeholder="Search vendors…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="fsel" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="fsel" value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="1">Active only</option>
              <option value="0">Inactive only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-wrap">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="ei">🏪</div>
            <h4>No vendors found</h4>
            <p>{vendors.length === 0 ? 'Add your first vendor to get started' : 'Try adjusting your filters'}</p>
            {vendors.length === 0 && <button className="btn-p" onClick={openCreate}>+ Add Vendor</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, padding: 20 }}>
            {filtered.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                categories={categories}
                onView={() => setViewModal(vendor)}
                onEdit={() => openEdit(vendor)}
                onDelete={() => setDeleteModal(vendor)}
                onToggle={() => toggleActive(vendor)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ─────────────────────────────────────────────── */}
      <Modal show={createModal} onClose={() => setCreateModal(false)}
        title="Add New Vendor" subtitle="Create a supplier and link to inventory categories" wide
        footer={<>
          <button className="btn-c" onClick={() => setCreateModal(false)}>Cancel</button>
          <button className="btn-p" onClick={saveCreate}>Create Vendor</button>
        </>}>
        <VendorForm {...formProps} />
      </Modal>

      {/* ── EDIT MODAL ───────────────────────────────────────────────── */}
      <Modal show={!!editModal} onClose={() => setEditModal(null)}
        title={`Edit — ${editModal?.name}`} subtitle="Update vendor details and category links" wide
        footer={<>
          <button className="btn-c" onClick={() => setEditModal(null)}>Cancel</button>
          <button className="btn-p" onClick={saveEdit}>Save Changes</button>
        </>}>
        <VendorForm {...formProps} />
      </Modal>

      {/* ── VIEW MODAL ───────────────────────────────────────────────── */}
      {viewModal && (
        <Modal show onClose={() => setViewModal(null)} title={viewModal.name}
          subtitle={viewModal.is_active ? '✅ Active vendor' : '⏸️ Inactive vendor'} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Contact', viewModal.contact_name],
                ['Phone',   viewModal.phone],
                ['Email',   viewModal.email],
                ['Status',  viewModal.is_active ? 'Active' : 'Inactive'],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1.5px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
                  <div style={{ fontWeight: 700, marginTop: 3 }}>{value}</div>
                </div>
              ))}
            </div>
            {viewModal.address && (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1.5px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Address</div>
                <div style={{ fontSize: 13 }}>{viewModal.address}</div>
              </div>
            )}
            {viewModal.notes && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,.06)', borderRadius: 10, border: '1.5px solid rgba(245,158,11,.2)' }}>
                <div style={{ fontSize: 11, color: '#b07a00', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13 }}>{viewModal.notes}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>🏷️ Supplies Categories</div>
              {viewModal.category_ids.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink2)' }}>No categories assigned</div>
              ) : (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {viewModal.category_names.map((name, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(232,87,42,.1)', color: 'var(--accent)', border: '1px solid rgba(232,87,42,.2)' }}>
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mft">
            <button className="btn-c" onClick={() => setViewModal(null)}>Close</button>
            <button className="btn-p" onClick={() => { setViewModal(null); openEdit(viewModal); }}>✏️ Edit</button>
          </div>
        </Modal>
      )}

      {/* ── DELETE CONFIRM ────────────────────────────────────────────── */}
      <ConfirmModal show={!!deleteModal} onClose={() => setDeleteModal(null)} onConfirm={doDelete}
        title="Delete Vendor" message={`Delete "${deleteModal?.name}"? This cannot be undone.`} />
    </div>
  );
}

// ── Vendor card ───────────────────────────────────────────────────────────────
function VendorCard({ vendor, categories, onView, onEdit, onDelete, onToggle }) {
  const catCount = vendor.category_ids?.length || 0;
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 14, overflow: 'hidden',
      border: `1.5px solid ${vendor.is_active ? 'var(--border)' : 'rgba(148,163,184,.3)'}`,
      opacity: vendor.is_active ? 1 : .7,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top accent bar */}
      <div style={{ height: 3, background: vendor.is_active ? 'var(--accent)' : '#94a3b8' }} />

      <div style={{ padding: '14px 16px', flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {vendor.name}
            </div>
            {vendor.contact_name && (
              <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>👤 {vendor.contact_name}</div>
            )}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0, marginLeft: 8,
            background: vendor.is_active ? 'rgba(29,185,126,.12)' : 'rgba(148,163,184,.15)',
            color: vendor.is_active ? 'var(--green)' : '#94a3b8',
          }}>
            {vendor.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Contact info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {vendor.phone && <div style={{ fontSize: 12, color: 'var(--ink2)' }}>📞 {vendor.phone}</div>}
          {vendor.email && <div style={{ fontSize: 12, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉️ {vendor.email}</div>}
          {vendor.address && <div style={{ fontSize: 12, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {vendor.address}</div>}
        </div>

        {/* Category tags */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minHeight: 26 }}>
          {catCount === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--ink2)', fontStyle: 'italic' }}>No categories linked</span>
          ) : vendor.category_names.slice(0, 4).map((name, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(232,87,42,.09)', color: 'var(--accent)' }}>
              {name}
            </span>
          ))}
          {catCount > 4 && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--bg)', color: 'var(--ink2)' }}>
              +{catCount - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button className="bsm bo" onClick={onView} title="View details">👁️</button>
        <button className="bsm be" onClick={onEdit} title="Edit">✏️</button>
        <button className="bsm"
          onClick={onToggle}
          title={vendor.is_active ? 'Deactivate' : 'Activate'}
          style={{ background: vendor.is_active ? 'rgba(148,163,184,.1)' : 'rgba(29,185,126,.1)', color: vendor.is_active ? '#94a3b8' : 'var(--green)' }}>
          {vendor.is_active ? '⏸' : '▶'}
        </button>
        <button className="bsm bd" onClick={onDelete} title="Delete">🗑️</button>
      </div>
    </div>
  );
}
