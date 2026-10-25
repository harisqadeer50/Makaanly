import api from './api';

const data = (r) => r.data.data;
const withMeta = (r) => ({ ...r.data.data, meta: r.data.meta });

export const favoritesApi = {
  list: () => api.get('/favorites').then(data),
  ids: () => api.get('/favorites/ids').then((r) => r.data.data.ids),
  add: (propertyId) => api.post(`/favorites/${propertyId}`).then(data),
  remove: (propertyId) => api.delete(`/favorites/${propertyId}`).then(data),
};

export const inquiriesApi = {
  create: (body) => api.post('/inquiries', body).then(data),
  sent: (params) => api.get('/inquiries/sent', { params }).then(withMeta),
  received: (params) => api.get('/inquiries/received', { params }).then(withMeta),
  get: (id) => api.get(`/inquiries/${id}`).then(data),
  setStatus: (id, status) => api.patch(`/inquiries/${id}/status`, { status }).then(data),
  reply: (id, message) => api.post(`/inquiries/${id}/replies`, { message }).then(data),
};

export const appointmentsApi = {
  create: (body) => api.post('/appointments', body).then(data),
  mine: (params) => api.get('/appointments/mine', { params }).then(withMeta),
  received: (params) => api.get('/appointments/received', { params }).then(withMeta),
  act: (id, body) => api.patch(`/appointments/${id}`, body).then(data),
  cancel: (id, reason) => api.patch(`/appointments/${id}/cancel`, reason ? { reason } : {}).then(data),
};

export const reportsApi = { create: (propertyId, body) => api.post(`/properties/${propertyId}/report`, body).then(data) };

export const agentsApi = {
  list: (params) => api.get('/agents', { params }).then(withMeta),
  get: (id) => api.get(`/agents/${id}`).then(data),
  saveProfile: (body) => api.patch('/agents/me/profile', body).then(data),
};

export const usersApi = {
  update: (body) => api.patch('/users/me', body).then(data),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.put('/users/me/avatar', form, { timeout: 60000 }).then(data);
  },
  removeAvatar: () => api.delete('/users/me/avatar').then(data),
  setPreferences: (body) => api.patch('/users/me/preferences', body).then(data),
};

export const notificationsApi = {
  list: (params) => api.get('/notifications', { params }).then(withMeta),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then(data),
  markAllRead: () => api.post('/notifications/read-all').then(data),
};

export const dashboardApi = { summary: () => api.get('/dashboard/summary').then(data) };
