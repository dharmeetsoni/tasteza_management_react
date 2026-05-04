import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../api';
import { useToast } from '../../context/ToastContext';
import { avatarColor, initials } from '../../utils';
import { useWS, useWSEvent } from '../../context/WSContext';
import { useOffline } from '../../context/OfflineContext';

import CategoriesPage from '../pages/CategoriesPage';
import UnitsPage from '../pages/UnitsPage';
import InventoryPage from '../pages/InventoryPage';
import PurchasesPage from '../pages/PurchasesPage';
import PurchaseOrderPage from '../pages/PurchaseOrderPage';
import SalesPage from '../pages/SalesPage';
import OrdersPage from '../pages/OrdersPage';
import CouponsPage from '../pages/CouponsPage';
import KOTPage from '../pages/KOTPage';
import ZomatoPage from '../pages/ZomatoPage';
import RecipesPage from '../pages/RecipesPage';
import MenuItemsPage from '../pages/MenuItemsPage';
import CoursesPage from '../pages/CoursesPage';
import SalaryPage from '../pages/SalaryPage';
import FuelPage from '../pages/FuelPage';
import UsersPage from '../pages/UsersPage';
import ProfilePage from '../pages/ProfilePage';
import StaffPage from '../pages/StaffPage';
import ReportsPage from '../pages/ReportsPage';
import ProfitLossPage from '../pages/ProfitLossPage';
import PastOrderPage from '../pages/PastOrderPage';
import BillSettingsPage from '../pages/BillSettingsPage';
import SalaryMgmtPage from '../pages/SalaryMgmtPage';
import ExpensesPage from '../pages/ExpensesPage';
import ExpenseCategoryManagerPage from '../pages/ExpenseCategoryManagerPage';
import ConsumptionPage from '../pages/ConsumptionPage';
import QuotationPage from '../pages/QuotationPage';
import KDSPage from '../pages/KDSPage';
import DashboardPage from '../pages/DashboardPage';
import VendorPage from '../pages/VendorPage';
import ZomatoImportPage from '../pages/ZomatoImportPage';
import AddonsPage from '../pages/AddonsPage';
import OnlineOrdersPage from '../pages/OnlineOrdersPage';

const ROLE_DEFAULTS = {
  admin: ['*'],
  manager: ['dashboard', 'sales', 'kot', 'orders', 'kds', 'coupons', 'online_orders', 'zomato', 'zomatoimport', 'inventory', 'purchaseorders', 'purchases', 'vendors',
    'categories', 'units', 'recipes', 'menuitems', 'courses', 'addons', 'salary', 'fuel',
    'salarymgmt', 'expenses', 'expcategories', 'staff', 'reports', 'profitloss',
    'pastorder', 'consumption', 'quotation', 'billsettings', 'profile'],
  waiter: ['dashboard', 'sales', 'kot', 'kds', 'profile'],
  staff: ['dashboard', 'sales', 'kot', 'kds', 'inventory', 'profile'],
};

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', section: 'OVERVIEW' },
  { id: 'sales', label: 'Sales / POS', icon: '🧾', section: 'SALES' },
  { id: 'kot', label: 'KOT Manager', icon: '🍳' },
  { id: 'orders', label: 'Order History', icon: '📑' },
  { id: 'kds', label: 'KDS — Kitchen', icon: '🖥️' },
  { id: 'coupons', label: 'Coupons', icon: '🎟️' },
  { id: 'online_orders', label: 'Online Orders', icon: '🛵' },
  { id: 'zomato', label: 'Zomato Menu', icon: '🛵' },
  { id: 'zomatoimport', label: 'Zomato Import', icon: '🍊' },
  { sep: true, id: 's0' },
  { id: 'inventory', label: 'Inventory', icon: '📦', section: 'STOCK' },
  { id: 'purchaseorders', label: 'Purchase Orders', icon: '📋' },
  { id: 'vendors', label: 'Vendors', icon: '🏪' },
  { id: 'purchases', label: 'Purchase History', icon: '🛒' },
  { id: 'categories', label: 'Categories', icon: '🏷️' },
  { id: 'units', label: 'Units', icon: '⚖️' },
  { sep: true, id: 's1' },
  { id: 'recipes', label: 'Recipes', icon: '📖', section: 'KITCHEN' },
  { id: 'menuitems', label: 'Menu Items', icon: '🍽️' },
  { id: 'courses', label: 'Courses', icon: '🗂️' },
  { id: 'addons', label: 'Add-on Groups', icon: '🍱' },
  { sep: true, id: 's2' },
  { id: 'salarymgmt', label: 'Salary Manager', icon: '💰', section: 'COSTS' },
  { id: 'expenses', label: 'Expense Manager', icon: '💸' },
  { id: 'expcategories', label: 'Expense Categories', icon: '🏷️' },
  { id: 'fuel', label: 'Fuel Manager', icon: '🔥' },
  { sep: true, id: 's3' },
  { id: 'staff', label: 'Staff Management', icon: '👥', section: 'ADMIN' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'profitloss', label: 'Profit & Loss', icon: '📈' },
  { id: 'pastorder', label: 'Past Date Sale', icon: '🕐' },
  { id: 'consumption', label: 'Consumption Report', icon: '📉' },
  { id: 'quotation', label: 'Quotations', icon: '📋' },
  { id: 'billsettings', label: 'Bill Settings', icon: '🧾', adminOnly: false },
  { id: 'users', label: 'Users & Access', icon: '🔐', adminOnly: true },
  { id: 'profile', label: 'My Profile', icon: '👤' },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  sales: 'Sales & POS', kot: 'KOT Manager', orders: 'Order History', coupons: 'Coupons', zomato: 'Zomato Menu', zomatoimport: 'Zomato Import',
  inventory: 'Inventory', purchaseorders: 'Purchase Orders', vendors: 'Vendors', purchases: 'Purchase History',
  categories: 'Categories', units: 'Units', recipes: 'Recipes', menuitems: 'Menu Items',
  kds: 'KDS — Kitchen Display', courses: 'Courses', salarymgmt: 'Salary Manager', expenses: 'Expense Manager', fuel: 'Fuel Manager',
  staff: 'Staff Management', reports: 'Reports', billsettings: 'Bill Settings', users: 'Users & Access', profile: 'My Profile',
};

