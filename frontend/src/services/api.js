import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // HTTP-only auth cookies
  timeout: 20000,
});

// ---- CSRF: token comes from GET /auth/csrf and is kept in memory (cookies on another domain are unreadable) ----
let csrfToken = null;
let csrfPromise = null;
const SAFE = ['get', 'head', 'options'];

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  csrfPromise ||= axios
    .get(`${api.defaults.baseURL}/auth/csrf`, { withCredentials: true })
    .then((r) => { csrfToken = r.data.data.csrfToken; return csrfToken; })
    .finally(() => { csrfPromise = null; });
  return csrfPromise;
}

api.interceptors.request.use(async (config) => {
  if (!SAFE.includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = await ensureCsrf();
  }
  return config;
});

// ---- Silent session refresh (single-flight) ----
let refreshPromise = null;
const refreshSession = () => {
  refreshPromise ||= api.post('/auth/refresh').finally(() => { refreshPromise = null; });
  return refreshPromise;
};
const NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/csrf', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email', '/auth/logout'];

const normalize = (error) => {
  const data = error.response?.data;
  return {
    status: error.response?.status ?? 0,
    code: data?.code ?? (error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR'),
    message: data?.message ?? (error.response ? 'Request failed' : 'Cannot reach the server. Check your connection and try again.'),
    errors: data?.errors ?? [],
  };
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config } = error;
    const data = error.response?.data;

    // Stale CSRF token: fetch a new one and retry once.
    if (config && !config._csrfRetried && data?.code === 'CSRF_INVALID') {
      csrfToken = null;
      config._csrfRetried = true;
      return api(config);
    }

    // Expired access token: refresh once, then replay the request.
    const retryable = ['TOKEN_EXPIRED', 'UNAUTHENTICATED'].includes(data?.code);
    if (config && !config._refreshed && retryable && !NO_RETRY.some((p) => config.url?.includes(p))) {
      config._refreshed = true;
      try {
        await refreshSession();
        return api(config);
      } catch (refreshErr) {
        if (normalize(refreshErr).code === 'SESSION_EXPIRED') window.dispatchEvent(new Event('auth:expired'));
        return Promise.reject(normalize(error));
      }
    }
    return Promise.reject(normalize(error));
  },
);

export default api;
