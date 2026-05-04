import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getAddonGroups, createAddonGroup, updateAddonGroup, deleteAddonGroup,
  createAddonItem, updateAddonItem, deleteAddonItem,
  getMenuItems, getAllAddonLinks, linkMenuItemAddons,
} from '../../api';

// ── Helpers ────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    {children}
  </div>
);

const INPUT_STYLE = { width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827' };
const BTN = { padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 };
const PRIMARY = { ...BTN, background: '#e23744', color: '#fff' };
const GHOST = { ...BTN, background: 'none', border: '1.5px solid #e5e7eb', color: '#374151' };
const DANGER = { ...BTN, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' };

export default function AddonsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [addonLinks, setAddonLinks] = useState({}); // { menu_item_id: [group_ids] }
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Group form
  const [gForm, setGForm] = useState({ name: '', is_required: false, min_select: 1, max_select: 1 });
  const [gEdit, setGEdit] = useState(null); // group id being edited
  const [gLoading, setGLoading] = useState(false);

  // Item form
  const [iForm, setIForm] = useState({ name: '', price: '' });
  const [iEdit, setIEdit] = useState(null); // item id being edited
  const [iLoading, setILoading] = useState(false);

  // Links tab
  const [activeTab, setActiveTab] = useState('groups'); // groups | links
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const [gd, md, ld] = await Promise.all([getAddonGroups(), getMenuItems(), getAllAddonLinks()]);
      if (gd.success) setGroups(gd.data);
      if (md.success) setMenuItems(md.data);
      if (ld.success) setAddonLinks(ld.data);
    } catch { toast('Failed to load', 'er'); }
    finally { setLoadingGroups(false); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // ── Group CRUD ─────────────────────────────────────────────
  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!gForm.name.trim()) { toast('Group name is required', 'er'); return; }
    setGLoading(true);
    try {
      const payload = { ...gForm, min_select: Number(gForm.min_select), max_select: Number(gForm.max_select) };
      const d = gEdit
        ? await updateAddonGroup(gEdit, payload)
        : await createAddonGroup(payload);
      if (d.success) {
        toast(gEdit ? 'Group updated' : 'Group created', 'ok');
        setGForm({ name: '', is_required: false, min_select: 1, max_select: 1 });
        setGEdit(null);
        void load();
      } else toast(d.message || 'Save failed', 'er');
    } catch { toast('Error saving group', 'er'); }
    finally { setGLoading(false); }
  };

  const startEditGroup = (g) => {
    setGEdit(g.id);
    setGForm({ name: g.name, is_required: !!g.is_required, min_select: g.min_select, max_select: g.max_select });
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Delete this addon group? All items will be removed.')) return;
    const d = await deleteAddonGroup(id);
    if (d.success) { toast('Deleted', 'ok'); void load(); if (selectedGroup?.id === id) setSelectedGroup(null); }
    else toast(d.message || 'Delete failed', 'er');
  };

  // ── Item CRUD ──────────────────────────────────────────────
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!iForm.name.trim() || !selectedGroup) { toast('Name required', 'er'); return; }
    setILoading(true);
    try {
      const payload = { name: iForm.name, price: Number(iForm.price) || 0 };
      const d = iEdit
        ? await updateAddonItem(iEdit, payload)
        : await createAddonItem(selectedGroup.id, payload);
      if (d.success) {
        toast(iEdit ? 'Item updated' : 'Item added', 'ok');
        setIForm({ name: '', price: '' });
        setIEdit(null);
        void load();
      } else toast(d.message || 'Save failed', 'er');
    } catch { toast('Error saving item', 'er'); }
    finally { setILoading(false); }
  };

  const startEditItem = (item) => {
    setIEdit(item.id);
    setIForm({ name: item.name, price: String(item.price || '') });
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Remove this addon item?')) return;
    const d = await deleteAddonItem(itemId);
    if (d.success) { toast('Removed', 'ok'); void load(); }
    else toast(d.message || 'Delete failed', 'er');
  };

  // ── Links ──────────────────────────────────────────────────
  const toggleLink = async (menuItemId, groupId) => {
    const cur = addonLinks[menuItemId] || [];
    const newIds = cur.includes(groupId) ? cur.filter((g) => g !== groupId) : [...cur, groupId];
    setAddonLinks((prev) => ({ ...prev, [menuItemId]: newIds }));
    setLinkSaving(true);
    try {
      const d = await linkMenuItemAddons(menuItemId, newIds);
      if (!d.success) { toast(d.message || 'Link failed', 'er'); void load(); }
    } catch { toast('Error', 'er'); void load(); }
    finally { setLinkSaving(false); }
  };

  const filteredItems = menuItems.filter((m) => !linkSearch || m.name?.toLowerCase().includes(linkSearch.toLowerCase()));
  const activeGroupObj = groups.find((g) => g.id === selectedGroup?.id) || selectedGroup;

  return (
    <div style={{ padding: '20px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1c1c1c' }}>Add-on Groups</h1>
        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 13 }}>Create customisation groups (like Swiggy/Zomato) and link them to menu items</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f4f4f5', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {['groups', 'links'].map((t) => (
          <button key={t} style={{ ...BTN, padding: '8px 20px', background: activeTab === t ? '#fff' : 'none', color: activeTab === t ? '#e23744' : '#6b7280', boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', border: 'none' }}
            onClick={() => setActiveTab(t)}>
            {t === 'groups' ? 'Manage Groups' : 'Link to Menu Items'}
          </button>
        ))}
      </div>

      {/* ── GROUPS TAB ── */}
      {activeTab === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Left: group CRUD form */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 15 }}>{gEdit ? 'Edit Group' : 'New Group'}</h3>
            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Field label="Group Name">
                <input style={INPUT_STYLE} placeholder="e.g. Choose your base" value={gForm.name} onChange={(e) => setGForm({ ...gForm, name: e.target.value })} />
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Min select">
                  <input style={{ ...INPUT_STYLE, width: '100%' }} type="number" min="0" value={gForm.min_select} onChange={(e) => setGForm({ ...gForm, min_select: e.target.value })} />
                </Field>
                <Field label="Max select">
                  <input style={{ ...INPUT_STYLE, width: '100%' }} type="number" min="1" value={gForm.max_select} onChange={(e) => setGForm({ ...gForm, max_select: e.target.value })} />
                </Field>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={gForm.is_required} onChange={(e) => setGForm({ ...gForm, is_required: e.target.checked })} />
                Required (customer must select)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={PRIMARY} type="submit" disabled={gLoading}>{gLoading ? 'Saving…' : gEdit ? 'Update Group' : 'Create Group'}</button>
                {gEdit && <button style={GHOST} type="button" onClick={() => { setGEdit(null); setGForm({ name: '', is_required: false, min_select: 1, max_select: 1 }); }}>Cancel</button>}
              </div>
            </form>
          </div>

          {/* Middle: group list */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 14px', fontWeight: 800, fontSize: 15 }}>All Groups {loadingGroups && <span style={{ fontSize: 12, color: '#9ca3af' }}>loading…</span>}</h3>
            {groups.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No groups yet</p>}
            {groups.map((g) => (
              <div key={g.id} style={{ padding: '10px 12px', borderRadius: 10, border: `2px solid ${selectedGroup?.id === g.id ? '#e23744' : '#e5e7eb'}`, marginBottom: 8, cursor: 'pointer', background: selectedGroup?.id === g.id ? '#fff5f5' : '#fff' }}
                onClick={() => setSelectedGroup(g)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#1c1c1c' }}>{g.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={GHOST} onClick={(e) => { e.stopPropagation(); startEditGroup(g); }}>Edit</button>
                    <button style={DANGER} onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}>Del</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                  {g.is_required ? 'Required' : 'Optional'} · {(g.items || []).length} item(s) · max {g.max_select}
                </div>
              </div>
            ))}
          </div>

          {/* Right: items within selected group */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 14px', fontWeight: 800, fontSize: 15 }}>
              {selectedGroup ? `Items — ${selectedGroup.name}` : 'Select a group →'}
            </h3>
            {selectedGroup && (
              <>
                <form onSubmit={handleSaveItem} style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    <Field label="Item name"><input style={INPUT_STYLE} placeholder="e.g. Extra cheese" value={iForm.name} onChange={(e) => setIForm({ ...iForm, name: e.target.value })} /></Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Price (₹)"><input style={INPUT_STYLE} type="number" min="0" placeholder="0" value={iForm.price} onChange={(e) => setIForm({ ...iForm, price: e.target.value })} /></Field>
                  </div>
                  <button style={{ ...PRIMARY, marginBottom: 10 }} type="submit" disabled={iLoading}>{iLoading ? '…' : iEdit ? 'Update' : 'Add'}</button>
                  {iEdit && <button style={{ ...GHOST, marginBottom: 10 }} type="button" onClick={() => { setIEdit(null); setIForm({ name: '', price: '' }); }}>✕</button>}
                </form>

                {(activeGroupObj?.items || []).length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No items yet</p>}
                {(activeGroupObj?.items || []).map((ai) => (
                  <div key={ai.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#f9fafb', marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{ai.name}</span>
                    <span style={{ fontSize: 13, color: '#e23744', fontWeight: 700 }}>₹{Number(ai.price).toFixed(0)}</span>
                    <button style={GHOST} onClick={() => startEditItem(ai)}>Edit</button>
                    <button style={DANGER} onClick={() => handleDeleteItem(ai.id)}>Del</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── LINKS TAB ── */}
      {activeTab === 'links' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Link Add-on Groups to Menu Items</h3>
            {linkSaving && <span style={{ fontSize: 12, color: '#9ca3af' }}>Saving…</span>}
          </div>
          <input style={{ ...INPUT_STYLE, marginBottom: 14, maxWidth: 320 }} placeholder="Search menu items…" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} />

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, color: '#374151', borderBottom: '1.5px solid #e5e7eb' }}>Menu Item</th>
                  {groups.map((g) => (
                    <th key={g.id} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#6b7280', borderBottom: '1.5px solid #e5e7eb', maxWidth: 100 }}>
                      <div style={{ fontSize: 11 }}>{g.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((mi) => (
                  <tr key={mi.id} style={{ borderBottom: '1px solid #f4f4f5' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{mi.name}</td>
                    {groups.map((g) => {
                      const linked = (addonLinks[mi.id] || []).includes(g.id);
                      return (
                        <td key={g.id} style={{ textAlign: 'center', padding: '9px 12px' }}>
                          <button
                            style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${linked ? '#e23744' : '#d1d5db'}`, background: linked ? '#e23744' : '#fff', color: linked ? '#fff' : '#d1d5db', cursor: 'pointer', fontSize: 14, fontWeight: 800 }}
                            onClick={() => toggleLink(mi.id, g.id)}
                          >
                            {linked ? '✓' : '+'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
