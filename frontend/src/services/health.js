import api from './api';
export const getHealth = () => api.get('/health').then((r) => r.data.data);
