import api from './api';

const data = (r) => r.data.data;
export const authApi = {
  me: () => api.get('/auth/me').then(data),
  login: (body) => api.post('/auth/login', body).then(data),
  register: (body) => api.post('/auth/register', body).then(data),
  logout: () => api.post('/auth/logout').then(data),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }).then(data),
  resendVerification: () => api.post('/auth/resend-verification').then(data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then(data),
  changePassword: (body) => api.post('/auth/change-password', body).then(data),
  logoutAll: () => api.post('/auth/logout-all').then(data),
  resetPassword: (body) => api.post('/auth/reset-password', body).then(data),
};
