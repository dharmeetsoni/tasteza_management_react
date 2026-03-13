/**
 * Tasteza API — Offline-aware
 *
 * GET requests:  network first → IndexedDB cache fallback
 * POST/PUT/DELETE: network first → IndexedDB queue on failure
 *
 * Only critical POS operations are queued offline (orders, KOTs, payments).
 * Admin/config operations show an error when offline.
 */
import axios from 'axios';
import { queuePush, cacheSet, cacheGet } from '../offlineQueue';

const BASE = '/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('tasteza_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Offline-aware GET ─────────────────────────────────────
async function oGet(path, params) {
  const cacheKey = path + (params ? '?' + new URLSearchParams(params).toString() : '');
  try {
    const r = await api.get(path, params ? { params } : {});
    // Cache successful responses for offline use
    if (r.data?.success !== false) {
      cacheSet(cacheKey, r.data).catch(() => {});
    }
    return r.data;
  } catch (err) {
    if (!navigator.onLine || isNetworkError(err)) {
      const cached = await cacheGet(cacheKey);
      if (cached) return { ...cached, _fromCache: true };
    }
    throw err;
  }
}

// ── Offline-aware mutation (POST/PUT/DELETE) ──────────────
// queueable = true means: store in IndexedDB and retry when back online
async function oMutate(method, path, body, queueable = false) {
  try {
    // axios.delete doesn't accept body as 2nd arg — must use { data: body }
    const r = method === 'delete'
      ? await api.delete(path, { data: body })
      : await api[method](path, body);
    return r.data;
  } catch (err) {
    if (queueable && (isNetworkError(err) || !navigator.onLine)) {
      // Sanitise body through JSON round-trip to strip any non-clonable values
      // (e.g. DOM events accidentally passed as arguments)
      let safeBody;
      try { safeBody = JSON.parse(JSON.stringify(body ?? null)); } catch { safeBody = null; }
      const id = await queuePush({
        url:    BASE + path,
        method: method.toUpperCase(),
        body:   safeBody,
      });
      window.dispatchEvent(new Event('tasteza-queued'));
      // Return optimistic response so UI doesn't break
      return { success: true, _queued: true, _queueId: id, data: { id: `q_${id}`, ...body } };
    }
    throw err;
  }
}

function isNetworkError(err) {
  return !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED';
}

// ── Auth ──────────────────────────────────────────────────
export const login  = (phone, password) => api.post('/auth/login', { phone, password }).then(r => r.data);
export const getMe  = ()                 => api.get('/auth/me').then(r => r.data);
export const logout = ()                 => api.post('/auth/logout').then(r => r.data);

// ── Users ─────────────────────────────────────────────────
export const getUsers         = ()           => oGet('/users');
export const createUser       = (d)          => oMutate('post',   '/users', d);
export const updateUser       = (id, d)      => oMutate('put',    `/users/${id}`, d);
export const deleteUser       = (id)         => oMutate('delete', `/users/${id}`);
export const changePassword   = (id, pw)     => oMutate('patch',  `/users/${id}/password`, { password: pw });
export const getLogs          = ()           => oGet('/users/logs/all');
export const resetUserPassword= (id, pw)     => oMutate('patch',  `/users/${id}/password`, { password: pw });

// ── Categories ────────────────────────────────────────────
export const getCategories    = ()           => oGet('/categories');
export const createCategory   = (d)          => oMutate('post',   '/categories', d);
export const updateCategory   = (id, d)      => oMutate('put',    `/categories/${id}`, d);
export const deleteCategory   = (id)         => oMutate('delete', `/categories/${id}`);

// ── Units ─────────────────────────────────────────────────
export const getUnits         = ()           => oGet('/units');
export const createUnit       = (d)          => oMutate('post',   '/units', d);
export const updateUnit       = (id, d)      => oMutate('put',    `/units/${id}`, d);
export const deleteUnit       = (id)         => oMutate('delete', `/units/${id}`);

