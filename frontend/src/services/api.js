import axios from 'axios';

// In production (Vercel) VITE_API_URL = https://your-backend.onrender.com
// In development Vite proxy forwards /api → localhost:5000
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
          const newToken = data.data.access_token;
          localStorage.setItem('access_token', newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsAPI = {
  getAll: (params) => api.get('/documents', { params }),
  getOne: (id) => api.get(`/documents/${id}`),
  upload: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  search: (q) => api.get('/documents/search', { params: { q } }),
  grantAccess: (id, data) => api.post(`/documents/${id}/permissions`, data),
  revokeAccess: (id, userId) => api.delete(`/documents/${id}/permissions/${userId}`),
  getPermissions: (id) => api.get(`/documents/${id}/permissions`),
};

// ── Viewer ────────────────────────────────────────────────────────────────────
export const viewerAPI = {
  startSession: (documentId) => api.post('/viewer/session', { documentId }),
  getPageUrl: (pageNumber, sessionToken) =>
    `/api/viewer/page/${pageNumber}?session_token=${encodeURIComponent(sessionToken)}`,
  endSession: (sessionToken) =>
    api.post('/viewer/session/end', {}, { headers: { 'x-session-token': sessionToken } }),
  getSessionInfo: (sessionToken) =>
    api.get('/viewer/session/info', { headers: { 'x-session-token': sessionToken } }),
  reportDownload: (sessionToken, type) =>
    api.post('/viewer/report/download', { type }, { headers: { 'x-session-token': sessionToken } }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getAll: () => api.get('/users'),
  getOne: (id) => api.get(`/users/${id}`),
  block: (id) => api.post(`/users/${id}/block`),
  unblock: (id) => api.post(`/users/${id}/unblock`),
  delete: (id) => api.delete(`/users/${id}`),
  getActivity: (id) => api.get(`/users/${id}/activity`),
};

// ── Security (admin) ──────────────────────────────────────────────────────────
export const securityAPI = {
  getEvents: (params) => api.get('/security/events', { params }),
  getStats: () => api.get('/security/stats'),
  getAlerts: (status) => api.get('/security/alerts', { params: { status } }),
  updateAlert: (id, data) => api.put(`/security/alerts/${id}`, data),
  getAssessments: () => api.get('/security/assessments'),
  getLogs: (params) => api.get('/security/logs', { params }),
};

export default api;
