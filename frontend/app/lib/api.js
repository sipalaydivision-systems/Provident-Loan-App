import axios from 'axios';

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance with base config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
};

// Employee endpoints (public)
export const employeeAPI = {
  search: (searchData) => api.post('/employee/search', searchData),
  lookup: (employeeNumber, lastName) => api.get(`/employee/lookup/${encodeURIComponent(employeeNumber)}`, { params: { last_name: lastName } }),
  searchByName: (nameData) => api.post('/employee/search-by-name', nameData),
  getLedger: (employeeNumber, lastName) => api.get(`/employee/ledger/${encodeURIComponent(employeeNumber)}`, { params: { last_name: lastName } }),
  getStatement: (employeeNumber, lastName) => api.get(`/employee/statement/${encodeURIComponent(employeeNumber)}`, { params: { last_name: lastName } }),
  help: () => api.get('/employee/help'),
  contact: () => api.get('/employee/contact'),
};

// Admin endpoints
export const adminAPI = {
  employees: {
    getAll: (params) => api.get('/admin/employees', { params }),
    getOne: (employeeNumber) => api.get(`/admin/employees/${employeeNumber}`),
    create: (data) => api.post('/admin/employees', data),
    update: (employeeNumber, data) => api.put(`/admin/employees/${employeeNumber}`, data),
    delete: (employeeNumber) => api.delete(`/admin/employees/${employeeNumber}`),
  },
  loans: {
    getAll: (params) => api.get('/admin/loans', { params }),
    getOne: (loanId) => api.get(`/admin/loans/${loanId}`),
    create: (data) => api.post('/admin/loans', data),
    update: (loanId, data) => api.put(`/admin/loans/${loanId}`, data),
    delete: (loanId) => api.delete(`/admin/loans/${loanId}`),
  },
  ledger: {
    getAll: (params) => api.get('/admin/ledger', { params }),
    recordPayment: (data) => api.post('/admin/ledger/record-payment', data),
    update: (entryId, data) => api.put(`/admin/ledger/${entryId}`, data),
    delete: (entryId) => api.delete(`/admin/ledger/${entryId}`),
    bulkDelete: (ids) => api.delete('/admin/ledger/bulk', { data: { ids } }),
  },
  employeeLedger: {
    get: (employeeNumber) => api.get(`/admin/employees/${employeeNumber}/ledger`),
  },
  dashboard: {
    getSummary: () => api.get('/admin/dashboard/summary'),
  },
  report: {
    getLoanSummary: () => api.get('/admin/report/loan-summary'),
    getCsvUrl: () => `${API_BASE_URL}/admin/report/loan-summary/csv`,
  },
};

// Import endpoint
export const importAPI = {
  importFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;

// ── Ledger-card system (Accounting) ───────────────────────────────────────────
export const ledgerAPI = {
  overview: () => api.get('/admin/overview'),
  recalculate: () => api.post('/admin/recalculate'),
  card: (employeeNumber) => api.get(`/admin/ledger-cards/${encodeURIComponent(employeeNumber)}`),
  loanCard: (loanId) => api.get(`/admin/loans/${loanId}/card`),
  addEntry: (loanId, data) => api.post(`/admin/loans/${loanId}/entries`, data),
  updateEntry: (id, data) => api.put(`/admin/entries/${id}`, data),
  deleteEntry: (id) => api.delete(`/admin/entries/${id}`),
  summary: (params) => api.get('/admin/summary', { params }),
  payroll: (period) => api.get(`/admin/payroll/${period}`),
  postPayroll: (period, data) => api.post(`/admin/payroll/${period}/post`, data),
  uploadPayroll: (period, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/payroll/${period}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  report: (kind, params) => api.get(`/admin/reports/${kind}`, { params }),
  settings: () => api.get('/admin/settings'),
  saveSettings: (data) => api.put('/admin/settings', data),
  addMoratorium: (data) => api.post('/admin/moratoria', data),
  deleteMoratorium: (id) => api.delete(`/admin/moratoria/${id}`),
  previewWorkbook: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/admin/import/ledger-workbook/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  importWorkbook: (file, replace) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('replace', replace ? 'true' : 'false');
    return api.post('/admin/import/ledger-workbook', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 });
  },
  applications: (params) => api.get('/admin/applications', { params }),
  application: (id) => api.get(`/admin/applications/${id}`),
  evaluateApplication: (data) => api.post('/admin/applications/evaluate', data),
  createApplication: (data) => api.post('/admin/applications', data),
  applicationAction: (id, data) => api.post(`/admin/applications/${id}/action`, data),
  portalCode: (employeeNumber) => api.post(`/admin/employees/${encodeURIComponent(employeeNumber)}/portal-code`),
  portalDisable: (employeeNumber) => api.post(`/admin/employees/${encodeURIComponent(employeeNumber)}/portal-disable`),
};

/** Download an authenticated Excel export (summary or report). */
export async function downloadExport(path, filename) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Employee portal (separate session from the admin) ─────────────────────────
const portal = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });
portal.interceptors.request.use((config) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('portal_token') : null;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
portal.interceptors.response.use((r) => r, (error) => {
  if (error.response?.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/employee') {
    localStorage.removeItem('portal_token');
    window.location.href = '/employee';
  }
  return Promise.reject(error);
});
export const portalAPI = {
  activate: (data) => portal.post('/portal/activate', data),
  login: (data) => portal.post('/portal/login', data),
  me: () => portal.get('/portal/me'),
  notifications: () => portal.get('/portal/me/notifications'),
  markRead: () => portal.post('/portal/me/notifications/read'),
  applications: () => portal.get('/portal/me/applications'),
  previewApplication: (data) => portal.post('/portal/me/applications/preview', data),
  apply: (data) => portal.post('/portal/me/applications', data),
  cancelApplication: (id) => portal.post(`/portal/me/applications/${id}/cancel`),
  coMakerRequests: () => portal.get('/portal/me/co-maker'),
  coMakerDecision: (id, decision) => portal.post(`/portal/me/co-maker/${id}`, { decision }),
  calculator: (data) => portal.post('/portal/calculator', data),
  changePassword: (data) => portal.post('/portal/change-password', data),
};
