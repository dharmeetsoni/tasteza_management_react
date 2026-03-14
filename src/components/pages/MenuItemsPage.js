import React, { useState, useEffect } from 'react';
import { getMenuItemsAll, getCourses, getRecipes, createMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItem } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const EMPTY = { name: '', course_id: '', selling_price: '', price_with_gst: '', cost_price: '', gst_percent: '0', price_includes_gst: false, is_veg: false, spice_level: 0, recipe_id: '', description: '', discount_applicable: true, is_parcel_available: true, image_url: '' };

const SPICE_LEVELS = [
  { value: 0, label: 'No Spice',  icons: '—',    tip: 'Not spicy at all' },
  { value: 1, label: 'Medium',    icons: '🌶️',   tip: 'Mild to medium heat' },
  { value: 2, label: 'Hot',       icons: '🌶️🌶️', tip: 'Hot & spicy' },
];

const GST_PRESETS = [0, 5, 12, 18, 28];

function calcPrices(sellingPrice, gstPercent, priceIncludesGst) {
  const price = parseFloat(sellingPrice) || 0;
  const gst = parseFloat(gstPercent) || 0;
  if (price === 0 || gst === 0) return { base: price, withGst: price, gstAmt: 0 };
  if (priceIncludesGst) {
    // Price entered is inclusive of GST → extract base
    const base = price / (1 + gst / 100);
    return { base: +base.toFixed(2), withGst: price, gstAmt: +(price - base).toFixed(2) };
  } else {
    // Price entered is exclusive → add GST on top
    const withGst = price * (1 + gst / 100);
    return { base: price, withGst: +withGst.toFixed(2), gstAmt: +(withGst - price).toFixed(2) };
  }
}