const ROLE_STYLE = {
  admin: { color: '#e84a5f', bg: 'rgba(232,74,95,.15)' },
  manager: { color: '#118ab2', bg: 'rgba(17,138,178,.15)' },
  waiter: { color: '#1db97e', bg: 'rgba(29,185,126,.15)' },
  staff: { color: '#b07a00', bg: 'rgba(244,165,53,.18)' },
};

export default function AppShell() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState('dashboard');
  const { connected } = useWS() || { connected: false };
  const { isOnline } = useOffline() || { isOnline: true };
  const isLive = connected && isOnline;
  const [sideOpen, setSideOpen] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null); // { id, order_number, total, type }

  // New online order popup
  useWSEvent('new_online_order', (payload) => {
    setNewOrderAlert(payload.data || payload);
  });

  const handleLogout = async () => {
    try { await logout(); } catch { }
    signOut();
    toast('Logged out.', 'ok');
  };

  const allowedPages = useMemo(() => {
    const role = user?.role || 'staff';
    let perms = null;
    if (user?.page_permissions) {
      try { perms = typeof user.page_permissions === 'string' ? JSON.parse(user.page_permissions) : user.page_permissions; } catch { }
    }
    const eff = perms || ROLE_DEFAULTS[role] || ROLE_DEFAULTS.staff;
    return eff;
  }, [user]);

  const canAccess = (id) => allowedPages.includes('*') || allowedPages.includes(id);

  const activePage = canAccess(page) ? page : (allowedPages.includes('*') ? 'sales' : (allowedPages.find(p => p !== '*') || 'profile'));

  const nav = NAV.filter(n => {
    if (n.sep) return true;
    if (n.adminOnly) return user?.role === 'admin';
    return true; // show all in sidebar, but grey out inaccessible
  });

  // Remove leading/trailing/double separators
  const cleanNav = [];
  nav.forEach((item, i) => {
    if (item.sep) {
      const prev = cleanNav[cleanNav.length - 1];
      if (!prev || prev.sep) return;
      const rest = nav.slice(i + 1).filter(x => !x.sep);
      if (!rest.length) return;
    }
    cleanNav.push(item);
  });

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage onNavigate={setPage} />;
      case 'sales': return <SalesPage />;
      case 'kot': return <KOTPage />;
      case 'orders': return <OrdersPage />;
      case 'kds': return <KDSPage />;
      case 'coupons': return <CouponsPage />;
      case 'zomato': return <ZomatoPage />;
      case 'zomatoimport': return <ZomatoImportPage />;
      case 'inventory': return <InventoryPage />;
      case 'purchaseorders': return <PurchaseOrderPage />;
      case 'vendors': return <VendorPage />;
      case 'purchases': return <PurchasesPage />;
      case 'categories': return <CategoriesPage />;
      case 'units': return <UnitsPage />;
      case 'recipes': return <RecipesPage />;
      case 'menuitems': return <MenuItemsPage />;
      case 'courses': return <CoursesPage />;
      case 'salary': return <SalaryPage />;
      case 'salarymgmt': return <SalaryMgmtPage />;
      case 'expenses': return <ExpensesPage />;
      case 'expcategories': return <ExpenseCategoryManagerPage />;
      case 'fuel': return <FuelPage />;
      case 'staff': return <StaffPage />;
      case 'reports': return <ReportsPage />;
      case 'profitloss': return <ProfitLossPage />;
      case 'pastorder': return <PastOrderPage />;
      case 'consumption': return <ConsumptionPage />;
      case 'quotation': return <QuotationPage />;
      case 'billsettings': return <BillSettingsPage />;
      case 'users': return <UsersPage />;
      case 'profile': return <ProfilePage />;
      case 'online_orders': return <OnlineOrdersPage />;
      case 'addons': return <AddonsPage />;
      default: return <SalesPage />;
    }
  };

  const rs = ROLE_STYLE[user?.role] || ROLE_STYLE.staff;

  return (
    <div>
      {/* ── New Online Order Popup ── */}
      {newOrderAlert && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9000, background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: '20px 24px', maxWidth: 320, border: '2px solid #e23744', animation: 'slideIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28 }}>🔔</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#1c1c1c' }}>New Online Order!</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Order #{newOrderAlert.order_number || newOrderAlert.id}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            <strong>Type:</strong> {(newOrderAlert.order_type || '').replace('_', ' ')} &bull; <strong>Total:</strong> ₹{Number(newOrderAlert.total || 0).toFixed(0)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '8px 0', background: '#e23744', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => { setPage('orders'); setNewOrderAlert(null); }}>
              View Orders
            </button>
            <button style={{ flex: 1, padding: '8px 0', background: '#f4f4f5', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setNewOrderAlert(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="topbar">
        <div className="tl">
          <button className="hbg" onClick={() => setSideOpen(s => !s)}>☰</button>
          <div className="tb-brand">Taste<span>za</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 14, background: isLive ? 'rgba(29,185,126,.1)' : 'rgba(232,74,95,.08)', border: `1.5px solid ${isLive ? '#1db97e' : '#e84a5f'}`, fontSize: 11, fontWeight: 700, color: isLive ? '#1db97e' : '#e84a5f' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLive ? '#1db97e' : '#e84a5f' }} />
            {isLive ? 'Live' : 'Offline'}
          </div>
          <div className="tb-page">{PAGE_TITLES[activePage] || activePage}</div>
        </div>
        <div className="tr2">
          <div className="uchip">
            <div className="av" style={{ background: avatarColor(user?.name) }}>{initials(user?.name)}</div>
            <span className="chip-name">{user?.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 14, background: rs.bg, color: rs.color }}>
              {user?.role}
            </span>
          </div>
          <button className="btn-out" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="app-body">
        <div className={`sidebar ${sideOpen ? '' : 'hidden'}`}>
          {cleanNav.map(item => {
            if (item.sep) return <div key={item.id} className="ndiv" />;
            const accessible = item.adminOnly ? user?.role === 'admin' : canAccess(item.id);
            return (
              <React.Fragment key={item.id}>
                {item.section && <div className="ns-label" style={{ marginTop: 16 }}>{item.section}</div>}
                <div
                  className={`ni ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => {
                    if (!accessible) { toast('Access restricted for your role.', 'er'); return; }
                    setPage(item.id);
                  }}
                  style={{ opacity: accessible ? 1 : 0.3, cursor: accessible ? 'pointer' : 'not-allowed' }}
                  title={accessible ? item.label : `${item.label} — No access`}
                >
                  <span className="ico">{item.icon}</span>
                  {item.label}
                  {!accessible && <span style={{ marginLeft: 'auto', fontSize: 10 }}>🔒</span>}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className={`main ${sideOpen ? '' : 'full'}`}>
          <div className="section-anim" key={activePage}>
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}