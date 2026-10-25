import api from './api';

const data = (r) => r.data.data;
const withMeta = (r) => ({ ...r.data.data, meta: r.data.meta });

export const propertiesApi = {
  list: (params) => api.get('/properties', { params }).then(withMeta),
  locations: (city) => api.get('/properties/locations', { params: city ? { city } : {} }).then(data),
  get: (idOrSlug) => api.get(`/properties/${idOrSlug}`).then(data),
  similar: (idOrSlug) => api.get(`/properties/${idOrSlug}/similar`).then(data),
  mine: (params) => api.get('/properties/mine', { params }).then(withMeta),
  summary: () => api.get('/properties/mine/summary').then(data),
  getManaged: (id) => api.get(`/properties/mine/${id}`).then(data),
  create: (body) => api.post('/properties', body).then(data),
  update: (id, body) => api.patch(`/properties/${id}`, body).then(data),
  setStatus: (id, status, reason) => api.patch(`/properties/${id}/status`, { status, reason }).then(data),
  remove: (id) => api.delete(`/properties/${id}`).then(data),

  // Photos. One request per photo, so each one gets its own progress bar and can be retried on its own.
  uploadImage: (id, file, onProgress) => {
    const form = new FormData();
    form.append('images', file);
    return api.post(`/properties/${id}/images`, form, {
      timeout: 120000,
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }).then(data);
  },
  removeImage: (id, imageId) => api.delete(`/properties/${id}/images/${imageId}`).then(data),
  updateImages: (id, body) => api.patch(`/properties/${id}/images`, body).then(data),
};
