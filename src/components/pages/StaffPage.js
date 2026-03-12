/**
 * Staff Management — Simplified
 * Just manages staff profiles, designations, and role-based page permissions.
 * All salary/advance handling is in Salary Manager.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStaff, updateStaff, getRolePermissions, saveRolePermissions } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';

const ROLES = ['admin','manager','waiter','staff'];
const ROLE_META = {
  admin:   { label:'Admin',   color:'#e84a5f', bg:'rgba(232,74,95,.12)',   icon:'👑' },
  manager: { label:'Manager', color:'#118ab2', bg:'rgba(17,138,178,.12)',  icon:'🏠' },
  waiter:  { label:'Waiter',  color:'#1db97e', bg:'rgba(29,185,126,.12)',  icon:'🍽️' },
  staff:   { label:'Staff',   color:'#b07a00', bg:'rgba(244,165,53,.15)',  icon:'👤' },
};
const ALL_PAGES = [
  { id:'sales',          label:'Sales / POS',       icon:'🧾', section:'SALES'   },
  { id:'kot',            label:'KOT Manager',        icon:'🍳', section:null      },
  { id:'kds',            label:'KDS — Kitchen',      icon:'🖥️', section:null      },
  { id:'coupons',        label:'Coupons',            icon:'🎟️', section:null      },
  { id:'zomato',         label:'Zomato Menu',        icon:'🛵', section:null      },
  { id:'inventory',      label:'Inventory',          icon:'📦', section:'STOCK'   },
  { id:'purchaseorders', label:'Purchase Orders',    icon:'📋', section:null      },
  { id:'purchases',      label:'Purchase History',   icon:'🛒', section:null      },
  { id:'categories',     label:'Categories',         icon:'🏷️', section:null      },
  { id:'units',          label:'Units',              icon:'⚖️', section:null      },
  { id:'recipes',        label:'Recipes',            icon:'📖', section:'KITCHEN' },
  { id:'menuitems',      label:'Menu Items',         icon:'🍽️', section:null      },
  { id:'courses',        label:'Courses',            icon:'🗂️', section:null      },
  { id:'salarymgmt',     label:'Salary Manager',     icon:'💰', section:'COSTS'   },
  { id:'expenses',       label:'Expense Manager',    icon:'💸', section:null      },
  { id:'fuel',           label:'Fuel Manager',       icon:'🔥', section:null      },
  { id:'staff',          label:'Staff Management',   icon:'👥', section:'ADMIN'   },
  { id:'reports',        label:'Reports',            icon:'📊', section:null      },
  { id:'billsettings',   label:'Bill Settings',      icon:'🧾', section:null      },
  { id:'users',          label:'Users / Access',     icon:'🔐', section:null      },
  { id:'profile',        label:'My Profile',         icon:'👤', section:null      },
];

export default function StaffPage() {
  const toast = useToast();
  const [staff,      setStaff]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tab,        setTab]        = useState('staff');

  const [rolePerms,     setRolePerms]     = useState({});
  const [editRolePerms, setEditRolePerms] = useState(null);
  const [editPermsForm, setEditPermsForm] = useState([]);

  const [editModal, setEditModal] = useState(null);
  const [editForm,  setEditForm]  = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await getStaff(); if (d.success) setStaff(d.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== 'roles') return;
    getRolePermissions().then(d => {
      if (d.success) {
        const map = {};
        d.data.forEach(r => { map[r.role] = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions; });
        setRolePerms(map);
      }
    });
  }, [tab]);

  const openEdit = (s) => {
    setEditForm({
      name: s.name, phone: s.phone, role: s.role || 'staff',
      designation: s.designation || '',
      monthly_salary: s.monthly_salary || '',
      work_days_month: s.work_days_month || 26,
      hours_per_day: s.hours_per_day || 8,
      join_date: s.join_date ? s.join_date.split('T')[0] : '',
      address: s.address || '',
      emergency_contact: s.emergency_contact || '',
      page_permissions: s.page_permissions
        ? (typeof s.page_permissions === 'string' ? JSON.parse(s.page_permissions) : s.page_permissions)
        : null,
      is_active: s.is_active !== 0,
    });
    setEditModal(s);
  };

  const saveEdit = async () => {
    try {
      const d = await updateStaff(editModal.id, editForm);
      if (d.success) { toast('Saved ✅', 'ok'); setEditModal(null); load(); }
      else toast(d.message, 'er');
    } catch (e) { toast(e?.response?.data?.message || 'Error', 'er'); }
  };

  const openRoleEdit = (role) => {
    const current = rolePerms[role] || [];
    const isAll = current.includes('*');
    setEditPermsForm(isAll ? ALL_PAGES.map(p => p.id) : [...current]);
    setEditRolePerms(role);
  };

  const saveRoleEdit = async () => {
    try {
      const isAll = editPermsForm.length === ALL_PAGES.length;
      const perms = isAll ? ['*'] : editPermsForm;
      const d = await saveRolePermissions(editRolePerms, perms);
      if (d.success) {
        toast('Permissions saved ✅', 'ok');
        setRolePerms(p => ({ ...p, [editRolePerms]: perms }));
        setEditRolePerms(null);
      } else toast(d.message, 'er');
    } catch { toast('Error', 'er'); }
  };

  const togglePerm = (id) => setEditPermsForm(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const stats = useMemo(() => ({
    total:  staff.length,
    active: staff.filter(s => s.is_active).length,
    roles:  ROLES.reduce((a, r) => ({ ...a, [r]: staff.filter(s => s.role === r).length }), {}),
  }), [staff]);

  const filtered = useMemo(() => staff.filter(s => {
    if (roleFilter && s.role !== roleFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.phone.includes(search)) return false;
    return true;
  }), [staff, roleFilter, search]);

  const rm = (role) => ROLE_META[role] || ROLE_META.staff;

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">👥 Staff Management</div>
          <div className="ps">Staff profiles, designations &amp; role-based page access</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="scard"><div style={{fontSize:22}}>👥</div><div className="scard-text"><div className="sv">{stats.total}</div><div className="sl">Total Staff</div></div></div>
        <div className="scard" style={{borderTop:'3px solid #1db97e'}}><div style={{fontSize:22}}>✅</div><div className="scard-text"><div className="sv" style={{color:'#1db97e'}}>{stats.active}</div><div className="sl">Active</div></div></div>
        {ROLES.map(r => (
          <div key={r} className="scard" style={{borderTop:`3px solid ${rm(r).color}`}}>
            <div style={{fontSize:22}}>{rm(r).icon}</div>
            <div className="scard-text"><div className="sv" style={{color:rm(r).color}}>{stats.roles[r]||0}</div><div className="sl">{rm(r).label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:20,borderBottom:'2px solid var(--border)'}}>
        {[{id:'staff',icon:'👥',label:'Staff Directory'},{id:'roles',icon:'🔐',label:'Role & Permissions'}].map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{padding:'10px 20px',border:'none',cursor:'pointer',background:tab===t.id?'rgba(232,87,42,.06)':'transparent',
              borderBottom:tab===t.id?'3px solid var(--accent)':'3px solid transparent',
              marginBottom:-2,color:tab===t.id?'var(--accent)':'var(--ink2)',fontWeight:700,fontSize:13,transition:'all .13s'}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── STAFF DIRECTORY ── */}
      {tab === 'staff' && (
        <div className="card">
          <div className="ch">
            <div className="ct">Staff Directory</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
              <div className="sw2"><span className="si2">🔍</span><input placeholder="Name or phone…" value={search} onChange={e=>setSearch(e.target.value)} /></div>
              <select className="fsel" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                {ROLES.map(r=><option key={r} value={r}>{rm(r).icon} {rm(r).label}</option>)}
              </select>
            </div>
          </div>
          {loading ? <div className="loading-wrap">Loading…</div> : (
            <div style={{overflowX:'auto'}}>
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Role / Designation</th>
                    <th style={{textAlign:'center'}}>Monthly Salary</th>
                    <th style={{textAlign:'center'}}>Work Days</th>
                    <th style={{textAlign:'center'}}>Join Date</th>
                    <th style={{textAlign:'center'}}>Status</th>
                    <th style={{textAlign:'center'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const r = rm(s.role);
                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
                          <div style={{fontSize:11,color:'var(--ink2)'}}>📞 {s.phone}</div>
                          {s.address && <div style={{fontSize:11,color:'var(--ink2)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📍 {s.address}</div>}
                        </td>
                        <td>
                          <span style={{padding:'4px 11px',borderRadius:20,fontSize:11,fontWeight:700,background:r.bg,color:r.color,display:'inline-block',marginBottom:4}}>
                            {r.icon} {r.label}
                          </span>
                          {s.designation && <div style={{fontSize:12,color:'var(--ink2)',fontStyle:'italic'}}>{s.designation}</div>}
                        </td>
                        <td style={{textAlign:'center',fontWeight:800,color:'#1db97e'}}>{fmtCur(s.monthly_salary||0)}</td>
                        <td style={{textAlign:'center',color:'var(--ink2)'}}>{s.work_days_month||26} days</td>
                        <td style={{textAlign:'center',fontSize:12,color:'var(--ink2)'}}>{s.join_date?s.join_date.split('T')[0]:'—'}</td>
                        <td style={{textAlign:'center'}}>
                          <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                            background:s.is_active?'rgba(29,185,126,.1)':'rgba(200,200,200,.2)',
                            color:s.is_active?'#1db97e':'#888'}}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{textAlign:'center'}}>
                          <button className="bsm be" onClick={() => openEdit(s)}>✏️ Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7}><div className="empty" style={{padding:40}}>
                      <div className="ei">👥</div><p>No staff found</p>
                    </div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ROLE & PERMISSIONS ── */}
      {tab === 'roles' && (
        <div>
          <div style={{marginBottom:16,padding:'12px 16px',background:'rgba(17,138,178,.06)',border:'1.5px solid rgba(17,138,178,.15)',borderRadius:12,fontSize:13,color:'var(--ink2)'}}>
            <strong>ℹ️ Role Permissions</strong> — Set which pages each role can access by default. Individual staff can have custom page overrides via the ✏️ Edit button.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
            {ROLES.map(role => {
              const perms = rolePerms[role] || [];
              const isAll = perms.includes('*');
              const count = isAll ? ALL_PAGES.length : perms.length;
              const r = rm(role);
              return (
                <div key={role} className="card" style={{padding:0,overflow:'hidden',borderTop:`3px solid ${r.color}`}}>
                  <div style={{padding:'16px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:22}}>{r.icon}</span>
                        <span style={{fontWeight:800,fontSize:16,color:r.color}}>{r.label}</span>
                      </div>
                      <div style={{fontSize:12,color:'var(--ink2)'}}>
                        {isAll ? '✅ Full access — all pages' : `${count} of ${ALL_PAGES.length} pages`}
                      </div>
                    </div>
                    <button className="btn-p" style={{fontSize:12,padding:'7px 14px'}} onClick={() => openRoleEdit(role)}>✏️ Edit</button>
                  </div>
                  <div style={{padding:'0 18px 16px',display:'flex',flexWrap:'wrap',gap:5}}>
                    {isAll ? (
                      <span style={{padding:'3px 10px',borderRadius:14,fontSize:11,background:r.bg,color:r.color,fontWeight:700}}>✅ All Pages</span>
                    ) : perms.slice(0,8).map(p => {
                      const pg = ALL_PAGES.find(x => x.id === p);
                      return pg ? (
                        <span key={p} style={{padding:'3px 8px',borderRadius:14,fontSize:11,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--ink2)'}}>
                          {pg.icon} {pg.label}
                        </span>
                      ) : null;
                    })}
                    {!isAll && perms.length > 8 && (
                      <span style={{padding:'3px 8px',borderRadius:14,fontSize:11,color:'var(--ink2)'}}>+{perms.length-8} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ EDIT STAFF MODAL ══════════════════════════════ */}
      <Modal show={!!editModal} onClose={() => setEditModal(null)} title="✏️ Edit Staff Member" subtitle={editModal?.name} wide
        footer={<><button className="btn-c" onClick={() => setEditModal(null)}>Cancel</button><button className="btn-p" onClick={saveEdit}>Save Changes</button></>}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="mgrid">
            <div><label className="mlabel">Full Name *</label><input className="mfi" value={editForm.name||''} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} /></div>
            <div><label className="mlabel">Phone *</label><input className="mfi" value={editForm.phone||''} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} /></div>
            <div>
              <label className="mlabel">Role</label>
              <select className="mfi" value={editForm.role||'staff'} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))}>
                {ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].icon} {ROLE_META[r].label}</option>)}
              </select>
            </div>
            <div><label className="mlabel">Designation</label><input className="mfi" placeholder="e.g. Head Chef, Cashier…" value={editForm.designation||''} onChange={e=>setEditForm(f=>({...f,designation:e.target.value}))} /></div>
          </div>

          <div style={{background:'rgba(29,185,126,.05)',border:'1.5px solid rgba(29,185,126,.15)',borderRadius:12,padding:14}}>
            <div style={{fontWeight:800,fontSize:12,marginBottom:10}}>💰 Salary Configuration</div>
            <div className="mgrid">
              <div><label className="mlabel">Monthly Salary (₹)</label><input className="mfi" type="number" min="0" value={editForm.monthly_salary||''} onChange={e=>setEditForm(f=>({...f,monthly_salary:e.target.value}))} /></div>
              <div>
                <label className="mlabel">Work Days / Month</label>
                <input className="mfi" type="number" min="1" max="31" value={editForm.work_days_month||26} onChange={e=>setEditForm(f=>({...f,work_days_month:e.target.value}))} />
              </div>
              <div>
                <label className="mlabel">Working Hours / Day</label>
                <select className="mfi" value={editForm.hours_per_day||8} onChange={e=>setEditForm(f=>({...f,hours_per_day:parseInt(e.target.value)}))}>
                  {[4,5,6,7,8,9,10,11,12,14,16].map(h=>(
                    <option key={h} value={h}>{h} hours{h===8?' (standard)':h===12?' (double shift)':''}</option>
                  ))}
                </select>
              </div>
              <div><label className="mlabel">Join Date</label><input className="mfi" type="date" value={editForm.join_date||''} onChange={e=>setEditForm(f=>({...f,join_date:e.target.value}))} /></div>
              <div><label className="mlabel">Emergency Contact</label><input className="mfi" placeholder="Phone number" value={editForm.emergency_contact||''} onChange={e=>setEditForm(f=>({...f,emergency_contact:e.target.value}))} /></div>
            </div>
            {editForm.monthly_salary && editForm.work_days_month && (() => {
              const sal  = parseFloat(editForm.monthly_salary) || 0;
              const days = parseFloat(editForm.work_days_month) || 26;
              const hrs  = parseFloat(editForm.hours_per_day) || 8;
              const perDay = sal / days;
              const perHr  = perDay / hrs;
              const perMin = perHr / 60;
              return (
                <div style={{marginTop:10,padding:'10px 12px',background:'rgba(29,185,126,.08)',borderRadius:8,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11,color:'var(--ink2)',marginBottom:2}}>Per Day</div>
                    <div style={{fontWeight:800,color:'#1db97e',fontSize:13}}>{fmtCur(perDay)}</div>
                    <div style={{fontSize:10,color:'var(--ink2)'}}>{days}d/mo</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11,color:'var(--ink2)',marginBottom:2}}>Per Hour</div>
                    <div style={{fontWeight:800,color:'#118ab2',fontSize:13}}>{fmtCur(perHr)}</div>
                    <div style={{fontSize:10,color:'var(--ink2)'}}>{hrs}h/day</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11,color:'var(--ink2)',marginBottom:2}}>Per Minute</div>
                    <div style={{fontWeight:800,color:'var(--accent)',fontSize:13}}>₹{perMin.toFixed(5)}</div>
                    <div style={{fontSize:10,color:'var(--ink2)'}}>for recipe cost</div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div><label className="mlabel">Address</label><textarea className="mfi" rows={2} value={editForm.address||''} onChange={e=>setEditForm(f=>({...f,address:e.target.value}))} style={{resize:'none'}} /></div>

          <div style={{background:'rgba(17,138,178,.05)',border:'1.5px solid rgba(17,138,178,.15)',borderRadius:12,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:12}}>🔐 Custom Page Access (overrides role defaults)</div>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                <input type="checkbox" checked={editForm.page_permissions===null}
                  onChange={e=>setEditForm(f=>({...f,page_permissions:e.target.checked?null:[]}))} />
                Use role defaults
              </label>
            </div>
            {editForm.page_permissions !== null && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:6}}>
                {ALL_PAGES.map(pg => {
                  const checked = editForm.page_permissions?.includes(pg.id)||false;
                  return (
                    <label key={pg.id} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 10px',borderRadius:8,border:'1.5px solid',cursor:'pointer',fontSize:12,fontWeight:600,transition:'all .1s',
                      borderColor:checked?'var(--accent)':'var(--border)',background:checked?'rgba(232,87,42,.06)':'transparent',color:checked?'var(--accent)':'var(--ink2)'}}>
                      <input type="checkbox" checked={checked} style={{display:'none'}}
                        onChange={()=>setEditForm(f=>({...f,page_permissions:checked
                          ?(f.page_permissions||[]).filter(x=>x!==pg.id)
                          :[...(f.page_permissions||[]),pg.id]}))} />
                      {checked?'✅':'○'} {pg.icon} {pg.label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14,fontWeight:600}}>
            <input type="checkbox" checked={!!editForm.is_active} onChange={e=>setEditForm(f=>({...f,is_active:e.target.checked}))} style={{width:16,height:16}} />
            Active Staff Member
          </label>
        </div>
      </Modal>

      {/* ══ ROLE PERMISSIONS MODAL ══════════════════════ */}
      <Modal show={!!editRolePerms} onClose={() => setEditRolePerms(null)}
        title={`🔐 ${ROLE_META[editRolePerms]?.label||editRolePerms} Permissions`}
        subtitle="Select which pages this role can access by default"
        footer={<>
          <button className="btn-c" onClick={() => setEditRolePerms(null)}>Cancel</button>
          <button className="btn-c" onClick={() => setEditPermsForm(ALL_PAGES.map(p=>p.id))}>All</button>
          <button className="btn-c" onClick={() => setEditPermsForm([])}>Clear</button>
          <button className="btn-p" onClick={saveRoleEdit}>Save</button>
        </>}>
        <div>
          <div style={{marginBottom:12,padding:'10px 14px',background:'rgba(232,87,42,.05)',borderRadius:10,fontSize:12,color:'var(--ink2)'}}>
            {editPermsForm.length} of {ALL_PAGES.length} pages selected
          </div>
          {(() => {
            const sections = {};
            ALL_PAGES.forEach(p => { const s = p.section||'_'; if (!sections[s]) sections[s]=[]; sections[s].push(p); });
            return Object.entries(sections).map(([sec, pages]) => (
              <div key={sec} style={{marginBottom:14}}>
                {sec !== '_' && <div style={{fontSize:10,fontWeight:800,color:'var(--ink2)',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{sec}</div>}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:6}}>
                  {pages.map(pg => {
                    const on = editPermsForm.includes(pg.id);
                    return (
                      <label key={pg.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,border:'1.5px solid',cursor:'pointer',fontSize:13,fontWeight:600,transition:'all .13s',
                        borderColor:on?'var(--accent)':'var(--border)',background:on?'rgba(232,87,42,.07)':'var(--surface)',color:on?'var(--accent)':'var(--ink2)'}}>
                        <input type="checkbox" checked={on} onChange={() => togglePerm(pg.id)} style={{width:15,height:15,accentColor:'var(--accent)'}} />
                        <span style={{fontSize:16}}>{pg.icon}</span> {pg.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      </Modal>
    </div>
  );
}