export default function MenuItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [recipes,   setRecipes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [activeCourse, setActiveCourse] = useState('');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [delModal, setDelModal] = useState(null);
  const [recipeSearch, setRecipeSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [m, c, r] = await Promise.all([getMenuItemsAll(), getCourses(), getRecipes()]);
      if (m.success) setItems(m.data);
      if (c.success) setCourses(c.data);
      if (r.success)   setRecipes(r.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const openModal = (item = null) => {
    setEditing(item);
    setForm(item ? { name: item.name, course_id: item.course_id, selling_price: item.selling_price, price_with_gst: item.price_with_gst || '', cost_price: item.cost_price || '', gst_percent: item.gst_percent || '0', price_includes_gst: !!item.price_includes_gst, is_veg: !!item.is_veg, spice_level: item.spice_level ?? 0, recipe_id: item.recipe_id || '', description: item.description || '', discount_applicable: item.discount_applicable !== 0, is_parcel_available: item.is_parcel_available !== 0, image_url: item.image_url || '' } : EMPTY);
    setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.course_id || !form.selling_price) { toast('Name, course and selling price required.', 'er'); return; }
    try {
      const d = editing ? await updateMenuItem(editing.id, form) : await createMenuItem(form);
      if (d.success) { toast(editing ? 'Updated! ✅' : 'Item added! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteMenuItem(delModal.id);
      if (d.success) { toast('Deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  const toggle = async (item) => {
    try {
      await toggleMenuItem(item.id, item.is_active ? 0 : 1);
      toast(item.is_active ? 'Disabled.' : 'Enabled.', 'ok'); load();
    } catch { toast('Error', 'er'); }
  };

  const margin = (item) => {
    const sell = parseFloat(item.selling_price) || 0;
    const cost = parseFloat(item.cost_price) || 0;
    if (!cost || !sell) return null;
    return (((sell - cost) / sell) * 100).toFixed(1);
  };

  const filtered = items.filter(i => {
    if (activeCourse && i.course_id !== parseInt(activeCourse)) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (courseFilter && i.course_id !== parseInt(courseFilter)) return false;
    return true;
  });

  const totalActive = items.filter(i => i.is_active).length;
  const avgMargin = items.filter(i => i.cost_price && i.selling_price).reduce((s, i, _, arr) => {
    return s + (((parseFloat(i.selling_price) - parseFloat(i.cost_price)) / parseFloat(i.selling_price)) * 100) / arr.length;
  }, 0);

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Menu Items</div>
          <div className="ps">Final dishes — linked to recipes for auto cost &amp; margin tracking</div>
        </div>
        <button className="btn-p" onClick={() => openModal()}>+ Add Menu Item</button>
      </div>

      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>🍽️</div><div className="scard-text"><div className="sv">{items.length}</div><div className="sl">Total Items</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv">{totalActive}</div><div className="sl">Active</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>📈</div><div className="scard-text"><div className="sv">{avgMargin.toFixed(1)}%</div><div className="sl">Avg Margin</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">{activeCourse ? courses.find(c => c.id === parseInt(activeCourse))?.name || 'All' : 'All Menu Items'}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="vt-wrap">
              <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
              <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <select className="fsel" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="cat-tabs">
          <div className={`ctab ${activeCourse === '' ? 'active' : ''}`} onClick={() => setActiveCourse('')}>All</div>
          {courses.map(c => (
            <div key={c.id} className={`ctab ${activeCourse === String(c.id) ? 'active' : ''}`}
              style={activeCourse === String(c.id) ? { background: c.color, borderColor: c.color } : {}}
              onClick={() => setActiveCourse(String(c.id))}>
              {c.icon} {c.name}
            </div>
          ))}
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0
          ? <div className="empty"><div className="ei">🍽️</div><h4>No menu items</h4><p>Add your first dish</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Item</th><th>Course</th><th>Selling Price</th><th>Cost</th><th>Margin</th><th>GST</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(i => {
                    const m = margin(i);
                    return (
                      <tr key={i.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{i.is_veg ? '🟢' : '🔴'}</span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong>{i.name}</strong>
                                {i.spice_level > 0 && (
                                  <span title={SPICE_LEVELS[i.spice_level]?.tip} style={{ fontSize: 13, lineHeight: 1 }}>
                                    {SPICE_LEVELS[i.spice_level]?.icons}
                                  </span>
                                )}
                              </div>
                              {i.recipe_name && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>📋 Recipe: {i.recipe_name}</div>}
                              {i.recipe_name && <div style={{ fontSize: 11, color: '#1db97e', fontWeight:600 }}>📦 {i.recipe_name}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                            <span>{i.course_icon}</span>{i.course_name}
                          </span>
                        </td>
                        <td><strong>{fmtCur(i.selling_price)}</strong></td>
                        <td>{fmtCur(i.cost_price)}</td>
                        <td>{m ? <span style={{ color: parseFloat(m) > 50 ? 'var(--green)' : parseFloat(m) > 20 ? '#b07a00' : 'var(--red)', fontWeight: 700 }}>{m}%</span> : '—'}</td>
                        <td style={{ fontSize: 13 }}>{i.gst_percent > 0 ? `${i.gst_percent}%` : '—'}</td>
                        <td><span className={`badge ${i.is_active ? 'on' : 'off'}`}>{i.is_active ? '● Active' : '● Disabled'}</span></td>
                        <td><div className="tact">
                          <button className="bsm be" onClick={() => openModal(i)}>✏️</button>
                          <button className="bsm bt" onClick={() => toggle(i)} style={{background:i.is_active?'rgba(232,74,95,.1)':'rgba(29,185,126,.1)',color:i.is_active?'#e84a5f':'#1db97e',border:`1.5px solid ${i.is_active?'#e84a5f':'#1db97e'}`}}>{i.is_active ? '🚫 Disable' : '✅ Enable'}</button>
                          <button className="bsm bd" onClick={() => setDelModal(i)}>🗑️</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {filtered.map(i => {
                const m = margin(i);
                const course = courses.find(c => c.id === i.course_id);
                const marginColor = m ? (parseFloat(m) > 50 ? 'var(--green)' : parseFloat(m) > 20 ? '#b07a00' : 'var(--red)') : 'var(--ink2)';
                return (
                  <div key={i.id} className="inv-card" style={{ borderTop: '3px solid ' + (course?.color || 'var(--accent)') }}>
                    <div className="inv-card-top">
                      <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1.5px solid var(--border)', background: (course?.color || '#e8572a') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {i.image_url
                          ? <img src={i.image_url} alt={i.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 26 }}>🍽️</span>}
                      </div>
                      <div className="inv-card-info">
                        <h4>
                          <span style={{ marginRight: 5 }}>{i.is_veg ? '🟢' : '🔴'}</span>
                          {i.name}
                          {i.spice_level > 0 && (
                            <span title={SPICE_LEVELS[i.spice_level]?.tip}
                              style={{ marginLeft: 6, fontSize: 13 }}>
                              {SPICE_LEVELS[i.spice_level]?.icons}
                            </span>
                          )}
                        </h4>
                        <p>{i.course_icon} {i.course_name}</p>
                      </div>
                      <span className={`badge ${i.is_active ? 'on' : 'off'}`}>{i.is_active ? '✓' : '✕'}</span>
                    </div>
                    <div className="inv-card-body">
                      <div className="inv-kv">
                        <div className="k">Selling Price</div>
                        <div className="v" style={{ color: 'var(--accent)' }}>{fmtCur(i.selling_price)}</div>
                      </div>
                      <div className="inv-kv">
                        <div className="k">Cost Price</div>
                        <div className="v">{fmtCur(i.cost_price)}</div>
                      </div>
                      <div className="inv-kv">
                        <div className="k">Margin</div>
                        <div className="v" style={{ color: marginColor, fontWeight: 700 }}>{m ? m + '%' : '—'}</div>
                      </div>
                      <div className="inv-kv">
                        <div className="k">GST</div>
                        <div className="v">{i.gst_percent > 0 ? i.gst_percent + '%' : '—'}</div>
                      </div>
                    </div>
                    {i.recipe_name && <div style={{ fontSize: 11, color: 'var(--ink2)' }}>📋 {i.recipe_name}</div>}
                    <div className="inv-card-foot">
                      <button className="bsm be" onClick={() => openModal(i)}>✏️ Edit</button>
                      <button className="bsm" onClick={() => toggle(i)} style={{background:i.is_active?'rgba(232,74,95,.1)':'rgba(29,185,126,.1)',color:i.is_active?'#e84a5f':'#1db97e',border:`1.5px solid ${i.is_active?'#e84a5f':'#1db97e'}`}}>{i.is_active ? '🚫 Disable' : '✅ Enable'}</button>
                      <button className="bsm bd" onClick={() => setDelModal(i)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Menu Item' : 'Add Menu Item'}
        subtitle="Define a dish on your menu"
        wide
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save</button>
        </>}>
        <div className="mgrid">
          <div className="mfull">
            <label className="mlabel">Item Name *</label>
            <input className="mfi" placeholder="e.g. Paneer Butter Masala" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="mlabel">Course *</label>
            <select className="mfi" value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}>
              <option value="">Select…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mlabel">Link Recipe <span style={{fontSize:10,color:'var(--ink2)',fontWeight:400}}>(auto-deducts ingredients on sale)</span></label>
            {/* Search box */}
            <div style={{ position:'relative', marginBottom:6 }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'var(--ink2)', pointerEvents:'none' }}>🔍</span>
              <input
                className="mfi"
                style={{ paddingLeft:32 }}
                placeholder="Search recipes…"
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
              />
              {recipeSearch && (
                <button
                  type="button"
                  onClick={() => setRecipeSearch('')}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--ink2)', padding:0 }}>✕</button>
              )}
            </div>
            {/* Scrollable recipe list */}
            <div style={{ border:'1.5px solid var(--border)', borderRadius:10, overflow:'hidden', maxHeight:180, overflowY:'auto' }}>
              {/* None option */}
              <div
                onClick={() => setForm(f => ({ ...f, recipe_id: '', cost_price: '' }))}
                style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, fontWeight:500,
                  background: !form.recipe_id ? 'rgba(232,87,42,.1)' : 'transparent',
                  color: !form.recipe_id ? 'var(--accent)' : 'var(--ink2)',
                  borderBottom:'1px solid var(--border)' }}>
                — No recipe linked
              </div>
              {recipes
                .filter(r => r.name.toLowerCase().includes(recipeSearch.toLowerCase()))
                .map(r => (
                  <div
                    key={r.id}
                    onClick={() => { setForm(f => ({ ...f, recipe_id: String(r.id), cost_price: r.cost_per_unit ? String(parseFloat(r.cost_per_unit).toFixed(2)) : f.cost_price })); setRecipeSearch(''); }}
                    style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, fontWeight:500,
                      background: String(form.recipe_id) === String(r.id) ? 'rgba(29,185,126,.1)' : 'transparent',
                      color: String(form.recipe_id) === String(r.id) ? '#1db97e' : 'var(--ink)',
                      borderBottom:'1px solid var(--border)' }}>
                    {String(form.recipe_id) === String(r.id) ? '✅ ' : ''}{r.name}
                    {r.cost_per_unit ? <span style={{ fontSize:11, color:'var(--ink2)', marginLeft:8 }}>Cost: ₹{parseFloat(r.cost_per_unit).toFixed(2)}</span> : ''}
                  </div>
                ))
              }
              {recipes.filter(r => r.name.toLowerCase().includes(recipeSearch.toLowerCase())).length === 0 && (
                <div style={{ padding:'12px', fontSize:12, color:'var(--ink2)', textAlign:'center' }}>No recipes match "{recipeSearch}"</div>
              )}
            </div>
            {form.recipe_id && (
              <div style={{ fontSize:11, marginTop:6, color:'#1db97e', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
                ✅ Ingredients will auto-deduct from inventory when this item is sold
              </div>
            )}
            {!form.recipe_id && (
              <div style={{ fontSize:11, marginTop:6, color:'var(--ink2)' }}>
                Link a recipe to automatically deduct its ingredients from inventory on each sale
              </div>
            )}
          </div>
          <div></div>
          {/* ── Price & GST Section ── */}
          <div className="mfull">
            <div style={{ background: 'rgba(232,87,42,.04)', border: '1.5px solid rgba(232,87,42,.15)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>💰 Pricing & GST</div>

              {/* GST % with presets */}
              <div style={{ marginBottom: 14 }}>
                <label className="mlabel">GST Rate</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {GST_PRESETS.map(p => (
                    <button key={p} type="button"
                      style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', transition: 'all .13s',
                        background: String(form.gst_percent) === String(p) ? 'var(--accent)' : 'transparent',
                        color: String(form.gst_percent) === String(p) ? '#fff' : 'var(--ink2)',
                        borderColor: String(form.gst_percent) === String(p) ? 'var(--accent)' : 'var(--border)' }}
                      onClick={() => setForm(f => ({ ...f, gst_percent: String(p) }))}>
                      {p}%
                    </button>
                  ))}
                  <input type="number" min="0" max="100" placeholder="Custom"
                    style={{ width: 72, padding: '5px 10px', borderRadius: 20, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--ink)' }}
                    value={GST_PRESETS.includes(Number(form.gst_percent)) ? '' : form.gst_percent}
                    onChange={e => setForm(f => ({ ...f, gst_percent: e.target.value }))}
                    onFocus={e => { if (GST_PRESETS.includes(Number(form.gst_percent))) setForm(f => ({ ...f, gst_percent: '' })); }}
                  />
                </div>
              </div>

              {/* Toggle: price includes or excludes GST */}
              <div style={{ marginBottom: 14 }}>
                <label className="mlabel">Price Entry Mode</label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border)', width: 'fit-content' }}>
                  <button type="button"
                    style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all .13s',
                      background: !form.price_includes_gst ? 'var(--accent)' : 'transparent',
                      color: !form.price_includes_gst ? '#fff' : 'var(--ink2)' }}
                    onClick={() => setForm(f => ({ ...f, price_includes_gst: false }))}>
                    ➕ Excl. GST
                  </button>
                  <button type="button"
                    style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', borderLeft: '1.5px solid var(--border)', transition: 'all .13s',
                      background: form.price_includes_gst ? 'var(--accent)' : 'transparent',
                      color: form.price_includes_gst ? '#fff' : 'var(--ink2)' }}
                    onClick={() => setForm(f => ({ ...f, price_includes_gst: true }))}>
                    ✅ Incl. GST
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 6 }}>
                  {form.price_includes_gst
                    ? '✅ Price entered already includes GST — base price will be back-calculated'
                    : '➕ Price entered is base price — GST will be added on top'}
                </div>
              </div>

              {/* Price input + live breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="mlabel">{form.price_includes_gst ? 'Price (Incl. GST) *' : 'Selling Price (Excl. GST) *'}</label>
                  <input className="mfi" type="number" placeholder="₹0.00"
                    value={form.selling_price}
                    onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} />
                </div>
                <div>
                  <label className="mlabel">Cost Price</label>
                  <input className="mfi" type="number" placeholder="₹0.00 (auto from recipe)"
                    value={form.cost_price}
                    onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
                </div>
              </div>

              {/* Live calculation display */}
              {parseFloat(form.selling_price) > 0 && (
                (() => {
                  const calc = calcPrices(form.selling_price, form.gst_percent, form.price_includes_gst);
                  return (
                    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ flex: 1, textAlign: 'center', padding: '6px 10px', borderRight: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 600, marginBottom: 3 }}>BASE PRICE</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>₹{calc.base.toFixed(2)}</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '6px 10px', borderRight: '1px solid var(--border)', background: 'rgba(232,112,41,.04)' }}>
                        <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 600, marginBottom: 3 }}>GST ({form.gst_percent || 0}%)</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#b07a00' }}>+₹{calc.gstAmt.toFixed(2)}</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '6px 10px', background: 'rgba(29,185,126,.06)' }}>
                        <div style={{ fontSize: 10, color: 'var(--ink2)', fontWeight: 600, marginBottom: 3 }}>FINAL PRICE</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>₹{calc.withGst.toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
            <input type="checkbox" id="isVeg" checked={form.is_veg} onChange={e => setForm(f => ({ ...f, is_veg: e.target.checked }))} style={{ width: 18, height: 18 }} />
            <label htmlFor="isVeg" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🟢 Vegetarian</label>
          </div>

          {/* Spice level picker */}
          <div style={{ padding: '4px 12px 12px' }}>
            <label className="mlabel" style={{ marginBottom: 8, display: 'block' }}>🌶️ Spice Level</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SPICE_LEVELS.map(sl => {
                const active = form.spice_level === sl.value;
                return (
                  <button
                    key={sl.value}
                    type="button"
                    title={sl.tip}
                    onClick={() => setForm(f => ({ ...f, spice_level: sl.value }))}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${active ? (sl.value === 0 ? '#94a3b8' : sl.value === 1 ? '#f97316' : '#e84a5f') : 'var(--border)'}`,
                      background: active
                        ? sl.value === 0 ? 'rgba(148,163,184,.12)' : sl.value === 1 ? 'rgba(249,115,22,.1)' : 'rgba(232,74,95,.1)'
                        : 'var(--bg)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all .12s', fontFamily: 'inherit',
                    }}>
                    <span style={{ fontSize: sl.value === 0 ? 18 : 16, lineHeight: 1.2 }}>
                      {sl.value === 0 ? '🚫' : sl.icons}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: active
                        ? sl.value === 0 ? '#64748b' : sl.value === 1 ? '#f97316' : '#e84a5f'
                        : 'var(--ink2)',
                    }}>{sl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
            <input type="checkbox" id="discountApp" checked={!!form.discount_applicable} onChange={e => setForm(f => ({ ...f, discount_applicable: e.target.checked }))} style={{ width: 18, height: 18 }} />
            <label htmlFor="discountApp" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🏷️ Discount Applicable</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
            <input type="checkbox" id="isParcel" checked={!!form.is_parcel_available} onChange={e => setForm(f => ({ ...f, is_parcel_available: e.target.checked }))} style={{ width: 18, height: 18 }} />
            <label htmlFor="isParcel" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>📦 Available for Parcel</label>
          </div>
          <div className="mfull">
            <label className="mlabel">Description</label>
            <textarea className="mfi" rows={2} placeholder="Optional description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="mfull">
            <label className="mlabel">Item Image</label>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', border: '2px dashed var(--border)', flexShrink: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {form.image_url
                  ? <img src={form.image_url} alt="item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28 }}>🍽️</span>}
              </div>
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" id="mi-img-upload" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setForm(f => ({ ...f, image_url: ev.target.result }));
                    reader.readAsDataURL(file);
                  }} />
                <button type="button" className="bsm be" onClick={() => document.getElementById('mi-img-upload').click()}>📷 {form.image_url ? 'Change Image' : 'Add Image'}</button>
                {form.image_url && (
                  <button type="button" className="bsm bd" style={{ marginLeft: 8 }} onClick={() => setForm(f => ({ ...f, image_url: '' }))}>✕ Remove</button>
                )}
                <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 6 }}>JPG, PNG, WebP</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Item" message={`Delete "${delModal?.name}"?`} />
    </div>
  );
}
