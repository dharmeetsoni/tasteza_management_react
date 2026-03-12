import React, { useState, useEffect, useMemo } from 'react';
import { getRecipes, getInventory, getUnits, getCourses, getSalaries, getFuels,
  createRecipe, updateRecipe, deleteRecipe, getRecipeIngredients, getStaff } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const EMPTY_FORM = { name: '', description: '', is_master: false, yield_qty: 1, yield_unit_id: '', serves: 1, course_id: '', cook_minutes: 0, wastage_percent: 0, fuel_profile_id: '' };
const EMPTY_ING = { inventory_item_id: '', unit_id: '', quantity: '', price_per_unit: 0, line_cost: 0 };
const EMPTY_STAFF = { user_id: '', staff_count: 1, per_minute: 0, line_cost: 0 };

export default function RecipesPage() {
  const toast = useToast();
  const [recipes, setRecipes] = useState([]);
  const [invItems, setInvItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [courses, setCourses] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]); // actual users with monthly_salary
  const [fuels, setFuels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [ingSearches, setIngSearches] = useState({});
  const [typeFilter, setTypeFilter] = useState('');
  const [activeCourse, setActiveCourse] = useState('');
  const [view, setView] = useState('grid');

  // Modals
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [delModal, setDelModal] = useState(null);

  // Form
  const [form, setForm] = useState(EMPTY_FORM);
  const [ings, setIngs] = useState([{ ...EMPTY_ING }]);
  const [staffList, setStaffList] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, inv, u, c, s, f, st] = await Promise.all([
        getRecipes(), getInventory(), getUnits(), getCourses(), getSalaries(), getFuels(), getStaff()
      ]);
      if (r.success) setRecipes(r.data);
      if (inv.success) setInvItems(inv.data);
      if (u.success) setUnits(u.data);
      if (c.success) setCourses(c.data);
      if (s.success) setSalaries(s.data);
      if (f.success) setFuels(f.data);
      if (st.success) setStaffUsers(st.data.filter(u => parseFloat(u.monthly_salary) > 0));
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  // ─── Filtering ────────────────────────────────────────
  const filtered = useMemo(() => recipes.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter === 'master' && !r.is_master) return false;
    if (typeFilter === 'menu' && r.is_master) return false;
    if (activeCourse) {
      if (r.is_master) return false; // masters don't belong to a course
      if (r.course_id !== parseInt(activeCourse)) return false;
    }
    return true;
  }), [recipes, search, typeFilter, activeCourse]);

  // Counts per course for filter tabs
  const courseCounts = useMemo(() => {
    const counts = {};
    recipes.forEach(r => { if (!r.is_master && r.course_id) counts[r.course_id] = (counts[r.course_id] || 0) + 1; });
    return counts;
  }, [recipes]);

  // Count for type filter
  const masterCount = recipes.filter(r => r.is_master).length;
  const menuCount = recipes.filter(r => !r.is_master).length;

  // ─── Form helpers ─────────────────────────────────────
  // Canonical multipliers → base unit (grams for weight, ml for volume)
  // Covers all common spellings case-insensitively
  const UNIT_MULTIPLIERS = [
    // Weight (base = 1 gram)
    { m: 1000000, keys: ['tonne','ton','t']           },
    { m: 1000,    keys: ['kg','kgs','kilogram','kilograms','kilo'] },
    { m: 100,     keys: ['hg','hectogram']             },
    { m: 10,      keys: ['dag','decagram']             },
    { m: 1,       keys: ['g','gm','gr','gram','grams','grm'] },
    { m: 0.1,     keys: ['dg','decigram']              },
    { m: 0.01,    keys: ['cg','centigram']             },
    { m: 0.001,   keys: ['mg','milligram','milligrams'] },
    // Volume (base = 1 ml)
    { m: 1000,    keys: ['l','lt','ltr','litre','liter','liters','litres','lts'] },
    { m: 100,     keys: ['dl','decilitre']             },
    { m: 10,      keys: ['cl','centilitre']            },
    { m: 1,       keys: ['ml','millilitre','milliliter','mls'] },
    // Common cooking
    { m: 240,     keys: ['cup','cups']                 },
    { m: 15,      keys: ['tbsp','tablespoon','tablespoons'] },
    { m: 5,       keys: ['tsp','teaspoon','teaspoons'] },
    // Count — no cross-unit conversion possible
    { m: 1,       keys: ['pcs','pc','piece','pieces','nos','no','number','portion','portions','plate','plates','unit','units','serve','serves','each'] },
  ];

  // Get the base multiplier for a unit object (checks abbreviation + name, case-insensitive)
  const getUnitMult = (unit) => {
    if (!unit) return null;
    const check = (s) => (s||'').trim().toLowerCase();
    const abbr = check(unit.abbreviation);
    const name = check(unit.name);
    for (const entry of UNIT_MULTIPLIERS) {
      if (entry.keys.includes(abbr) || entry.keys.includes(name)) return entry.m;
    }
    // Fall back to DB conversion_factor if present
    const cf = parseFloat(unit.conversion_factor);
    return cf > 0 ? cf : null;
  };

  // Determine if two units are in the same family (both weight, both volume, both count)
  const sameFamily = (multA, multB) => {
    if (multA === null || multB === null) return false;
    // Weight: all have integer or sub-integer gram values, volume: ml-based
    // We can't distinguish families from multiplier alone, so just allow conversion always
    // (user is responsible for not mixing kg with litres)
    return true;
  };

  // Convert price from invUnit to recipeUnit
  // e.g. ₹200/kg, recipe uses g → 200 × (1/1000) = ₹0.20/g
  // e.g. ₹0.50/g,  recipe uses kg → 0.50 × (1000/1) = ₹500/kg
  const convertPrice = (pricePerInvUnit, invUnitId, recipeUnitId) => {
    if (!invUnitId || !recipeUnitId) return pricePerInvUnit;
    if (parseInt(invUnitId) === parseInt(recipeUnitId)) return pricePerInvUnit;
    const invUnit    = units.find(u => u.id === parseInt(invUnitId));
    const recipeUnit = units.find(u => u.id === parseInt(recipeUnitId));
    if (!invUnit || !recipeUnit) return pricePerInvUnit;
    const invM    = getUnitMult(invUnit);
    const recipeM = getUnitMult(recipeUnit);
    if (invM === null || recipeM === null) return pricePerInvUnit; // unknown unit, no conversion
    // price_per_recipe_unit = price_per_inv_unit × (recipeM / invM)
    return pricePerInvUnit * (recipeM / invM);
  };

  const updateIng = (idx, field, val) => {
    setIngs(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };

      if (field === 'inventory_item_id') {
        const item = invItems.find(i => i.id === parseInt(val));
        if (item) {
          // Store the raw inventory price and its unit as the base
          const basePrice  = parseFloat(item.purchase_price) || 0;
          const baseUnitId = item.unit_id;
          // The recipe unit defaults to the inventory unit — convert immediately
          // so if user doesn't touch unit dropdown, price is still correct
          const currentUnitId = next[idx].unit_id || baseUnitId;
          const converted = convertPrice(basePrice, parseInt(baseUnitId), parseInt(currentUnitId));
          next[idx].unit_id        = baseUnitId;      // reset to inventory's own unit
          next[idx].price_per_unit = basePrice;       // same unit → no conversion needed yet
          next[idx]._base_price    = basePrice;
          next[idx]._base_unit_id  = baseUnitId;
          next[idx]._ing_search    = '';
        }
      }

      if (field === 'unit_id') {
        // User changed the recipe unit — recalc price from base (inventory) price
        const basePrice  = parseFloat(next[idx]._base_price)   || 0;
        const baseUnitId = parseInt(next[idx]._base_unit_id)   || parseInt(next[idx].unit_id);
        // Convert: inventory base price → chosen recipe unit
        // e.g. inventory = ₹200/kg, user picks gram → ₹200 × (1g/1000g) = ₹0.20/g
        next[idx].price_per_unit = convertPrice(basePrice, baseUnitId, parseInt(val));
      }

      const q = parseFloat(field === 'quantity' ? val : next[idx].quantity) || 0;
      const p = parseFloat(field === 'price_per_unit' ? val : next[idx].price_per_unit) || 0;
      next[idx].line_cost = (q * p).toFixed(4);
      return next;
    });
  };

  // Compute per_minute from actual user config: salary ÷ (work_days × hours_per_day × 60min)
  const calcPerMinute = (user) => {
    if (!user) return 0;
    const salary   = parseFloat(user.monthly_salary)  || 0;
    const workDays = parseFloat(user.work_days_month)  || 26;
    const hoursDay = parseFloat(user.hours_per_day)    || 8;
    return salary / (workDays * hoursDay * 60);
  };

  const updateStaff = (idx, field, val) => {
    setStaffList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      // Recalc per_minute when user changes
      if (field === 'user_id') {
        const user = staffUsers.find(u => u.id === parseInt(val));
        next[idx].per_minute = calcPerMinute(user);
      }
      const perMin = parseFloat(next[idx].per_minute) || 0;
      const mins   = parseFloat(form.cook_minutes) || 0;
      const count  = parseFloat(field === 'staff_count' ? val : next[idx].staff_count) || 1;
      next[idx].line_cost = (perMin * mins * count).toFixed(4);
      return next;
    });
  };

  // Recalc staff costs when cook_minutes changes
  useEffect(() => {
    if (!staffList.length) return;
    setStaffList(prev => prev.map(s => {
      const perMin = parseFloat(s.per_minute) || 0;
      const mins   = parseFloat(form.cook_minutes) || 0;
      const count  = parseFloat(s.staff_count) || 1;
      return { ...s, line_cost: (perMin * mins * count).toFixed(4) };
    }));
  }, [form.cook_minutes]);

  const calcCosts = () => {
    // line_cost per ingredient = quantity (in recipe unit) × price_per_recipe_unit — already in ₹
    const ingCost     = ings.reduce((s, i) => s + (parseFloat(i.line_cost) || 0), 0);
    const wp          = parseFloat(form.wastage_percent) || 0;
    const wastageCost = ingCost * (wp / 100);
    const staffCost   = staffList.reduce((s, x) => s + (parseFloat(x.line_cost) || 0), 0);
    const fuelProfile = fuels.find(f => f.id === parseInt(form.fuel_profile_id));
    const fuelCost    = fuelProfile ? (parseFloat(fuelProfile.per_minute) * (parseFloat(form.cook_minutes) || 0)) : 0;
    const total       = ingCost + wastageCost + staffCost + fuelCost;

    // ── Yield ───────────────────────────────────────────────
    const yieldQty      = parseFloat(form.yield_qty) || 1;
    const yieldUnit     = units.find(u => u.id === parseInt(form.yield_unit_id));
    const yieldUnitAbbr = yieldUnit?.abbreviation || '';
    const yieldUnitName = yieldUnit?.name || '';

    // ── costPerUnit = total ÷ yield_qty (in yield unit) ─────
    // e.g. yield=2.5 kg  → costPerUnit = total/2.5  → ₹/kg
    // e.g. yield=2500 g  → costPerUnit = total/2500 → ₹/g
    // Both are the same physical cost — just expressed in different units.
    // We also compute the per-gram equivalent so users can cross-check.
    const serves       = parseFloat(form.serves) || 1;
    const costPerUnit  = form.is_master ? (total / yieldQty) : (total / serves);

    // ── Convert costPerUnit to alternate small unit for display ─
    // e.g. if yield=kg, also show ₹/g  |  if yield=g, also show ₹/kg
    let altCostLabel = null;
    let altCostValue = null;
    if (form.is_master && yieldUnit) {
      const yieldMult = getUnitMult(yieldUnit);  // e.g. kg→1000, g→1
      if (yieldMult !== null && yieldMult >= 1000) {
        // yield in large unit (kg, l) → show per small unit (g, ml)
        const smallMult = 1; // g=1, ml=1
        altCostValue = costPerUnit * (smallMult / yieldMult); // ₹/kg → ₹/g = costPerKg/1000
        // find small unit name
        altCostLabel = yieldUnitAbbr.toLowerCase().startsWith('k') ? 'g'
                     : yieldUnitAbbr.toLowerCase() === 'l' ? 'ml' : null;
      } else if (yieldMult !== null && yieldMult < 1) {
        // yield in very small unit (mg) → show per gram
        altCostValue = costPerUnit * (1 / yieldMult);
        altCostLabel = 'g';
      } else if (yieldMult !== null && yieldMult === 1) {
        // yield in base unit (g/ml) → also show per kg/l
        altCostValue = costPerUnit * 1000;
        altCostLabel = yieldUnitAbbr === 'ml' ? 'l' : 'kg';
      }
    }

    const yieldUnitLabel = yieldUnitAbbr || (form.is_master ? 'unit' : 'serve');

    return { ingCost, wastageCost, staffCost, fuelCost, total, costPerUnit, yieldQty, yieldUnitAbbr, yieldUnitName, yieldUnitLabel, serves, altCostValue, altCostLabel };
  };

  const costs = modal ? calcCosts() : {};

  // ─── Open modals ──────────────────────────────────────
  const openModal = async (recipe = null) => {
    setEditing(recipe);
    if (recipe) {
      setForm({ name: recipe.name, description: recipe.description || '', is_master: !!recipe.is_master, yield_qty: recipe.yield_qty || 1, yield_unit_id: recipe.yield_unit_id || '', serves: recipe.serves || 1, course_id: recipe.course_id || '', cook_minutes: recipe.cook_minutes || 0, wastage_percent: recipe.wastage_percent || 0, fuel_profile_id: recipe.fuel_profile_id || '' });
      try {
        const d = await getRecipeIngredients(recipe.id);
        setIngs(d.data?.length ? d.data.map(i => {
            // Always use CURRENT inventory purchase_price — not the stale saved value
            const invItem    = invItems.find(x => x.id === parseInt(i.inventory_item_id));
            const basePrice  = parseFloat(invItem?.purchase_price ?? i.price_per_unit ?? 0);
            const baseUnitId = invItem?.unit_id ?? i.unit_id;
            // Re-run conversion: recipe may use a different unit than inventory base unit
            const recipeUnitId = i.unit_id || baseUnitId;
            // Use the shared convertPrice which handles all unit spellings
            const livePrice = convertPrice(basePrice, parseInt(baseUnitId), parseInt(recipeUnitId));
            const qty = parseFloat(i.quantity) || 0;
            return {
              inventory_item_id: i.inventory_item_id,
              unit_id:           i.unit_id || '',
              quantity:          i.quantity,
              price_per_unit:    livePrice,
              line_cost:         (qty * livePrice).toFixed(4),
              _base_price:       basePrice,
              _base_unit_id:     baseUnitId,
            };
          }) : [{ ...EMPTY_ING }]);
        setStaffList(d.staff?.length ? d.staff.map(s => {
            // Support both old salary_id records and new user_id records
            const userId  = s.user_id || null;
            const user    = staffUsers.find(u => u.id === parseInt(userId));
            const perMin  = user ? calcPerMinute(user) : parseFloat(s.per_minute || 0);
            const mins    = parseFloat(recipe.cook_minutes) || 0;
            const count   = parseFloat(s.staff_count) || 1;
            return {
              user_id:     userId,
              salary_id:   s.salary_id || null,  // keep for backward compat display
              staff_count: count,
              per_minute:  perMin,
              line_cost:   (perMin * mins * count).toFixed(4),
            };
          }) : []);
      } catch { setIngs([{ ...EMPTY_ING }]); setStaffList([]); }
    } else {
      setForm({ ...EMPTY_FORM });
      setIngs([{ ...EMPTY_ING }]);
      setStaffList([]);
    }
    setModal(true);
  };

  const openView = async (r) => {
    setViewModal(r);
    setViewData(null);
    setViewLoading(true);
    try {
      const d = await getRecipeIngredients(r.id);
      setViewData(d);
    } catch { setViewData({ data: [], staff: [] }); }
    finally { setViewLoading(false); }
  };

  // ─── Save ─────────────────────────────────────────────
  const save = async () => {
    if (!form.name) { toast('Recipe name required.', 'er'); return; }
    if (ings.some(i => !i.inventory_item_id || !i.quantity)) { toast('Fill all ingredient fields.', 'er'); return; }
    const c = calcCosts();
    const payload = { ...form, ingredients: ings, staff_list: staffList, ingredient_cost: c.ingCost, wastage_cost: c.wastageCost, salary_total_cost: c.staffCost, fuel_cost: c.fuelCost, total_cost: c.total, cost_per_unit: c.costPerUnit };
    try {
      const d = editing ? await updateRecipe(editing.id, payload) : await createRecipe(payload);
      if (d.success) { toast(editing ? 'Recipe updated! ✅' : 'Recipe created! ✅', 'ok'); setModal(false); load(); }
      else toast(d.message || 'Error', 'er');
    } catch (err) { toast(err?.response?.data?.message || 'Error', 'er'); }
  };

  const del = async () => {
    try {
      const d = await deleteRecipe(delModal.id);
      if (d.success) { toast('Recipe deleted.', 'ok'); setDelModal(null); load(); }
      else toast(d.message || 'Error', 'er');
    } catch { toast('Error', 'er'); }
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">Recipes</div>
          <div className="ps">Build recipes from inventory — linked to fuel, salary and menu items</div>
        </div>
        <button className="btn-p" onClick={() => openModal()}>+ Create Recipe</button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="scard"><div style={{ fontSize: 20 }}>📋</div><div className="scard-text"><div className="sv">{recipes.length}</div><div className="sl">Total</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>⭐</div><div className="scard-text"><div className="sv">{masterCount}</div><div className="sl">Masters</div></div></div>
        <div className="scard"><div style={{ fontSize: 20 }}>🍽️</div><div className="scard-text"><div className="sv">{menuCount}</div><div className="sl">Menu Recipes</div></div></div>
        <div className="scard accent-card"><div style={{ fontSize: 20 }}>✅</div><div className="scard-text"><div className="sv">{recipes.filter(r => r.is_active).length}</div><div className="sl">Active</div></div></div>
      </div>

      {/* List card */}
      <div className="card">
        {/* Header */}
        <div className="ch">
          <div className="ct">All Recipes</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="vt-wrap">
              <button className={"vt-btn" + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰ Table</button>
              <button className={"vt-btn" + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞ Grid</button>
            </div>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
        </div>

        {/* Filter tabs: All · Master · Menu · per course */}
        <div className="cat-tabs">
          <div className={"ctab" + (typeFilter === '' && activeCourse === '' ? ' active' : '')}
            onClick={() => { setTypeFilter(''); setActiveCourse(''); }}>
            All <span className="ctab-count">{recipes.length}</span>
          </div>
          <div className={"ctab ctab-gold" + (typeFilter === 'master' ? ' active' : '')}
            onClick={() => { setTypeFilter('master'); setActiveCourse(''); }}>
            ⭐ Masters <span className="ctab-count">{masterCount}</span>
          </div>
          <div className={"ctab" + (typeFilter === 'menu' && activeCourse === '' ? ' active' : '')}
            onClick={() => { setTypeFilter('menu'); setActiveCourse(''); }}>
            🍽️ Menu <span className="ctab-count">{menuCount}</span>
          </div>
          {courses.map(c => (
            <div key={c.id}
              className={"ctab" + (activeCourse === String(c.id) ? ' active' : '')}
              style={activeCourse === String(c.id) ? { background: c.color, borderColor: c.color } : {}}
              onClick={() => { setActiveCourse(String(c.id)); setTypeFilter(''); }}>
              {c.icon} {c.name} <span className="ctab-count">{courseCounts[c.id] || 0}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        {loading ? <div className="loading-wrap">Loading…</div> : filtered.length === 0
          ? <div className="empty"><div className="ei">📋</div><h4>No recipes match this filter</h4><p>Try a different filter or create a recipe</p></div>
          : view === 'table' ? (
            <div className="overflow-x">
              <table>
                <thead><tr><th>Recipe</th><th>Type</th><th>Yield / Serves</th><th>Cost / Unit</th><th>Ingredients</th><th>Staff</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        {r.course_name && <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{r.course_icon} {r.course_name}</div>}
                        {r.description && <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 2 }}>{r.description}</div>}
                      </td>
                      <td><span className={"badge " + (r.is_master ? 'admin' : 'on')}>{r.is_master ? '⭐ Master' : '🍽️ Menu'}</span></td>
                      <td style={{ fontSize: 13 }}>
                        {r.is_master ? <>{r.yield_qty} {r.yield_unit_abbr}</> : <>{r.serves || 1} serves</>}
                      </td>
                      <td><strong style={{ color: 'var(--accent)' }}>{fmtCur(r.cost_per_unit)}</strong></td>
                      <td style={{ fontSize: 13 }}>{r.ingredient_count || 0} items</td>
                      <td style={{ fontSize: 13 }}>{r.staff_count || 0} roles</td>
                      <td><span className={"badge " + (r.is_active ? 'on' : 'off')}>{r.is_active ? '● Active' : '● Off'}</span></td>
                      <td><div className="tact">
                        <button className="bsm be" onClick={() => openModal(r)}>✏️</button>
                        <button className="bsm bo" onClick={() => openView(r)}>👁️</button>
                        <button className="bsm bd" onClick={() => setDelModal(r)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inv-grid" style={{ padding: 20 }}>
              {filtered.map(r => {
                const course = courses.find(c => c.id === r.course_id);
                const accentColor = r.is_master ? '#f4a535' : (course?.color || 'var(--accent)');
                return (
                  <div key={r.id} className="inv-card recipe-card" style={{ '--rc': accentColor }}>
                    <div className="rc-header" style={{ background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}06 100%)`, borderBottom: `1.5px solid ${accentColor}30` }}>
                      <div className="rc-icon" style={{ background: accentColor + '22', color: accentColor }}>
                        {r.is_master ? '⭐' : (r.course_icon || '🍽️')}
                      </div>
                      <div className="rc-title">
                        <h4>{r.name}</h4>
                        <p>{r.is_master ? 'Recipe Master' : (r.course_icon + ' ' + (r.course_name || 'Menu Recipe'))}</p>
                      </div>
                      <span className={"badge " + (r.is_active ? 'on' : 'off')}>{r.is_active ? '✓' : '✕'}</span>
                    </div>
                    <div className="rc-body">
                      <div className="rc-stat" style={{ '--sc': accentColor }}>
                        <div className="rc-stat-val">{fmtCur(r.cost_per_unit)}</div>
                        <div className="rc-stat-label">Cost / {r.is_master ? 'Unit' : 'Serve'}</div>
                      </div>
                      <div className="rc-stat">
                        <div className="rc-stat-val">{r.ingredient_count || 0}</div>
                        <div className="rc-stat-label">Ingredients</div>
                      </div>
                      <div className="rc-stat">
                        <div className="rc-stat-val">{r.cook_minutes || 0}<span style={{ fontSize: 12 }}>m</span></div>
                        <div className="rc-stat-label">Cook Time</div>
                      </div>
                      <div className="rc-stat">
                        <div className="rc-stat-val">{r.is_master ? r.yield_qty : (r.serves || 1)}</div>
                        <div className="rc-stat-label">{r.is_master ? (r.yield_unit_abbr || 'units') : 'Serves'}</div>
                      </div>
                    </div>
                    {r.description && <div style={{ fontSize: 12, color: 'var(--ink2)', padding: '0 2px', marginTop: -4 }}>{r.description}</div>}
                    <div className="inv-card-foot">
                      <button className="bsm be" onClick={() => openModal(r)}>✏️ Edit</button>
                      <button className="bsm bo" onClick={() => openView(r)}>👁️ Details</button>
                      <button className="bsm bd" onClick={() => setDelModal(r)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* ─── CREATE / EDIT MODAL ─────────────────────────── */}
      <Modal show={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Recipe' : 'Create Recipe'}
        subtitle="Build a recipe with ingredients, staff and fuel"
        wide
        footer={<>
          <button className="btn-c" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-p" onClick={save}>Save Recipe</button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Basic info */}
          <div className="recipe-section">
            <div className="recipe-section-title">📝 Basic Info</div>
            <div className="mgrid">
              <div className="mfull">
                <label className="mlabel">Recipe Name *</label>
                <input className="mfi" placeholder="e.g. Butter Chicken Base" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="mfull">
                <label className="mlabel">Description</label>
                <input className="mfi" placeholder="Optional description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="mfull">
                <label className="mlabel">Recipe Type</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className={"topt" + (!form.is_master ? ' sel' : '')} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, is_master: false }))}>
                    <div className="tname">🍽️ Menu Recipe</div>
                    <div className="texm">Linked to a menu item</div>
                  </button>
                  <button type="button" className={"topt" + (form.is_master ? ' sel' : '')} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, is_master: true }))}>
                    <div className="tname">⭐ Recipe Master</div>
                    <div className="texm">Usable as an ingredient</div>
                  </button>
                </div>
              </div>
              {form.is_master ? (
                <>
                  <div>
                    <label className="mlabel">Yield Quantity</label>
                    <input className="mfi" type="number" placeholder="1" value={form.yield_qty} onChange={e => setForm(f => ({ ...f, yield_qty: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mlabel">Yield Unit *</label>
                    <select className="mfi" value={form.yield_unit_id} onChange={e => setForm(f => ({ ...f, yield_unit_id: e.target.value }))}>
                      <option value="">Select unit…</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mlabel">Serves (portions)</label>
                    <input className="mfi" type="number" placeholder="1" value={form.serves} onChange={e => setForm(f => ({ ...f, serves: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mlabel">Course</label>
                    <select className="mfi" value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}>
                      <option value="">Select course…</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          <hr className="mdiv" />

          {/* Fuel & Wastage */}
          <div className="recipe-section">
            <div className="recipe-section-title">🔥 Fuel & Wastage</div>
            <div className="mgrid">
              <div>
                <label className="mlabel">Cook Time (minutes)</label>
                <input className="mfi" type="number" placeholder="0" value={form.cook_minutes} onChange={e => setForm(f => ({ ...f, cook_minutes: e.target.value }))} />
              </div>
              <div>
                <label className="mlabel">Wastage %</label>
                <input className="mfi" type="number" placeholder="0" value={form.wastage_percent} onChange={e => setForm(f => ({ ...f, wastage_percent: e.target.value }))} />
              </div>
              <div className="mfull">
                <label className="mlabel">Fuel Profile</label>
                <select className="mfi" value={form.fuel_profile_id} onChange={e => setForm(f => ({ ...f, fuel_profile_id: e.target.value }))}>
                  <option value="">No fuel / not applicable</option>
                  {fuels.map(f => <option key={f.id} value={f.id}>{f.icon} {f.fuel_name} — ₹{parseFloat(f.per_minute).toFixed(4)}/min</option>)}
                </select>
                {form.fuel_profile_id && form.cook_minutes > 0 && (
                  <div className="field-hint">⛽ Fuel cost: {fmtCur(costs.fuelCost)} ({form.cook_minutes} min)</div>
                )}
              </div>
            </div>
          </div>

          <hr className="mdiv" />

          {/* Ingredients */}
          <div className="recipe-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="recipe-section-title" style={{ marginBottom: 0 }}>🧺 Ingredients *</div>
              <button type="button" className="btn-add-row"
                onClick={() => setIngs(p => [...p, { ...EMPTY_ING }])}>
                + Add Ingredient
              </button>
            </div>
            {/* ── Column headers ── */}
            <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 80px 90px 130px 80px 32px', gap:6, padding:'6px 4px', fontSize:11, fontWeight:700, color:'var(--ink2)', borderBottom:'1.5px solid var(--border)', marginBottom:4 }}>
              <div>#</div><div>Ingredient</div><div>Qty</div><div>Unit</div><div>₹ / Unit</div><div style={{textAlign:'right'}}>Cost</div><div/>
            </div>

            {ings.map((ing, idx) => {
              const ingSearch    = ingSearches[idx] ?? '';
              const isSearchOpen = ingSearches[idx] !== undefined;
              const selectedItem = invItems.find(i => i.id === parseInt(ing.inventory_item_id));
              const filteredItems = ingSearch.trim()
                ? invItems.filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase()))
                : invItems;

              const invUnit    = units.find(u => u.id === parseInt(ing._base_unit_id));
              const recipeUnit = units.find(u => u.id === parseInt(ing.unit_id));
              const isConverted = ing._base_unit_id && ing.unit_id && ing._base_unit_id !== parseInt(ing.unit_id);
              const rawPrice   = parseFloat(ing._base_price || ing.price_per_unit || 0);
              const convPrice  = parseFloat(ing.price_per_unit || 0);
              const fmtPrice   = (n) => n ? parseFloat(n.toFixed(4)).toString() : '0';

              return (
                <div key={idx} style={{ marginBottom: isSearchOpen ? 0 : 2 }}>
                  {/* ── Single row ── */}
                  <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 80px 90px 130px 80px 32px', gap:6, alignItems:'center', padding:'6px 4px', background: idx%2===0 ? 'var(--bg)' : 'var(--surface)', borderRadius:8 }}>

                    {/* # */}
                    <div style={{ fontWeight:700, color:'var(--ink2)', fontSize:12, textAlign:'center' }}>{idx+1}</div>

                    {/* Ingredient search input */}
                    <div>
                      <input
                        className="mfi"
                        placeholder="🔍 Search…"
                        value={isSearchOpen ? ingSearch : (selectedItem?.name || '')}
                        onChange={e => {
                          setIngSearches(prev => ({ ...prev, [idx]: e.target.value }));
                          if (!e.target.value) updateIng(idx, 'inventory_item_id', '');
                        }}
                        onFocus={() => setIngSearches(prev => ({ ...prev, [idx]: selectedItem?.name || '' }))}
                        style={{ margin:0, fontSize:13, fontWeight: selectedItem ? 600 : 400,
                          borderColor: isSearchOpen ? 'var(--accent)' : selectedItem ? 'var(--green)' : 'var(--border)' }}
                      />
                    </div>

                    {/* Qty */}
                    <input className="mfi" type="number" placeholder="Qty"
                      value={ing.quantity}
                      onChange={e => updateIng(idx, 'quantity', e.target.value)}
                      style={{ margin:0, fontSize:13, textAlign:'right' }} />

                    {/* Unit */}
                    <select className="mfi"
                      value={ing.unit_id} onChange={e => updateIng(idx, 'unit_id', e.target.value)}
                      style={{ margin:0, fontSize:13 }}>
                      <option value="">Unit</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                    </select>

                    {/* Price display — read-only, shows inventory rate + converted rate */}
                    <div style={{ display:'flex', flexDirection:'column', gap:2, textAlign:'right' }}>
                      {selectedItem ? (
                        <>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--ink)' }}>
                            ₹{rawPrice.toFixed(2)}<span style={{ fontSize:10, color:'var(--ink2)', fontWeight:400 }}>/{invUnit?.abbreviation || recipeUnit?.abbreviation}</span>
                          </div>
                          {isConverted && (
                            <div style={{ fontSize:10, color:'#118ab2', fontWeight:600, whiteSpace:'nowrap' }}>
                              = ₹{fmtPrice(convPrice)}/{recipeUnit?.abbreviation}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize:12, color:'var(--ink2)' }}>—</div>
                      )}
                    </div>

                    {/* Line cost */}
                    <div style={{ fontWeight:800, fontSize:13, color:'var(--accent)', textAlign:'right' }}>
                      {fmtCur(ing.line_cost)}
                    </div>

                    {/* Remove */}
                    <button type="button"
                      onClick={() => {
                        setIngSearches(prev => { const n={...prev}; delete n[idx]; return n; });
                        ings.length === 1 ? setIngs([{...EMPTY_ING}]) : setIngs(p => p.filter((_,i) => i!==idx));
                      }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink2)', fontSize:16, padding:0, lineHeight:1 }}>✕</button>
                  </div>

                  {/* ── Inline search results panel (expands below the row) ── */}
                  {isSearchOpen && (
                    <div style={{
                      margin:'2px 34px 8px 34px',
                      border:'1.5px solid var(--accent)',
                      borderRadius:10, background:'var(--surface)',
                      boxShadow:'0 6px 24px rgba(0,0,0,.12)',
                      overflow:'hidden'
                    }}>
                      {/* search hint */}
                      <div style={{ padding:'8px 14px 6px', fontSize:11, color:'var(--ink2)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
                        <span>{filteredItems.length} item{filteredItems.length!==1?'s':''} {ingSearch ? `matching "${ingSearch}"` : '— type to filter'}</span>
                        <span style={{ cursor:'pointer', fontWeight:700 }} onClick={() => setIngSearches(prev=>{const n={...prev};delete n[idx];return n;})}>✕ close</span>
                      </div>
                      {/* results grid */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:0, maxHeight:240, overflowY:'auto' }}>
                        {filteredItems.length === 0
                          ? <div style={{ padding:'16px', color:'var(--ink2)', fontSize:13 }}>No items found</div>
                          : filteredItems.map(item => {
                              const isSel = parseInt(ing.inventory_item_id) === item.id;
                              return (
                                <div key={item.id}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    updateIng(idx, 'inventory_item_id', String(item.id));
                                    setIngSearches(prev => { const n={...prev}; delete n[idx]; return n; });
                                  }}
                                  style={{
                                    padding:'10px 14px', cursor:'pointer',
                                    borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)',
                                    background: isSel ? 'rgba(232,87,42,.08)' : 'transparent',
                                    transition:'background .1s'
                                  }}>
                                  <div style={{ fontWeight:700, fontSize:13, color: isSel ? 'var(--accent)' : 'var(--ink)' }}>{item.name}</div>
                                  <div style={{ fontSize:11, color:'var(--ink2)', marginTop:2 }}>{item.category_name}</div>
                                  <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginTop:3 }}>
                                    ₹{parseFloat(item.purchase_price||0).toFixed(2)}/{item.unit_abbr}
                                    <span style={{ fontWeight:400, color:'var(--ink2)', marginLeft:6 }}>stock: {parseFloat(item.current_quantity||0).toFixed(1)}</span>
                                  </div>
                                </div>
                              );
                            })
                        }
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {ings.length > 1 && (
              <div style={{ padding:'8px 4px', display:'flex', justifyContent:'flex-end' }}>
                <button type="button" className="ri-clear-all" onClick={() => setIngs([{...EMPTY_ING}])}>
                  🗑️ Clear all
                </button>
              </div>
            )}
          </div>

          <hr className="mdiv" />

          {/* Staff */}
          <div className="recipe-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="recipe-section-title" style={{ marginBottom: 0 }}>👥 Staff Cost</div>
              <button type="button" className="btn-add-row"
                onClick={() => setStaffList(p => [...p, { ...EMPTY_STAFF }])}>
                + Add Staff
              </button>
            </div>

            {/* Formula reminder */}
            <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 8, padding: '4px 8px', background: 'var(--bg)', borderRadius: 6 }}>
              💡 Cost = (Monthly Salary ÷ Work Days ÷ Hours/Day ÷ 60min) × Cook Minutes × Staff Count
            </div>

            {staffUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 14, color: 'var(--ink2)', fontSize: 13, background: 'var(--bg)', borderRadius: 10, border: '1.5px dashed var(--border)' }}>
                No staff with salary found — add staff in <strong>Staff Management</strong> first
              </div>
            ) : staffList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 14, color: 'var(--ink2)', fontSize: 13, background: 'var(--bg)', borderRadius: 10, border: '1.5px dashed var(--border)' }}>
                No staff assigned — click <strong>+ Add Staff</strong> to include salary cost
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 90px 32px', gap: 6, padding: '4px 6px', fontSize: 11, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  <div>Staff Member</div>
                  <div style={{ textAlign:'center' }}>Count</div>
                  <div style={{ textAlign:'right' }}>Salary/mo</div>
                  <div style={{ textAlign:'right' }}>₹/min</div>
                  <div style={{ textAlign:'right' }}>Cost</div>
                  <div></div>
                </div>
                {staffList.map((s, idx) => {
                  const user   = staffUsers.find(u => u.id === parseInt(s.user_id));
                  const perMin = parseFloat(s.per_minute) || 0;
                  const mins   = parseFloat(form.cook_minutes) || 0;
                  const workDays = user ? (parseFloat(user.work_days_month) || 26) : 26;
                  return (
                    <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 90px 90px 32px', gap:6, alignItems:'center', padding:'6px 6px', background: idx%2===0?'var(--bg)':'var(--surface)', borderRadius:8 }}>
                      {/* Staff picker */}
                      <div>
                        <select className="mfi" style={{ margin:0, fontSize:13 }}
                          value={s.user_id || ''} onChange={e => updateStaff(idx, 'user_id', e.target.value)}>
                          <option value="">— Select staff —</option>
                          {staffUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name} {u.designation ? `(${u.designation})` : `[${u.role}]`}
                            </option>
                          ))}
                        </select>
                        {user && (
                          <div style={{ fontSize:10, color:'var(--ink2)', paddingTop:2, paddingLeft:2 }}>
                            {workDays}d/mo · {user.hours_per_day||8}h/d · ₹{parseFloat(calcPerMinute(user)).toFixed(5)}/min
                          </div>
                        )}
                      </div>
                      {/* Count */}
                      <input className="mfi" type="number" min="1" placeholder="1"
                        value={s.staff_count}
                        onChange={e => updateStaff(idx, 'staff_count', e.target.value)}
                        style={{ margin:0, width:'100%', textAlign:'center' }} />
                      {/* Monthly salary */}
                      <div style={{ textAlign:'right', fontSize:12, fontWeight:600, color:'var(--ink)' }}>
                        {user ? fmtCur(user.monthly_salary) : '—'}
                      </div>
                      {/* ₹/min */}
                      <div style={{ textAlign:'right', fontSize:11, fontFamily:'monospace', color: perMin > 0 ? 'var(--accent)' : 'var(--ink2)' }}>
                        {perMin > 0 ? `₹${perMin.toFixed(5)}` : '—'}
                      </div>
                      {/* Line cost */}
                      <div style={{ textAlign:'right', fontWeight:800, fontSize:13, color: parseFloat(s.line_cost) > 0 ? 'var(--accent)' : 'var(--ink2)' }}>
                        {fmtCur(s.line_cost)}
                      </div>
                      <button className="ri-del" onClick={() => setStaffList(p => p.filter((_, i) => i !== idx))}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cook time warning */}
            {staffList.length > 0 && form.cook_minutes == 0 && (
              <div className="field-hint" style={{ marginTop:8, color: '#b07a00', background: 'rgba(244,165,53,.08)', borderColor: 'rgba(244,165,53,.3)' }}>
                ⚠️ Set cook time (minutes) above to calculate staff costs
              </div>
            )}

            {/* Per-staff breakdown when cook_minutes set */}
            {staffList.length > 0 && form.cook_minutes > 0 && (
              <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(29,185,126,.06)', borderRadius:8, fontSize:12, color:'var(--ink2)' }}>
                {staffList.filter(s => parseFloat(s.per_minute) > 0).map((s, idx) => {
                  const user  = staffUsers.find(u => u.id === parseInt(s.user_id));
                  const perMin = parseFloat(s.per_minute);
                  const count  = parseFloat(s.staff_count) || 1;
                  const mins   = parseFloat(form.cook_minutes);
                  return user ? (
                    <div key={idx} style={{ marginBottom:2 }}>
                      <span style={{ fontWeight:600, color:'var(--ink)' }}>{user.name}</span>
                      <span style={{ margin:'0 4px' }}>×{count}</span>
                      <span>: ₹{perMin.toFixed(5)}/min × {mins}min = </span>
                      <span style={{ fontWeight:700, color:'var(--green)' }}>{fmtCur(perMin * mins * count)}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <hr className="mdiv" />

          {/* Cost summary */}
          <div className="cost-summary">
            <div className="cs-title">💰 Cost Breakdown</div>
            <div className="cs-rows">
              <div className="cs-row"><span>Ingredients</span><strong>{fmtCur(costs.ingCost)}</strong></div>
              <div className="cs-row"><span>Wastage ({form.wastage_percent || 0}%)</span><strong>{fmtCur(costs.wastageCost)}</strong></div>
              <div className="cs-row"><span>Fuel {form.fuel_profile_id && form.cook_minutes > 0 ? `(${form.cook_minutes}min)` : ''}</span><strong>{fmtCur(costs.fuelCost)}</strong></div>
              <div className="cs-row"><span>Staff ({staffList.length} role{staffList.length !== 1 ? 's' : ''})</span><strong>{fmtCur(costs.staffCost)}</strong></div>
              <div className="cs-row cs-total"><span>Total Cost</span><strong>{fmtCur(costs.total)}</strong></div>

              {/* Yield ÷ breakdown */}
              <div style={{ margin:'8px 0 4px', padding:'8px 12px', background:'rgba(232,87,42,.06)', borderRadius:8, fontSize:13, color:'var(--ink2)' }}>
                {form.is_master ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {/* Primary: total ÷ yield */}
                    <div>
                      <span style={{ fontWeight:700, color:'var(--ink)' }}>{fmtCur(costs.total)}</span>
                      <span> ÷ </span>
                      <span style={{ fontWeight:700, color:'var(--ink)' }}>{costs.yieldQty} {costs.yieldUnitAbbr}</span>
                      <span> = </span>
                      <span style={{ fontWeight:800, color:'var(--accent)' }}>{fmtCur(costs.costPerUnit)} / {costs.yieldUnitLabel}</span>
                    </div>
                    {/* Alternate unit conversion */}
                    {costs.altCostLabel && (
                      <div style={{ color:'#5a7ef5', fontSize:12, paddingLeft:4 }}>
                        ≡ <span style={{ fontWeight:700 }}>{fmtCur(costs.altCostValue)}</span>
                        <span> / {costs.altCostLabel}</span>
                        <span style={{ opacity:.6, marginLeft:4 }}>
                          ({costs.yieldUnitAbbr} → {costs.altCostLabel} conversion)
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <span style={{ fontWeight:700, color:'var(--ink)' }}>{fmtCur(costs.total)}</span>
                    <span> ÷ </span>
                    <span style={{ fontWeight:700, color:'var(--ink)' }}>{costs.serves} serve{costs.serves !== 1 ? 's' : ''}</span>
                    <span> = </span>
                    <span style={{ fontWeight:800, color:'var(--accent)' }}>{fmtCur(costs.costPerUnit)} / serve</span>
                  </>
                )}
              </div>

              <div className="cs-row cs-per-unit">
                <span>Cost per {costs.yieldUnitLabel}</span>
                <strong style={{ color: 'var(--accent)', fontSize: 18 }}>{fmtCur(costs.costPerUnit)}</strong>
              </div>
              {/* Show alternate per-unit in smaller text */}
              {form.is_master && costs.altCostLabel && (
                <div className="cs-row" style={{ opacity:.7, fontSize:12 }}>
                  <span>Cost per {costs.altCostLabel}</span>
                  <strong>{fmtCur(costs.altCostValue)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── VIEW DETAILS MODAL ──────────────────────────── */}
      <Modal show={!!viewModal} onClose={() => setViewModal(null)}
        title={viewModal?.name || ''}
        subtitle={viewModal?.is_master ? '⭐ Recipe Master' : ('🍽️ Menu Recipe' + (viewModal?.course_name ? ' · ' + viewModal.course_icon + ' ' + viewModal.course_name : ''))}
        wide>
        {viewLoading ? <div className="loading-wrap">Loading details…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Overview strip */}
            <div className="view-strip">
              <div className="vs-item">
                <div className="vs-label">Total Cost</div>
                <div className="vs-val" style={{ color: 'var(--accent)' }}>{fmtCur(viewModal?.total_cost)}</div>
              </div>
              <div className="vs-item">
                <div className="vs-label">Cost / {viewModal?.is_master ? 'Unit' : 'Serve'}</div>
                <div className="vs-val" style={{ color: 'var(--accent)' }}>{fmtCur(viewModal?.cost_per_unit)}</div>
              </div>
              <div className="vs-item">
                <div className="vs-label">{viewModal?.is_master ? 'Yield' : 'Serves'}</div>
                <div className="vs-val">{viewModal?.is_master ? `${viewModal.yield_qty} ${viewModal.yield_unit_abbr || ''}` : `${viewModal?.serves || 1} portions`}</div>
              </div>
              <div className="vs-item">
                <div className="vs-label">Cook Time</div>
                <div className="vs-val">{viewModal?.cook_minutes || 0} min</div>
              </div>
              <div className="vs-item">
                <div className="vs-label">Wastage</div>
                <div className="vs-val">{viewModal?.wastage_percent || 0}%</div>
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <div className="view-section-title">🧺 Ingredients</div>
              {(viewData?.data || []).length === 0
                ? <div style={{ color: 'var(--ink2)', fontSize: 13 }}>No ingredients found.</div>
                : (
                  <div className="view-table">
                    <div className="vt-head">
                      <div style={{ flex: 2 }}>Item</div>
                      <div style={{ width: 100 }}>Quantity</div>
                      <div style={{ width: 110 }}>Unit Price</div>
                      <div style={{ width: 110, textAlign: 'right' }}>Line Cost</div>
                    </div>
                    {(viewData?.data || []).map((i, idx) => (
                      <div key={idx} className="vt-row">
                        <div style={{ flex: 2 }}><strong>{i.item_name}</strong><div style={{ fontSize: 11, color: 'var(--ink2)' }}>{i.category_name}</div></div>
                        <div style={{ width: 100 }}>{i.quantity} {i.chosen_unit_abbr || i.base_unit_abbr}</div>
                        <div style={{ width: 110 }}>{fmtCur(i.price_per_unit)}</div>
                        <div style={{ width: 110, textAlign: 'right', fontWeight: 700 }}>{fmtCur(i.line_cost)}</div>
                      </div>
                    ))}
                    <div className="vt-row vt-subtotal">
                      <div style={{ flex: 2 }}>Ingredient Subtotal</div>
                      <div style={{ width: 100 }}></div>
                      <div style={{ width: 110 }}></div>
                      <div style={{ width: 110, textAlign: 'right' }}>{fmtCur(viewModal?.ingredient_cost)}</div>
                    </div>
                  </div>
                )
              }
            </div>

            {/* Fuel */}
            <div>
              <div className="view-section-title">🔥 Fuel Cost</div>
              {!viewModal?.fuel_profile_id ? (
                <div style={{ color: 'var(--ink2)', fontSize: 13 }}>No fuel profile assigned.</div>
              ) : (
                <div className="view-table">
                  <div className="vt-head">
                    <div style={{ flex: 2 }}>Fuel Profile</div>
                    <div style={{ width: 110 }}>₹/minute</div>
                    <div style={{ width: 110 }}>Cook Time</div>
                    <div style={{ width: 110, textAlign: 'right' }}>Fuel Cost</div>
                  </div>
                  <div className="vt-row">
                    <div style={{ flex: 2 }}>
                      {(() => { const fp = fuels.find(f => f.id === viewModal?.fuel_profile_id); return fp ? `${fp.icon} ${fp.fuel_name}` : '—'; })()}
                    </div>
                    <div style={{ width: 110, fontFamily: 'monospace', fontSize: 13 }}>
                      {(() => { const fp = fuels.find(f => f.id === viewModal?.fuel_profile_id); return fp ? `₹${parseFloat(fp.per_minute).toFixed(4)}` : '—'; })()}
                    </div>
                    <div style={{ width: 110 }}>{viewModal?.cook_minutes || 0} min</div>
                    <div style={{ width: 110, textAlign: 'right', fontWeight: 700 }}>{fmtCur(viewModal?.fuel_cost)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Staff */}
            <div>
              <div className="view-section-title">👥 Staff Cost</div>
              {(viewData?.staff || []).length === 0 ? (
                <div style={{ color: 'var(--ink2)', fontSize: 13 }}>No staff assigned to this recipe.</div>
              ) : (
                <div className="view-table">
                  <div className="vt-head">
                    <div style={{ flex: 2 }}>Role</div>
                    <div style={{ width: 80 }}>Count</div>
                    <div style={{ width: 110 }}>₹/min</div>
                    <div style={{ width: 110 }}>Cook Time</div>
                    <div style={{ width: 110, textAlign: 'right' }}>Line Cost</div>
                  </div>
                  {(viewData?.staff || []).map((s, idx) => (
                    <div key={idx} className="vt-row">
                      <div style={{ flex: 2 }}><strong>{s.role_name}</strong></div>
                      <div style={{ width: 80 }}>× {s.staff_count}</div>
                      <div style={{ width: 110, fontFamily: 'monospace', fontSize: 13 }}>₹{parseFloat(s.per_minute || 0).toFixed(4)}</div>
                      <div style={{ width: 110 }}>{viewModal?.cook_minutes || 0} min</div>
                      <div style={{ width: 110, textAlign: 'right', fontWeight: 700 }}>{fmtCur(s.line_cost)}</div>
                    </div>
                  ))}
                  <div className="vt-row vt-subtotal">
                    <div style={{ flex: 2 }}>Staff Subtotal</div>
                    <div style={{ width: 80 }}></div>
                    <div style={{ width: 110 }}></div>
                    <div style={{ width: 110 }}></div>
                    <div style={{ width: 110, textAlign: 'right' }}>{fmtCur(viewModal?.salary_total_cost)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Total breakdown */}
            <div className="view-cost-total">
              <div className="vct-row"><span>Ingredient Cost</span><strong>{fmtCur(viewModal?.ingredient_cost)}</strong></div>
              <div className="vct-row"><span>Wastage ({viewModal?.wastage_percent || 0}%)</span><strong>{fmtCur(viewModal?.wastage_cost)}</strong></div>
              <div className="vct-row"><span>Fuel Cost</span><strong>{fmtCur(viewModal?.fuel_cost)}</strong></div>
              <div className="vct-row"><span>Staff Cost</span><strong>{fmtCur(viewModal?.salary_total_cost)}</strong></div>
              <div className="vct-row vct-grand"><span>Grand Total</span><strong>{fmtCur(viewModal?.total_cost)}</strong></div>
              <div className="vct-row vct-per"><span>Cost per {viewModal?.is_master ? 'Unit' : 'Serve'}</span><strong>{fmtCur(viewModal?.cost_per_unit)}</strong></div>
            </div>
          </div>
        )}
        <div className="mft"><button className="btn-c" onClick={() => setViewModal(null)}>Close</button></div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={() => setDelModal(null)} onConfirm={del}
        title="Delete Recipe" message={`Delete "${delModal?.name}"? This cannot be undone.`} />
    </div>
  );
}
