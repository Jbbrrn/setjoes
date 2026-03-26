import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  login: ({ username, password }) => api.post('/auth/login', { username, password }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
  }
};

export const products = {
  getAll: () => api.get('/products'),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  remove: (id) => api.delete(`/products/${id}`),
  getRecipe: (id) => api.get(`/products/${id}/recipe`),
  saveRecipe: (id, data) => api.put(`/products/${id}/recipe`, data),
  toggleActive: (id) => api.post(`/products/${id}/toggle-active`)
};

export const orders = {
  create: (orderData) => api.post('/orders', orderData),
  voidOrder: (id) => api.post(`/orders/${id}/void`)
};

export const inventory = {
  getIngredients: () => api.get('/inventory/ingredients'),
  getFinishedGoods: () => api.get('/inventory/finished-goods'),
  getLowStock: () => api.get('/inventory/low-stock'),
  adjustStock: (data) => api.post('/inventory/adjust', data)
};

export const reports = {
  getSummary: (date) => api.get('/reports/summary', { params: { date } }),
  getSalesChart: (startDate, endDate) =>
    api.get('/reports/sales-chart', { params: { start_date: startDate, end_date: endDate } }),
  getTopProducts: (date, limit = 10) => api.get('/reports/top-products', { params: { date, limit } }),
  getPaymentBreakdown: (date) => api.get('/reports/payment-breakdown', { params: { date } }),
  exportCSV: (startDate, endDate) =>
    api.get('/reports/export-csv', { params: { start_date: startDate, end_date: endDate }, responseType: 'blob' })
};

export const users = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`)
};

const apiService = {
  client: api,
  auth,
  products,
  orders,
  inventory,
  reports,
  users
};

export default apiService;

