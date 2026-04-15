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
  lookup: (employeeNumber) => api.get(`/employee/lookup/${employeeNumber}`),
  searchByName: (nameData) => api.post('/employee/search-by-name', nameData),
  getLedger: (employeeNumber) => api.get(`/employee/ledger/${employeeNumber}`),
  getStatement: (employeeNumber) => api.get(`/employee/statement/${employeeNumber}`),
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
