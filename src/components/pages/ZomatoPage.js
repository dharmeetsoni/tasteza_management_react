import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getZomatoSettings, saveZomatoSettings,
  getZomatoMenu, getZomatoAvailable,
  addZomatoItem, bulkAddZomato, updateZomatoItem, removeZomatoItem,
  getMenuItems
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

// ─────────────────────────────────────────────────────────────────
// MATH ENGINE
// ─────────────────────────────────────────────────────────────────
function calcZomato({ listedPrice, costPrice, commission, discount }) {
  const p  = parseFloat(listedPrice) || 0;
  const c  = parseFloat(costPrice)   || 0;
  const zc = parseFloat(commission)  / 100;
  const cd = parseFloat(discount)    / 100;
  const customerPays = +(p * (1 - cd)).toFixed(2);
  const zomatoCut    = +(customerPays * zc).toFixed(2);
  const youReceive   = +(customerPays - zomatoCut).toFixed(2);
  const profit       = +(youReceive - c).toFixed(2);
  const marginPct    = youReceive > 0 ? +((profit / youReceive) * 100).toFixed(1) : null;
  return { customerPays, zomatoCut, youReceive, profit, marginPct };
}

function predictListedPrice({ costPrice, targetMargin, commission, discount }) {
  const c  = parseFloat(costPrice)    || 0;
  const tm = parseFloat(targetMargin) / 100;
  const zc = parseFloat(commission)   / 100;
  const cd = parseFloat(discount)     / 100;
  if (tm >= 1 || c === 0) return 0;
  const youReceive = c / (1 - tm);
  return +(youReceive / ((1 - cd) * (1 - zc))).toFixed(2);
}

function smartRound(price) {
  if (!price || price <= 0) return 0;
  const r9 = Math.ceil(price / 10) * 10 - 1;
  return r9 >= price ? r9 : Math.ceil(price / 5) * 5;
}

const marginColor = (m) => {
  if (m === null || m === undefined) return { color: '#aaa', bg: 'rgba(150,150,150,.1)' };
  if (m >= 30) return { color: '#1db97e', bg: 'rgba(29,185,126,.1)' };
  if (m >= 15) return { color: '#118ab2', bg: 'rgba(17,138,178,.1)' };
  if (m >=  0) return { color: '#b07a00', bg: 'rgba(244,165,53,.12)' };
  return { color: '#e84a5f', bg: 'rgba(232,74,95,.1)' };
};

const DISC_PRESETS   = [0, 10, 20, 30, 50];
const COMM_PRESETS   = [18, 22, 25, 30];
const MARGIN_PRESETS = [20, 25, 30, 35, 40];