// ── Inventory ─────────────────────────────────────────────
export const getInventory         = ()       => oGet('/inventory');
export const createInventoryItem  = (d)      => oMutate('post',   '/inventory', d);
export const updateInventoryItem  = (id, d)  => oMutate('put',    `/inventory/${id}`, d);
export const deleteInventoryItem  = (id)     => oMutate('delete', `/inventory/${id}`);
export const adjustStock          = (id, d)  => oMutate('post',   `/inventory/${id}/adjust`, d);
export const getPurchases         = ()       => oGet('/inventory/purchases/all');
export const getItemPurchases     = (id)     => oGet(`/inventory/${id}/purchases`);
export const createPurchase       = (d)      => oMutate('post',   '/inventory/purchases', d);

// ── Recipes ───────────────────────────────────────────────
export const getRecipes            = ()      => oGet('/recipes');
export const getRecipeIngredients  = (id)    => oGet(`/recipes/${id}/ingredients`);
export const createRecipe          = (d)     => oMutate('post',   '/recipes', d);
export const updateRecipe          = (id, d) => oMutate('put',    `/recipes/${id}`, d);
export const deleteRecipe          = (id)    => oMutate('delete', `/recipes/${id}`);
export const toggleRecipe          = (id, v) => oMutate('patch',  `/recipes/${id}/toggle`, { is_active: v });

// ── Courses ───────────────────────────────────────────────
export const getCourses     = ()           => oGet('/courses');
export const createCourse   = (d)          => oMutate('post',   '/courses', d);
export const updateCourse   = (id, d)      => oMutate('put',    `/courses/${id}`, d);
export const deleteCourse   = (id)         => oMutate('delete', `/courses/${id}`);
export const toggleCourse   = (id, v)      => oMutate('patch',  `/courses/${id}/toggle`, { is_active: v });

// ── Salaries ──────────────────────────────────────────────
export const getSalaries    = ()           => oGet('/salaries');
export const createSalary   = (d)          => oMutate('post',   '/salaries', d);
export const updateSalary   = (id, d)      => oMutate('put',    `/salaries/${id}`, d);
export const deleteSalary   = (id)         => oMutate('delete', `/salaries/${id}`);

// ── Fuels ─────────────────────────────────────────────────
export const getFuels       = ()           => oGet('/fuels');
export const createFuel     = (d)          => oMutate('post',   '/fuels', d);
export const updateFuel     = (id, d)      => oMutate('put',    `/fuels/${id}`, d);
export const deleteFuel     = (id)         => oMutate('delete', `/fuels/${id}`);

// ── Menu Items ────────────────────────────────────────────
export const getMenuItems    = ()          => oGet('/menuitems');
export const getMenuItemsAll = ()          => oGet('/menuitems/all');
export const createMenuItem  = (d)         => oMutate('post',   '/menuitems', d);
export const updateMenuItem  = (id, d)     => oMutate('put',    `/menuitems/${id}`, d);
export const deleteMenuItem  = (id)        => oMutate('delete', `/menuitems/${id}`);
export const toggleMenuItem  = (id, v)     => oMutate('patch',  `/menuitems/${id}/toggle`, { is_active: v });

// ── Purchase Orders ───────────────────────────────────────
export const getPurchaseOrders    = ()       => oGet('/purchaseorders');
export const getPurchaseOrder     = (id)     => oGet(`/purchaseorders/${id}`);
export const createPurchaseOrder  = (d)      => oMutate('post',  '/purchaseorders', d);
export const updatePurchaseOrder  = (id, d)  => oMutate('put',   `/purchaseorders/${id}`, d);
export const receivePurchaseOrder = (id, d)  => oMutate('post',  `/purchaseorders/${id}/receive`, d);
export const cancelPurchaseOrder  = (id)     => oMutate('patch', `/purchaseorders/${id}/cancel`);
export const deletePurchaseOrder  = (id)     => oMutate('delete',`/purchaseorders/${id}`);

// ── Tables ────────────────────────────────────────────────
export const getTables      = ()           => oGet('/tables');
export const createTable    = (d)          => oMutate('post',   '/tables', d);
export const updateTable    = (id, d)      => oMutate('put',    `/tables/${id}`, d);
export const deleteTable    = (id)         => oMutate('delete', `/tables/${id}`);

// ── Coupons ───────────────────────────────────────────────
export const getCoupons      = ()          => oGet('/coupons');
export const validateCoupon  = (d)         => oMutate('post', '/coupons/validate', d);
export const createCoupon    = (d)         => oMutate('post',   '/coupons', d);
export const updateCoupon    = (id, d)     => oMutate('put',    `/coupons/${id}`, d);
export const deleteCoupon    = (id)        => oMutate('delete', `/coupons/${id}`);

