import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from '../../api';
import { useToast } from '../../context/ToastContext';
import { fmtCur } from '../../utils';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';

const ROLES = ['admin','manager','waiter','staff'];
const ROLE_META = {
  admin:   { label:'Admin',   color:'#e84a5f', bg:'rgba(232,74,95,.12)',   icon:'👑' },
  manager: { label:'Manager', color:'#118ab2', bg:'rgba(17,138,178,.12)',  icon:'🏠' },
  waiter:  { label:'Waiter',  color:'#1db97e', bg:'rgba(29,185,126,.12)',  icon:'🍽️' },
  staff:   { label:'Staff',   color:'#b07a00', bg:'rgba(244,165,53,.15)',  icon:'👤' },
};

const ALL_PAGES = [
  { id:'sales',          label:'Sales / POS',       icon:'🧾' },
  { id:'kot',            label:'KOT Manager',        icon:'🍳' },
  { id:'coupons',        label:'Coupons',            icon:'🎟️' },
  { id:'zomato',         label:'Zomato Menu',        icon:'🛵' },
  { id:'inventory',      label:'Inventory',          icon:'📦' },
  { id:'purchaseorders', label:'Purchase Orders',    icon:'📋' },
  { id:'purchases',      label:'Purchase History',   icon:'🛒' },
  { id:'categories',     label:'Categories',         icon:'🏷️' },
  { id:'units',          label:'Units',              icon:'⚖️' },
  { id:'recipes',        label:'Recipes',            icon:'📖' },
  { id:'menuitems',      label:'Menu Items',         icon:'🍽️' },
  { id:'courses',        label:'Courses',            icon:'🗂️' },
  { id:'salary',         label:'Salary Manager',     icon:'💰' },
  { id:'fuel',           label:'Fuel Manager',       icon:'🔥' },
  { id:'staff',          label:'Staff Management',   icon:'👥' },
  { id:'reports',        label:'Reports',            icon:'📊' },
  { id:'users',          label:'Users & Access',     icon:'🔐' },
  { id:'profile',        label:'My Profile',         icon:'👤' },
];

const emptyForm = {
  name:'', phone:'', password:'', role:'staff', designation:'',
  monthly_salary:'', work_days_month:30, join_date:'', is_active:true,
  page_permissions: null,
};