// ─────────────────────────────────────────────────────────────────
// INLINE PRICE EDITOR
// ─────────────────────────────────────────────────────────────────
function PriceCell({ zmItem, commission, discount, onSave }) {
  const [editing, setEditing] = useState(false);
  const [price,   setPrice]   = useState(String(zmItem.listed_price));
  const [margin,  setMargin]  = useState(zmItem.target_margin || 30);
  const [saving,  setSaving]  = useState(false);

  const costPrice = parseFloat(zmItem.cost_price) || parseFloat(zmItem.base_price) * 0.4;
  const calc      = calcZomato({ listedPrice: price, costPrice, commission, discount });
  const mc        = marginColor(calc.marginPct);

  const predict = () => {
    const p = predictListedPrice({ costPrice, targetMargin: margin, commission, discount });
    setPrice(String(smartRound(p)));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(zmItem.id, {
      listed_price: parseFloat(price),
      target_margin: parseFloat(margin),
      zomato_item_name: zmItem.zomato_item_name,
      zomato_description: zmItem.zomato_description,
      is_available: zmItem.is_available,
      is_featured: zmItem.is_featured,
      sort_order: zmItem.sort_order || 0,
    });
    setSaving(false);
    setEditing(false);
  };

  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{fmtCur(zmItem.listed_price)}</div>
        <div style={{ fontSize: 11, color: 'var(--ink2)' }}>
          Cust: {fmtCur(calcZomato({ listedPrice: zmItem.listed_price, costPrice, commission, discount }).customerPays)}
        </div>
      </div>
      <button onClick={() => { setPrice(String(zmItem.listed_price)); setEditing(true); }}
        style={{ fontSize: 13, padding: '4px 8px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--ink2)' }}>✏️</button>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg)', border: '2px solid var(--accent)', borderRadius: 10, padding: 10, minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,.12)', position: 'relative', zIndex: 10 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--ink2)' }}>₹</span>
        <input type="number" min="0" autoFocus
          style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, fontWeight: 800, background: 'var(--surface)', color: 'var(--ink)' }}
          value={price} onChange={e => setPrice(e.target.value)} />
        <button onClick={predict}
          style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(232,87,42,.1)', color: 'var(--accent)', border: '1.5px solid rgba(232,87,42,.25)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
          🎯 Auto
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {MARGIN_PRESETS.map(m => (
          <button key={m} type="button"
            style={{ padding: '3px 8px', borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .1s',
              background: margin === m ? 'var(--accent)' : 'transparent',
              color: margin === m ? '#fff' : 'var(--ink2)',
              borderColor: margin === m ? 'var(--accent)' : 'var(--border)' }}
            onClick={() => setMargin(m)}>{m}%</button>
        ))}
      </div>
      {parseFloat(price) > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[
            { label: 'Cust Pays', val: fmtCur(calc.customerPays) },
            { label: 'You Get',   val: fmtCur(calc.youReceive) },
            { label: 'Margin',    val: calc.marginPct !== null ? `${calc.marginPct}%` : '—' },
          ].map(({ label, val }, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '5px 4px', background: i === 2 ? mc.bg : 'var(--surface)', borderRadius: 7 }}>
              <div style={{ fontSize: 9, color: 'var(--ink2)', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: i === 2 ? mc.color : 'var(--ink)' }}>{val}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setEditing(false)}
          style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 2, padding: '7px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
          {saving ? 'Saving…' : '✅ Save'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function ZomatoPage() {
  const toast = useToast();

  const [settings,  setSettings]  = useState({ commission_pct: 22, active_discount: 0, restaurant_name: 'My Restaurant' });
  const [zmMenu,    setZmMenu]    = useState([]);
  const [available, setAvailable] = useState([]);
  const [allItems,  setAllItems]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('menu');

  const [search,       setSearch]       = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [showUnavail,  setShowUnavail]  = useState(false);

  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsForm,  setSettingsForm]  = useState(settings);
  const [addModal,      setAddModal]      = useState(false);
  const [addSelected,   setAddSelected]   = useState({});
  const [addSaving,     setAddSaving]     = useState(false);
  const [editModal,     setEditModal]     = useState(null);
  const [editForm,      setEditForm]      = useState({});
  const [removeModal,   setRemoveModal]   = useState(null);

  const [predDiscount,   setPredDiscount]   = useState(20);
  const [predMargin,     setPredMargin]     = useState(30);
  const [predCustomDisc, setPredCustomDisc] = useState('');

  const commission = parseFloat(settings.commission_pct) || 22;
  const discount   = parseFloat(settings.active_discount) || 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, a, all] = await Promise.all([
        getZomatoSettings(), getZomatoMenu(), getZomatoAvailable(), getMenuItems()
      ]);
      if (s.success) setSettings(s.data);
      if (m.success) setZmMenu(m.data);
      if (a.success) setAvailable(a.data);
      if (all.success) setAllItems(all.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const courses = useMemo(() => {
    const seen = {};
    zmMenu.forEach(m => { if (m.course_id && !seen[m.course_id]) seen[m.course_id] = { id: m.course_id, name: m.course_name, icon: m.course_icon }; });
    return Object.values(seen);
  }, [zmMenu]);

  const filteredMenu = useMemo(() => zmMenu.filter(m => {
    if (!showUnavail && !m.is_available) return false;
    if (courseFilter && m.course_id !== parseInt(courseFilter)) return false;
    if (search && !(m.zomato_item_name || m.item_name).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [zmMenu, showUnavail, courseFilter, search]);

  const stats = useMemo(() => {
    let totalItems = zmMenu.length, avail = 0, goodMargin = 0, lossItems = 0;
    zmMenu.forEach(m => {
      if (m.is_available) avail++;
      const cost = parseFloat(m.cost_price) || parseFloat(m.base_price) * 0.4;
      const r = calcZomato({ listedPrice: m.listed_price, costPrice: cost, commission, discount });
      if (r.marginPct >= 20) goodMargin++;
      if (r.profit < 0) lossItems++;
    });
    return { totalItems, avail, goodMargin, lossItems };
  }, [zmMenu, commission, discount]);

  const saveSettings = async () => {
    try {
      const d = await saveZomatoSettings(settingsForm);
      if (d.success) { setSettings({ ...settingsForm }); setSettingsModal(false); toast('Settings saved! ✅', 'ok'); }
      else toast(d.message, 'er');
    } catch { toast('Error saving settings', 'er'); }
  };

  const saveItemPrice = async (id, data) => {
    try {
      const d = await updateZomatoItem(id, data);
      if (d.success) { toast('Price updated! ✅', 'ok'); await load(); }
      else toast(d.message, 'er');
    } catch { toast('Error', 'er'); }
  };

  const toggleAvail = async (item) => {
    try {
      await updateZomatoItem(item.id, {
        listed_price: item.listed_price, target_margin: item.target_margin,
        zomato_item_name: item.zomato_item_name, zomato_description: item.zomato_description,
        is_available: item.is_available ? 0 : 1, is_featured: item.is_featured, sort_order: item.sort_order || 0,
      });
      setZmMenu(prev => prev.map(m => m.id === item.id ? { ...m, is_available: m.is_available ? 0 : 1 } : m));
    } catch { toast('Error', 'er'); }
  };

  const toggleFeatured = async (item) => {
    try {
      await updateZomatoItem(item.id, {
        listed_price: item.listed_price, target_margin: item.target_margin,
        zomato_item_name: item.zomato_item_name, zomato_description: item.zomato_description,
        is_available: item.is_available, is_featured: item.is_featured ? 0 : 1, sort_order: item.sort_order || 0,
      });
      setZmMenu(prev => prev.map(m => m.id === item.id ? { ...m, is_featured: m.is_featured ? 0 : 1 } : m));
      toast(item.is_featured ? 'Removed from featured' : '⭐ Marked as featured', 'ok');
    } catch { toast('Error', 'er'); }
  };

  const openAddModal = () => {
    const prefilled = {};
    available.forEach(item => {
      const cost = parseFloat(item.cost_price) || parseFloat(item.selling_price) * 0.4;
      const listed = smartRound(predictListedPrice({ costPrice: cost, targetMargin: 30, commission, discount: 20 }));
      prefilled[item.id] = { listed_price: listed || item.selling_price, target_margin: 30, selected: false };
    });
    setAddSelected(prefilled);
    setAddModal(true);
  };

  const toggleAddSelect = (id) => {
    setAddSelected(prev => ({ ...prev, [id]: { ...prev[id], selected: !prev[id]?.selected } }));
  };

  const selectAllAvail = (val) => {
    setAddSelected(prev => {
      const next = { ...prev };
      available.forEach(i => { next[i.id] = { ...next[i.id], selected: val }; });
      return next;
    });
  };

  const doAdd = async () => {
    const items = available
      .filter(i => addSelected[i.id]?.selected)
      .map(i => ({
        menu_item_id:  i.id,
        listed_price:  parseFloat(addSelected[i.id]?.listed_price) || parseFloat(i.selling_price),
        target_margin: parseFloat(addSelected[i.id]?.target_margin) || 30,
      }));
    if (!items.length) { toast('Select at least one item.', 'er'); return; }
    setAddSaving(true);
    try {
      const d = await bulkAddZomato({ items });
      if (d.success) { toast(`${items.length} item(s) added! ✅`, 'ok'); setAddModal(false); await load(); }
      else toast(d.message, 'er');
    } finally { setAddSaving(false); }
  };

  const openEdit = (item) => {
    setEditForm({
      listed_price:       item.listed_price,
      target_margin:      item.target_margin || 30,
      zomato_item_name:   item.zomato_item_name || '',
      zomato_description: item.zomato_description || '',
      is_available:       !!item.is_available,
      is_featured:        !!item.is_featured,
      sort_order:         item.sort_order || 0,
    });
    setEditModal(item);
  };

  const saveEdit = async () => {
    try {
      const d = await updateZomatoItem(editModal.id, editForm);
      if (d.success) { toast('Updated! ✅', 'ok'); setEditModal(null); await load(); }
      else toast(d.message, 'er');
    } catch { toast('Error', 'er'); }
  };

  const doRemove = async () => {
    try {
      const d = await removeZomatoItem(removeModal.id);
      if (d.success) { toast('Removed from Zomato menu.', 'ok'); setRemoveModal(null); await load(); }
      else toast(d.message, 'er');
    } catch { toast('Error', 'er'); }
  };

  const predDiscountTiers = useMemo(() => {
    const tiers = [...DISC_PRESETS];
    const c = parseFloat(predCustomDisc);
    if (!isNaN(c) && c > 0 && !tiers.includes(c)) tiers.push(c);
    return tiers.sort((a, b) => a - b);
  }, [predCustomDisc]);

  // ── GROUP MENU BY COURSE ────────────────────────────────
  const menuGroups = useMemo(() => {
    const g = {};
    filteredMenu.forEach(m => {
      const k = m.course_name || 'Other';
      if (!g[k]) g[k] = { icon: m.course_icon, color: m.course_color, items: [] };
      g[k].items.push(m);
    });
    return Object.entries(g);
  }, [filteredMenu]);

  return (
    <div>
      {/* ── Header ───────────────────────────────────────── */}
      <div className="ph">
        <div className="ph-left">
          <div className="pt">🛵 Zomato Menu</div>
          <div className="ps">Manage your Zomato menu, set prices & track margins per item</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-c" onClick={() => { setSettingsForm({ ...settings }); setSettingsModal(true); }}>⚙️ Settings</button>
          <button className="btn-p" onClick={openAddModal}>+ Add Items</button>
        </div>
      </div>

      {/* ── Active settings strip ─────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '12px 20px', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase' }}>Commission</span>
          <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(232,74,95,.1)', color: '#e84a5f', fontWeight: 800, fontSize: 13 }}>{commission}%</span>
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase' }}>Active Discount</span>
          <span style={{ padding: '4px 12px', borderRadius: 20, background: discount > 0 ? 'rgba(232,112,41,.12)' : 'rgba(150,150,150,.1)', color: discount > 0 ? 'var(--accent)' : 'var(--ink2)', fontWeight: 800, fontSize: 13 }}>
            {discount > 0 ? `${discount}% off` : 'None'}
          </span>
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div style={{ fontWeight: 700, fontSize: 13 }}>{settings.restaurant_name}</div>
        <button onClick={() => { setSettingsForm({ ...settings }); setSettingsModal(true); }}
          style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>✏️ Edit</button>
      </div>

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>📋</div><div className="scard-text"><div className="sv">{stats.totalItems}</div><div className="sl">On Zomato</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #1db97e' }}><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv" style={{ color: '#1db97e' }}>{stats.avail}</div><div className="sl">Available</div></div></div>
        <div className="scard" style={{ borderTop: '3px solid #118ab2' }}><div style={{ fontSize: 20 }}>📈</div><div className="scard-text"><div className="sv" style={{ color: '#118ab2' }}>{stats.goodMargin}</div><div className="sl">≥20% Margin</div></div></div>
        {stats.lossItems > 0 && <div className="scard" style={{ borderTop: '3px solid #e84a5f' }}><div style={{ fontSize: 20 }}>⚠️</div><div className="scard-text"><div className="sv" style={{ color: '#e84a5f' }}>{stats.lossItems}</div><div className="sl">At Loss!</div></div></div>}
        <div className="scard"><div style={{ fontSize: 20 }}>➕</div><div className="scard-text"><div className="sv">{available.length}</div><div className="sl">Not Listed</div></div></div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { id: 'menu',      icon: '📋', label: 'Zomato Menu',     desc: `${stats.totalItems} items` },
          { id: 'predictor', icon: '🎯', label: 'Price Predictor', desc: 'All menu items' },
          { id: 'matrix',    icon: '📊', label: 'Margin Matrix',   desc: 'Discount × Price' },
        ].map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            style={{ padding: '12px 22px', border: 'none', cursor: 'pointer', background: activeTab === tab.id ? 'rgba(232,87,42,.06)' : 'transparent',
              borderBottom: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: -2, color: activeTab === tab.id ? 'var(--accent)' : 'var(--ink2)', transition: 'all .13s' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{tab.icon} {tab.label}</div>
            <div style={{ fontSize: 10, marginTop: 1 }}>{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: ZOMATO MENU
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'menu' && (
        <div>
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="sw2" style={{ flex: 1 }}><span className="si2">🔍</span><input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} /></div>
              <select className="fsel" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                <option value="">All Categories</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={showUnavail} onChange={e => setShowUnavail(e.target.checked)} />
                Show Unavailable
              </label>
            </div>
          </div>

          {loading ? <div className="loading-wrap">Loading…</div>
            : zmMenu.length === 0 ? (
              <div className="card"><div className="empty" style={{ padding: 50 }}>
                <div className="ei">🛵</div>
                <h4>No items on Zomato menu yet</h4>
                <p>Click <strong>+ Add Items</strong> to start listing your menu items on Zomato</p>
                <button className="btn-p" style={{ marginTop: 14 }} onClick={openAddModal}>+ Add Items</button>
              </div></div>
            ) : menuGroups.map(([course, { icon, color, items }]) => (
              <div key={course} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', background: color ? `${color}18` : 'rgba(232,87,42,.04)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{course}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink2)', marginLeft: 'auto' }}>{items.length} items</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,.02)', fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Item</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Base Price</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Cost</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Listed Price ✏️</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>You Receive</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Profit</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Margin</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const cost = parseFloat(item.cost_price) || parseFloat(item.base_price) * 0.4;
                        const calc = calcZomato({ listedPrice: item.listed_price, costPrice: cost, commission, discount });
                        const mc   = marginColor(calc.marginPct);
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: item.is_available ? 1 : 0.5 }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <span style={{ marginTop: 2 }}>{item.is_veg ? '🟢' : '🔴'}</span>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                                    {item.zomato_item_name || item.item_name}
                                    {!!item.is_featured && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(255,193,7,.2)', color: '#b07a00', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>⭐ Featured</span>}
                                  </div>
                                  {item.zomato_item_name && item.zomato_item_name !== item.item_name &&
                                    <div style={{ fontSize: 10, color: 'var(--ink2)' }}>{item.item_name}</div>}
                                  {item.zomato_description &&
                                    <div style={{ fontSize: 10, color: 'var(--ink2)', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.zomato_description}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: 'var(--ink2)' }}>{fmtCur(item.base_price)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--ink2)' }}>
                              {fmtCur(cost)}{!item.cost_price && <div style={{ fontSize: 9, color: '#b07a00' }}>estimated</div>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <PriceCell zmItem={{ ...item, cost_price: cost }} commission={commission} discount={discount} onSave={saveItemPrice} />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{fmtCur(calc.youReceive)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: calc.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtCur(calc.profit)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span style={{ padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: mc.bg, color: mc.color }}>
                                {calc.marginPct !== null ? `${calc.marginPct}%` : '—'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <button onClick={() => toggleAvail(item)}
                                style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                                  background: item.is_available ? 'rgba(29,185,126,.1)' : 'rgba(232,74,95,.08)',
                                  color: item.is_available ? '#1db97e' : '#e84a5f',
                                  borderColor: item.is_available ? '#1db97e' : '#e84a5f' }}>
                                {item.is_available ? '✅ Live' : '❌ Off'}
                              </button>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <div className="tact">
                                <button className="bsm" title="Toggle Featured" style={{ fontSize: 14 }} onClick={() => toggleFeatured(item)}>⭐</button>
                                <button className="bsm be" onClick={() => openEdit(item)}>✏️</button>
                                <button className="bsm bd" onClick={() => setRemoveModal(item)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: PRICE PREDICTOR
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'predictor' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', marginBottom: 8, textTransform: 'uppercase' }}>🎯 Target Margin</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MARGIN_PRESETS.map(m => (
                  <button key={m} type="button"
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                      background: predMargin === m ? 'var(--accent)' : 'transparent',
                      color: predMargin === m ? '#fff' : 'var(--ink2)',
                      borderColor: predMargin === m ? 'var(--accent)' : 'var(--border)' }}
                    onClick={() => setPredMargin(m)}>{m}%</button>
                ))}
                <input type="number" min="0" max="99" placeholder="Custom %"
                  style={{ width: 80, padding: '6px 10px', borderRadius: 20, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--ink)' }}
                  value={MARGIN_PRESETS.includes(predMargin) ? '' : predMargin}
                  onChange={e => setPredMargin(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', marginBottom: 8, textTransform: 'uppercase' }}>🏷️ Simulate Discount</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {DISC_PRESETS.map(d => (
                  <button key={d} type="button"
                    style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                      background: predDiscount === d ? 'var(--accent)' : 'transparent',
                      color: predDiscount === d ? '#fff' : 'var(--ink2)',
                      borderColor: predDiscount === d ? 'var(--accent)' : 'var(--border)' }}
                    onClick={() => setPredDiscount(d)}>{d === 0 ? 'None' : `${d}%`}</button>
                ))}
                <input type="number" min="0" max="99" placeholder="Custom"
                  style={{ width: 70, padding: '6px 10px', borderRadius: 20, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--ink)' }}
                  value={predCustomDisc} onChange={e => setPredCustomDisc(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Required Zomato price for {predMargin}% margin @ {parseFloat(predCustomDisc) || predDiscount}% discount · {commission}% commission</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,.02)', fontSize: 11, color: 'var(--ink2)', fontWeight: 700 }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Item</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Cost</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Base Price</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--accent)' }}>Recommended Listed</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Markup</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Cust Pays</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>You Receive</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Profit</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>On Zomato?</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map(item => {
                    const cost = parseFloat(item.cost_price) || parseFloat(item.selling_price) * 0.4;
                    const d = parseFloat(predCustomDisc) || predDiscount;
                    const listed = smartRound(predictListedPrice({ costPrice: cost, targetMargin: predMargin, commission, discount: d }));
                    const calc = calcZomato({ listedPrice: listed, costPrice: cost, commission, discount: d });
                    const markup = listed > 0 ? ((listed / parseFloat(item.selling_price)) - 1) * 100 : 0;
                    const mc = marginColor(calc.marginPct);
                    const onZomato = zmMenu.find(z => z.menu_item_id === item.id);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <span>{item.is_veg ? '🟢' : '🔴'}</span>
                          <strong style={{ marginLeft: 6 }}>{item.name}</strong>
                          <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{item.course_name}</div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink2)' }}>
                          {fmtCur(cost)}{!item.cost_price && <span style={{ fontSize: 9, color: '#b07a00' }}> est.</span>}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{fmtCur(item.selling_price)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--accent)' }}>{fmtCur(listed)}</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink2)', fontSize: 12 }}>+{markup.toFixed(0)}%</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{fmtCur(calc.customerPays)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{fmtCur(calc.youReceive)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: calc.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtCur(calc.profit)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {onZomato
                            ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'rgba(29,185,126,.1)', color: '#1db97e', fontWeight: 700 }}>✅ Listed @ {fmtCur(onZomato.listed_price)}</span>
                            : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'rgba(150,150,150,.1)', color: '#888', fontWeight: 700 }}>Not Listed</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: MARGIN MATRIX
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'matrix' && (
        <div>
          <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase' }}>Discount tiers:</span>
            {DISC_PRESETS.map(d => (
              <span key={d} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: d === discount ? 'rgba(232,112,41,.15)' : 'rgba(0,0,0,.05)', color: d === discount ? 'var(--accent)' : 'var(--ink2)', border: d === discount ? '1.5px solid rgba(232,112,41,.3)' : '1.5px solid transparent' }}>
                {d === 0 ? 'No Disc' : `${d}% off`}{d === discount ? ' ← active' : ''}
              </span>
            ))}
            <input type="number" min="1" max="99" placeholder="+ Custom %"
              style={{ width: 90, padding: '5px 10px', borderRadius: 20, border: '1.5px dashed var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--ink)' }}
              value={predCustomDisc} onChange={e => setPredCustomDisc(e.target.value)} />
          </div>
          {zmMenu.length === 0
            ? <div className="card"><div className="empty" style={{ padding: 40 }}><div className="ei">📊</div><p>Add items to Zomato menu first</p></div></div>
            : zmMenu.map(item => {
                const cost = parseFloat(item.cost_price) || parseFloat(item.base_price) * 0.4;
                const base = parseFloat(item.base_price);
                const listedNow = parseFloat(item.listed_price);
                const priceMults = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5, 1.7, 2.0];
                return (
                  <div key={item.id} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: 'rgba(232,87,42,.04)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span>{item.is_veg ? '🟢' : '🔴'}</span>
                      <strong style={{ fontSize: 14 }}>{item.zomato_item_name || item.item_name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--ink2)' }}>Base: {fmtCur(base)} · Cost: {fmtCur(cost)} · Listed: {fmtCur(listedNow)}</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,.02)' }}>
                            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700 }}>Listed Price</th>
                            {predDiscountTiers.map(d => (
                              <th key={d} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap', color: d === discount ? 'var(--accent)' : 'inherit' }}>
                                {d === 0 ? 'No Disc' : `${d}% off`}
                                {d === discount && <div style={{ fontSize: 9, color: 'var(--accent)' }}>▲ active</div>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {priceMults.map(mult => {
                            const p = +(base * mult).toFixed(2);
                            const isCurrent = Math.abs(p - listedNow) < 1;
                            return (
                              <tr key={mult} style={{ borderTop: '1px solid var(--border)', background: isCurrent ? 'rgba(232,87,42,.05)' : 'transparent' }}>
                                <td style={{ padding: '8px 14px', fontWeight: isCurrent ? 900 : 600 }}>
                                  {fmtCur(p)}
                                  <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--ink2)' }}>{mult === 1.0 ? '(base)' : `×${mult}`}</span>
                                  {isCurrent && <span style={{ fontSize: 9, marginLeft: 6, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>current</span>}
                                </td>
                                {predDiscountTiers.map(d => {
                                  const r  = calcZomato({ listedPrice: p, costPrice: cost, commission, discount: d });
                                  const mc = marginColor(r.marginPct);
                                  return (
                                    <td key={d} style={{ padding: '7px 10px', textAlign: 'center', background: mc.bg }}>
                                      <div style={{ fontWeight: 800, color: mc.color }}>{r.marginPct !== null ? `${r.marginPct}%` : '—'}</div>
                                      <div style={{ fontSize: 10, color: 'var(--ink2)' }}>{r.profit >= 0 ? '+' : ''}{fmtCur(r.profit)}</div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
          }
          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, flexWrap: 'wrap' }}>
            {[['≥30% margin','rgba(29,185,126,.25)'], ['15–29%','rgba(17,138,178,.2)'], ['0–14%','rgba(244,165,53,.25)'], ['Loss','rgba(232,74,95,.2)']].map(([l, bg]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: bg, display: 'inline-block' }} /> {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}

      {/* Settings */}
      <Modal show={settingsModal} onClose={() => setSettingsModal(false)} title="Zomato Settings" subtitle="Configure commission and active offer"
        footer={<><button className="btn-c" onClick={() => setSettingsModal(false)}>Cancel</button><button className="btn-p" onClick={saveSettings}>Save Settings</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="mlabel">Restaurant Name on Zomato</label>
            <input className="mfi" value={settingsForm.restaurant_name || ''} onChange={e => setSettingsForm(f => ({ ...f, restaurant_name: e.target.value }))} placeholder="Your restaurant name" />
          </div>
          <div>
            <label className="mlabel">Zomato Commission %</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {COMM_PRESETS.map(c => (
                <button key={c} type="button"
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                    background: parseFloat(settingsForm.commission_pct) === c ? '#e84a5f' : 'transparent',
                    color: parseFloat(settingsForm.commission_pct) === c ? '#fff' : 'var(--ink2)',
                    borderColor: parseFloat(settingsForm.commission_pct) === c ? '#e84a5f' : 'var(--border)' }}
                  onClick={() => setSettingsForm(f => ({ ...f, commission_pct: c }))}>{c}%</button>
              ))}
            </div>
            <input className="mfi" type="number" min="0" max="50" placeholder="Custom %" value={settingsForm.commission_pct || ''} onChange={e => setSettingsForm(f => ({ ...f, commission_pct: e.target.value }))} />
            <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 4 }}>Zomato's cut from your order value</div>
          </div>
          <div>
            <label className="mlabel">Active Discount on Zomato %</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {[0, 10, 20, 30, 50].map(d => (
                <button key={d} type="button"
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                    background: parseFloat(settingsForm.active_discount) === d ? 'var(--accent)' : 'transparent',
                    color: parseFloat(settingsForm.active_discount) === d ? '#fff' : 'var(--ink2)',
                    borderColor: parseFloat(settingsForm.active_discount) === d ? 'var(--accent)' : 'var(--border)' }}
                  onClick={() => setSettingsForm(f => ({ ...f, active_discount: d }))}>{d === 0 ? 'None' : `${d}%`}</button>
              ))}
            </div>
            <input className="mfi" type="number" min="0" max="90" placeholder="Custom %" value={settingsForm.active_discount || ''} onChange={e => setSettingsForm(f => ({ ...f, active_discount: e.target.value }))} />
            <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 4 }}>The discount currently running for customers on Zomato — affects all margin calculations</div>
          </div>
        </div>
      </Modal>

      {/* Add Items */}
      <Modal show={addModal} onClose={() => setAddModal(false)} title="Add Items to Zomato Menu"
        subtitle={`${available.length} unlisted items · prices auto-predicted at 30% margin`} wide
        footer={<>
          <button className="btn-c" onClick={() => setAddModal(false)}>Cancel</button>
          <span style={{ fontSize: 12, color: 'var(--ink2)', padding: '0 8px' }}>{Object.values(addSelected).filter(v => v.selected).length} selected</span>
          <button className="btn-p" onClick={doAdd} disabled={addSaving}>{addSaving ? 'Adding…' : '✅ Add to Zomato Menu'}</button>
        </>}>
        {available.length === 0 ? (
          <div className="empty"><div className="ei">✅</div><h4>All items are already on Zomato!</h4></div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn-c" onClick={() => selectAllAvail(true)} style={{ fontSize: 12, padding: '6px 12px' }}>☑️ Select All</button>
              <button className="btn-c" onClick={() => selectAllAvail(false)} style={{ fontSize: 12, padding: '6px 12px' }}>☐ Clear</button>
              <span style={{ fontSize: 11, color: 'var(--ink2)', alignSelf: 'center', marginLeft: 4 }}>Tip: Edit the price cell to adjust before adding</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,.03)', fontSize: 11, color: 'var(--ink2)', fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', width: 40 }} />
                    <th style={{ padding: '8px 14px', textAlign: 'left' }}>Item</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Base</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Cost</th>
                    <th style={{ padding: '8px 14px', textAlign: 'center' }}>Zomato Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Predicted Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map(item => {
                    const sel = addSelected[item.id] || {};
                    const cost = parseFloat(item.cost_price) || parseFloat(item.selling_price) * 0.4;
                    const listedPrice = parseFloat(sel.listed_price) || parseFloat(item.selling_price);
                    const calc = calcZomato({ listedPrice, costPrice: cost, commission, discount });
                    const mc = marginColor(calc.marginPct);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: sel.selected ? 'rgba(232,87,42,.04)' : 'transparent', transition: 'background .1s' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input type="checkbox" checked={!!sel.selected} onChange={() => toggleAddSelect(item.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{item.is_veg ? '🟢' : '🔴'}</span>
                            <div>
                              <strong style={{ fontSize: 13 }}>{item.name}</strong>
                              <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{item.course_name}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink2)' }}>{fmtCur(item.selling_price)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--ink2)' }}>
                          {fmtCur(cost)}{!item.cost_price && <span style={{ fontSize: 9, color: '#b07a00' }}> est.</span>}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'var(--ink2)', fontSize: 13 }}>₹</span>
                            <input type="number" min="0"
                              style={{ width: 82, padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 700, textAlign: 'center', background: 'var(--bg)', color: 'var(--ink)' }}
                              value={sel.listed_price ?? item.selling_price}
                              onChange={e => setAddSelected(p => ({ ...p, [item.id]: { ...p[item.id], listed_price: e.target.value, selected: true } }))} />
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: mc.bg, color: mc.color }}>
                            {calc.marginPct !== null ? `${calc.marginPct}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Item */}
      <Modal show={!!editModal} onClose={() => setEditModal(null)} title="Edit Zomato Item" subtitle={editModal?.item_name}
        footer={<><button className="btn-c" onClick={() => setEditModal(null)}>Cancel</button><button className="btn-p" onClick={saveEdit}>Save</button></>}>
        {editModal && (() => {
          const cost = parseFloat(editModal.cost_price) || parseFloat(editModal.base_price) * 0.4;
          const calc = calcZomato({ listedPrice: editForm.listed_price, costPrice: cost, commission, discount });
          const mc = marginColor(calc.marginPct);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="mlabel">Name on Zomato</label>
                <input className="mfi" placeholder={editModal.item_name} value={editForm.zomato_item_name || ''}
                  onChange={e => setEditForm(f => ({ ...f, zomato_item_name: e.target.value }))} /></div>
              <div><label className="mlabel">Description on Zomato</label>
                <textarea className="mfi" rows={2} value={editForm.zomato_description || ''}
                  onChange={e => setEditForm(f => ({ ...f, zomato_description: e.target.value }))} style={{ resize: 'none' }} /></div>
              <div style={{ background: 'rgba(232,87,42,.04)', border: '1.5px solid rgba(232,87,42,.15)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10 }}>💰 Pricing</div>
                <div className="mgrid">
                  <div><label className="mlabel">Listed Price (₹)</label>
                    <input className="mfi" type="number" min="0" value={editForm.listed_price || ''}
                      onChange={e => setEditForm(f => ({ ...f, listed_price: e.target.value }))} /></div>
                  <div><label className="mlabel">Target Margin (%)</label>
                    <input className="mfi" type="number" min="0" max="99" value={editForm.target_margin || ''}
                      onChange={e => setEditForm(f => ({ ...f, target_margin: e.target.value }))} /></div>
                </div>
                {parseFloat(editForm.listed_price) > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {[
                      { l: 'Cust Pays', v: fmtCur(calc.customerPays) },
                      { l: 'You Receive', v: fmtCur(calc.youReceive) },
                      { l: 'Profit', v: fmtCur(calc.profit) },
                      { l: 'Margin', v: calc.marginPct !== null ? `${calc.marginPct}%` : '—' },
                    ].map(({ l, v }, i) => (
                      <div key={i} style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderRadius: 8, background: i === 3 ? mc.bg : 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 9, color: 'var(--ink2)', fontWeight: 600, marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: i === 3 ? mc.color : 'var(--ink)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mgrid">
                <div><label className="mlabel">Sort Order</label>
                  <input className="mfi" type="number" min="0" value={editForm.sort_order || 0}
                    onChange={e => setEditForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={!!editForm.is_available} onChange={e => setEditForm(f => ({ ...f, is_available: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  ✅ Available on Zomato
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={!!editForm.is_featured} onChange={e => setEditForm(f => ({ ...f, is_featured: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  ⭐ Featured Item
                </label>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Remove */}
      <ConfirmModal show={!!removeModal} onClose={() => setRemoveModal(null)} onConfirm={doRemove}
        title="Remove from Zomato Menu"
        message={`Remove "${removeModal?.zomato_item_name || removeModal?.item_name}" from Zomato? The item stays in your regular menu.`} />
    </div>
  );
}