// ── Orders — QUEUEABLE (critical POS operations) ─────────
export const getOrders         = ()       => oGet('/orders');
export const getOrder          = (id)     => oGet(`/orders/${id}`);
export const createOrder       = (d)      => oMutate('post',  '/orders', d,           true);
export const createPastOrder   = (d)      => oMutate('post',  '/orders/past', d);
export const updateOrderItems  = (id, d)  => oMutate('put',   `/orders/${id}/items`, d, true);
export const sendKOT           = (id, d)  => oMutate('post',  `/orders/${id}/kot`, d, true);
export const generateBill      = (id, d)  => oMutate('post',  `/orders/${id}/bill`, d, true);
export const markPaid          = (id, d)  => oMutate('post',  `/orders/${id}/pay`, d,  true);
export const cancelOrder       = (id)     => oMutate('post',  `/orders/${id}/cancel`);
export const deleteOrder       = (id)     => oMutate('delete',`/orders/${id}`);
export const editOrder         = (id, d)  => oMutate('patch', `/orders/${id}/edit`, d);
export const getOrdersList     = (p)      => oGet('/orders/all/list', p);

// ── Item-level edit (post-KOT corrections) ────────────────────────────────────
export const updateOrderItem   = (orderId, itemId, d) => oMutate('patch',  `/orders/${orderId}/items/${itemId}`, d);
export const deleteOrderItem   = (orderId, itemId)    => oMutate('delete', `/orders/${orderId}/items/${itemId}`);
export const reKot             = (orderId, d)         => oMutate('post',   `/orders/${orderId}/reKot`, d);

// ── KOT — QUEUEABLE ───────────────────────────────────────
export const getKOTs          = (p)       => oGet('/kot', p);
export const getKOT           = (id)      => oGet(`/kot/${id}`);
export const updateKOTStatus  = (id, st)  => oMutate('patch', `/kot/${id}/status`, { status: st }, true);
export const deleteKOT        = (id)       => oMutate('delete', `/kot/${id}`);

// ── Zomato ────────────────────────────────────────────────
export const getZomatoSettings  = ()      => oGet('/zomato/settings');
export const saveZomatoSettings = (d)     => oMutate('put',    '/zomato/settings', d);
export const getZomatoMenu      = ()      => oGet('/zomato/menu');
export const getZomatoAvailable = ()      => oGet('/zomato/available-items');
export const addZomatoItem      = (d)     => oMutate('post',   '/zomato/menu', d);
export const bulkAddZomato      = (d)     => oMutate('post',   '/zomato/menu/bulk', d);
export const updateZomatoItem   = (id, d) => oMutate('put',    `/zomato/menu/${id}`, d);
export const removeZomatoItem   = (id)    => oMutate('delete', `/zomato/menu/${id}`);

// ── Staff ─────────────────────────────────────────────────
export const getStaff          = ()          => oGet('/staff');
export const updateStaff       = (id, d)     => oMutate('put',    `/staff/${id}`, d);
export const getStaffSalary    = (id, mth)   => oGet(`/staff/${id}/salary/${mth}`);
export const getStaffAdvances  = (id)        => oGet(`/staff/${id}/advances`);
export const addAdvance        = (id, d)     => oMutate('post',   `/staff/${id}/advances`, d);
export const deductAdvance     = (advId)     => oMutate('patch',  `/staff/advances/${advId}/deduct`);
export const deleteAdvance     = (advId)     => oMutate('delete', `/staff/advances/${advId}`);
export const getAdjustments    = (id, mth)   => oGet(`/staff/${id}/adjustments/${mth}`);
export const saveAdjustments   = (id, d)     => oMutate('post',   `/staff/${id}/adjustments`, d);