export default function UsersPage() {
  const toast = useToast();
  const [users,  setUsers]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [search, setSearch] = useState('');
  const [roleF,  setRoleF]  = useState('');

  const [modal,   setModal]   = useState(false);
  const [isEdit,  setIsEdit]  = useState(false);
  const [editId,  setEditId]  = useState(null);
  const [form,    setForm]    = useState(emptyForm);
  const [delModal,setDelModal]= useState(null);
  const [pwModal, setPwModal] = useState(null);
  const [newPw,   setNewPw]   = useState('');

  const load = async () => {
    setLoading(true);
    try { const d = await getUsers(); if (d.success) setUsers(d.data); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const openAdd = () => {
    setForm(emptyForm); setIsEdit(false); setEditId(null); setModal(true);
  };

  const openEdit = (u) => {
    let pp = u.page_permissions;
    if (typeof pp === 'string') { try { pp = JSON.parse(pp); } catch { pp = null; } }
    setForm({
      name: u.name, phone: u.phone, password: '', role: u.role || 'staff',
      designation: u.designation || '', monthly_salary: u.monthly_salary || '',
      work_days_month: u.work_days_month || 30,
      join_date: u.join_date ? u.join_date.split('T')[0] : '',
      is_active: u.is_active !== 0,
      page_permissions: pp,
    });
    setIsEdit(true); setEditId(u.id); setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.phone || !form.role) { toast('Name, phone, role required','er'); return; }
    if (!isEdit && !form.password) { toast('Password required for new user','er'); return; }
    try {
      const payload = { ...form, monthly_salary: parseFloat(form.monthly_salary)||0 };
      if (isEdit) delete payload.password;
      const d = isEdit ? await updateUser(editId, payload) : await createUser(payload);
      if (d.success) { toast(isEdit?'User updated ✅':'User created ✅','ok'); setModal(false); load(); }
      else toast(d.message,'er');
    } catch(e) { toast(e?.response?.data?.message||'Error','er'); }
  };

  const doDelete = async () => {
    try {
      const d = await deleteUser(delModal.id);
      if (d.success) { toast('User deleted','ok'); setDelModal(null); load(); }
      else toast(d.message,'er');
    } catch { toast('Error','er'); }
  };

  const doResetPw = async () => {
    if (!newPw || newPw.length < 4) { toast('Min 4 chars','er'); return; }
    try {
      const d = await resetUserPassword(pwModal.id, newPw);
      if (d.success) { toast('Password reset ✅','ok'); setPwModal(null); setNewPw(''); }
      else toast(d.message,'er');
    } catch { toast('Error','er'); }
  };

  const filtered = users.filter(u => {
    if (roleF && u.role !== roleF) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.phone.includes(search)) return false;
    return true;
  });

  const rm = (r) => ROLE_META[r] || ROLE_META.staff;

  const togglePagePerm = (id) => {
    const cur = form.page_permissions || [];
    setForm(f => ({
      ...f,
      page_permissions: cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id]
    }));
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">🔐 Users & Access</div>
          <div className="ps">Manage user accounts, roles, and page permissions</div>
        </div>
        <button className="btn-p" onClick={openAdd}>+ New User</button>
      </div>

      <div className="stats-row">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r).length;
          const m = rm(r);
          return (
            <div key={r} className="scard" style={{ borderTop:`3px solid ${m.color}` }}>
              <div style={{ fontSize:22 }}>{m.icon}</div>
              <div className="scard-text">
                <div className="sv" style={{ color:m.color }}>{count}</div>
                <div className="sl">{m.label}(s)</div>
              </div>
            </div>
          );
        })}
        <div className="scard"><div className="scard-text"><div className="sv">{users.length}</div><div className="sl">Total Users</div></div></div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">User Accounts</div>
          <div style={{ display:'flex', gap:10 }}>
            <div className="sw2"><span className="si2">🔍</span><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <select className="fsel" value={roleF} onChange={e=>setRoleF(e.target.value)}>
              <option value="">All Roles</option>
              {ROLES.map(r=><option key={r} value={r}>{rm(r).icon} {rm(r).label}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="loading-wrap">Loading…</div> : (
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead><tr>
                <th>User</th><th>Role</th><th style={{textAlign:'center'}}>Monthly Salary</th>
                <th style={{textAlign:'center'}}>Page Access</th>
                <th style={{textAlign:'center'}}>Status</th>
                <th style={{textAlign:'center'}}>Last Login</th>
                <th style={{textAlign:'center'}}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(u => {
                  let pp = u.page_permissions;
                  if (typeof pp === 'string') { try { pp = JSON.parse(pp); } catch { pp = null; } }
                  const m = rm(u.role);
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight:700 }}>{u.name}</div>
                        <div style={{ fontSize:11, color:'var(--ink2)' }}>📞 {u.phone}</div>
                        {u.designation && <div style={{ fontSize:11, color:'var(--ink2)', fontStyle:'italic' }}>{u.designation}</div>}
                      </td>
                      <td>
                        <span style={{ padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:700, background:m.bg, color:m.color }}>
                          {m.icon} {m.label}
                        </span>
                      </td>
                      <td style={{ textAlign:'center', fontWeight:700 }}>
                        {u.monthly_salary > 0 ? fmtCur(u.monthly_salary) : <span style={{color:'var(--ink2)'}}>—</span>}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        {!pp ? (
                          <span style={{ fontSize:11, color:'var(--ink2)', padding:'3px 9px', borderRadius:12, background:'var(--bg)', border:'1px solid var(--border)' }}>
                            Role defaults
                          </span>
                        ) : (
                          <span style={{ fontSize:11, color:'#118ab2', padding:'3px 9px', borderRadius:12, background:'rgba(17,138,178,.1)', border:'1px solid rgba(17,138,178,.2)', fontWeight:700 }}>
                            Custom ({pp.length} pages)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                          background:u.is_active?'rgba(29,185,126,.1)':'rgba(200,200,200,.2)',
                          color:u.is_active?'#1db97e':'#888' }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign:'center', fontSize:11, color:'var(--ink2)' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        <div className="tact" style={{justifyContent:'center'}}>
                          <button className="bsm be" onClick={()=>openEdit(u)}>✏️ Edit</button>
                          <button className="bsm bo" onClick={()=>{setPwModal(u);setNewPw('');}}>🔑 PW</button>
                          <button className="bsm bd" onClick={()=>setDelModal(u)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7}><div className="empty" style={{padding:40}}>
                    <div className="ei">👥</div><p>No users found</p>
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal show={modal} onClose={()=>setModal(false)} title={isEdit?`Edit: ${form.name}`:'New User'} subtitle={isEdit?'Update user account and permissions':'Create a new staff account'} wide
        footer={<><button className="btn-c" onClick={()=>setModal(false)}>Cancel</button><button className="btn-p" onClick={save}>{isEdit?'Save Changes':'Create User'}</button></>}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="mgrid">
            <div><label className="mlabel">Full Name *</label><input className="mfi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Staff full name" /></div>
            <div><label className="mlabel">Phone (Login) *</label><input className="mfi" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="10-digit mobile" /></div>
            {!isEdit && <div><label className="mlabel">Password *</label><input className="mfi" type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Min 6 characters" /></div>}
            <div>
              <label className="mlabel">Role *</label>
              <select className="mfi" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].icon} {ROLE_META[r].label}</option>)}
              </select>
            </div>
            <div><label className="mlabel">Designation</label><input className="mfi" placeholder="e.g. Head Chef, Cashier" value={form.designation} onChange={e=>setForm(f=>({...f,designation:e.target.value}))} /></div>
            <div><label className="mlabel">Join Date</label><input className="mfi" type="date" value={form.join_date} onChange={e=>setForm(f=>({...f,join_date:e.target.value}))} /></div>
          </div>

          <div style={{background:'rgba(29,185,126,.05)',border:'1.5px solid rgba(29,185,126,.15)',borderRadius:12,padding:14}}>
            <div style={{fontWeight:800,fontSize:12,marginBottom:10}}>💰 Salary Settings</div>
            <div className="mgrid">
              <div><label className="mlabel">Monthly Salary (₹)</label><input className="mfi" type="number" min="0" placeholder="0" value={form.monthly_salary} onChange={e=>setForm(f=>({...f,monthly_salary:e.target.value}))} /></div>
              <div><label className="mlabel">Work Days / Month</label><input className="mfi" type="number" min="1" max="31" value={form.work_days_month} onChange={e=>setForm(f=>({...f,work_days_month:e.target.value}))} /></div>
            </div>
            {form.monthly_salary > 0 && (
              <div style={{marginTop:8,fontSize:12,color:'#1db97e',fontWeight:700}}>
                Per day: {fmtCur(parseFloat(form.monthly_salary)/(parseFloat(form.work_days_month)||30))}
              </div>
            )}
          </div>

          {/* Page Access */}
          <div style={{background:'rgba(17,138,178,.05)',border:'1.5px solid rgba(17,138,178,.15)',borderRadius:12,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:12}}>🔐 Page Access (overrides role defaults)</div>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                <input type="checkbox" checked={form.page_permissions === null}
                  onChange={e=>setForm(f=>({...f,page_permissions:e.target.checked?null:[]}))} />
                Use role defaults
              </label>
            </div>
            {form.page_permissions !== null && (
              <>
                <div style={{display:'flex',gap:6,marginBottom:10}}>
                  <button type="button" onClick={()=>setForm(f=>({...f,page_permissions:ALL_PAGES.map(p=>p.id)}))}
                    style={{padding:'4px 12px',borderRadius:14,fontSize:12,cursor:'pointer',border:'1.5px solid var(--border)',background:'transparent'}}>Select All</button>
                  <button type="button" onClick={()=>setForm(f=>({...f,page_permissions:[]}))}
                    style={{padding:'4px 12px',borderRadius:14,fontSize:12,cursor:'pointer',border:'1.5px solid var(--border)',background:'transparent'}}>Clear</button>
                  <span style={{fontSize:11,color:'var(--ink2)',alignSelf:'center'}}>{form.page_permissions?.length||0} pages selected</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:6}}>
                  {ALL_PAGES.map(pg=>{
                    const on = (form.page_permissions||[]).includes(pg.id);
                    return (
                      <label key={pg.id} style={{display:'flex',alignItems:'center',gap:7,padding:'8px 12px',borderRadius:9,border:'1.5px solid',cursor:'pointer',fontSize:12,fontWeight:600,transition:'all .12s',
                        borderColor:on?'var(--accent)':'var(--border)',background:on?'rgba(232,87,42,.07)':'var(--surface)',color:on?'var(--accent)':'var(--ink2)'}}>
                        <input type="checkbox" checked={on} onChange={()=>togglePagePerm(pg.id)} style={{width:14,height:14,accentColor:'var(--accent)'}} />
                        <span style={{fontSize:15}}>{pg.icon}</span> {pg.label}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14,fontWeight:600}}>
            <input type="checkbox" checked={!!form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{width:16,height:16}} />
            Active Account
          </label>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal show={!!pwModal} onClose={()=>setPwModal(null)} title="Reset Password" subtitle={`Set new password for ${pwModal?.name}`}
        footer={<><button className="btn-c" onClick={()=>setPwModal(null)}>Cancel</button><button className="btn-p" onClick={doResetPw}>Reset Password</button></>}>
        <div>
          <label className="mlabel">New Password</label>
          <input className="mfi" type="password" placeholder="Min 4 characters" value={newPw} onChange={e=>setNewPw(e.target.value)} autoFocus />
        </div>
      </Modal>

      <ConfirmModal show={!!delModal} onClose={()=>setDelModal(null)} onConfirm={doDelete}
        title="Delete User" message={`Delete "${delModal?.name}"? This cannot be undone.`} />
    </div>
  );
}
