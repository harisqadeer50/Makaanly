import api from './api';

const data = (r) => r.data.data;
const withMeta = (r) => ({ ...r.data.data, meta: r.data.meta });

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard').then(data),
  users: (params) => api.get('/admin/users', { params }).then(withMeta),
  setUserStatus: (id, body) => api.patch(`/admin/users/${id}/status`, body).then(data),
  properties: (params) => api.get('/admin/properties', { params }).then(withMeta),
  pending: (params) => api.get('/admin/properties/pending', { params }).then(withMeta),
  moderate: (id, body) => api.patch(`/admin/properties/${id}/moderation`, body).then(data),
  setFeatured: (id, isFeatured) => api.patch(`/admin/properties/${id}/featured`, { isFeatured }).then(data),
  reports: (params) => api.get('/admin/reports', { params }).then(withMeta),
  updateReport: (id, body) => api.patch(`/admin/reports/${id}`, body).then(data),
  verifications: (params) => api.get('/admin/verifications', { params }).then(withMeta),
  documentLink: (id, docId) => api.get(`/admin/verifications/${id}/documents/${docId}`).then(data),
  decideVerification: (id, body) => api.patch(`/admin/verifications/${id}`, body).then(data),
  auditLogs: (params) => api.get('/admin/audit-logs', { params }).then(withMeta),
  categories: () => api.get('/admin/categories').then(data),
  updateCategory: (key, body) => api.patch(`/admin/categories/${key}`, body).then(data),
};

export const verificationApi = {
  me: () => api.get('/verification/me').then(data),
  submit: (message, files) => {
    const form = new FormData();
    if (message) form.append('message', message);
    files.forEach((f) => form.append('documents', f));
    return api.post('/verification', form, { timeout: 120000 }).then(data);
  },
};

export const categoriesApi = { list: () => api.get('/categories').then((r) => r.data.data.categories) };