// ── Reports ───────────────────────────────────────────────
export const getSalesReport      = (p)    => oGet('/reports/sales', p);
export const getItemsReport      = (p)    => oGet('/reports/items', p);
export const getPnLReport        = (p)    => oGet('/reports/pnl', p);
export const getCustomersReport  = (p)    => oGet('/reports/customers', p);
export const getPaymentsReport   = (p)    => oGet('/reports/payments', p);
export const getDiscountsReport  = (p)    => oGet('/reports/discounts', p);
export const getSalaryReport     = (p)    => oGet('/reports/salary-report', p);
export const getFixedCosts       = (p)    => oGet('/reports/fixed-costs', p);
export const getDailyPnl          = (p)    => oGet('/reports/daily-pnl', p);
export const getManualSales       = (p)    => oGet('/reports/manual-sales', p);
export const addManualSale        = (d)    => oMutate('post',   '/reports/manual-sales', d);
export const updateManualSale     = (id,d) => oMutate('put',    `/reports/manual-sales/${id}`, d);
export const deleteManualSale     = (id)   => oMutate('delete', `/reports/manual-sales/${id}`);
export const addFixedCost        = (d)    => oMutate('post',   '/reports/fixed-costs', d);
export const updateFixedCost     = (id,d) => oMutate('put',    `/reports/fixed-costs/${id}`, d);
export const deleteFixedCost     = (id)   => oMutate('delete', `/reports/fixed-costs/${id}`);
export const getRolePermissions  = ()     => oGet('/reports/role-permissions');
export const saveRolePermissions = (r, p) => oMutate('put', `/reports/role-permissions/${r}`, { permissions: p });
export const resetAllData        = (sel)    => oMutate('delete', '/reports/reset-data', sel);
// Inventory reports
export const getInventorySummary     = ()  => oGet('/reports/inventory/summary');
export const getInventoryMovements   = (p) => oGet('/reports/inventory/movements', p);
export const getInventoryConsumption = (p) => oGet('/reports/inventory/consumption', p);

// ── Dashboard ─────────────────────────────────────────────
export const getDashboard = () => oGet('/reports/dashboard');

// ── Settings ──────────────────────────────────────────────
export const getSettings  = ()  => oGet('/settings');
export const saveSettings = (d) => oMutate('put', '/settings', d);

// ── Salary Management ─────────────────────────────────────
export const getSalarySummary     = (month)     => oGet('/salary-mgmt/summary', { month });
export const getStaffSalaryDetail = (uid, mth)  => oGet(`/salary-mgmt/${uid}/${mth}`);
export const settleSalary         = (d)         => oMutate('post', '/salary-mgmt/settle', d);
export const getAllSettlements     = (p)         => oGet('/salary-mgmt/settlements/all', p);
export const getAllAdvances        = (p)         => oGet('/salary-mgmt/advances/all', p);
export const addAdvanceSalary     = (d)         => oMutate('post', '/salary-mgmt/advances', d);
export const deleteAdvanceSalary  = (id)        => oMutate('delete', `/salary-mgmt/advances/${id}`);

// ── Expenses ──────────────────────────────────────────────
export const getExpenses          = (p)    => oGet('/expenses', p);
export const getExpenseSummary    = (p)    => oGet('/expenses/summary', p);
export const getExpenseCategories    = ()      => oGet('/expenses/categories');
export const createExpenseCategory  = (d)     => oMutate('post',   '/expenses/categories', d);
export const updateExpenseCategory  = (id, d) => oMutate('put',    `/expenses/categories/${id}`, d);
export const deleteExpenseCategory  = (id)    => oMutate('delete', `/expenses/categories/${id}`);
export const createExpense        = (d)    => oMutate('post',   '/expenses', d);
export const updateExpense        = (id,d) => oMutate('put',    `/expenses/${id}`, d);
export const deleteExpense        = (id)   => oMutate('delete', `/expenses/${id}`);

// Quotations
export const getQuotations    = (p)    => oGet('/quotations', p);
export const getQuotation     = (id)   => oGet(`/quotations/${id}`);
export const createQuotation  = (d)    => oMutate('post',   '/quotations', d);
export const updateQuotation  = (id,d) => oMutate('put',    `/quotations/${id}`, d);
export const deleteQuotation  = (id)   => oMutate('delete', `/quotations/${id}`);

// Manage bill (change items/date on paid order)
export const manageBill       = (id,d) => oMutate('put',    `/orders/${id}/manage`, d);

// Daily category consumption
export const getDailyCategoryConsumption = (p) => oGet('/reports/inventory/daily-category', p);

