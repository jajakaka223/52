import axios from 'axios';
import { API_BASE_URL } from './api';

const api = axios.create({ baseURL: API_BASE_URL });

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут
const REQUEST_DEBOUNCE_MS = 300; // 300мс дебаунсинг

// Дебаунсинг запросов
const pendingRequests = new Map();

function cacheKey(config) {
  const url = config.baseURL ? config.baseURL + (config.url || '') : (config.url || '');
  const params = config.params ? JSON.stringify(config.params) : '';
  return `http_cache_v1:${url}?${params}`;
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (token && !config.headers?.Authorization) {
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
    }
    
    // Дебаунсинг для GET запросов
    const method = (config.method || 'get').toLowerCase();
    if (method === 'get') {
      const key = cacheKey(config);
      if (pendingRequests.has(key)) {
        clearTimeout(pendingRequests.get(key));
      }
      
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          pendingRequests.delete(key);
          resolve(config);
        }, REQUEST_DEBOUNCE_MS);
        pendingRequests.set(key, timeoutId);
      });
    }
  } catch (_) {}
  return config;
});

api.interceptors.response.use(async (response) => {
  try {
    const method = (response.config.method || 'get').toLowerCase();
    if (method === 'get') {
      const key = cacheKey(response.config);
      const payload = { ts: Date.now(), data: response.data };
      localStorage.setItem(key, JSON.stringify(payload));
    }
  } catch (_) {}
  return response;
}, async (error) => {
  const config = error?.config || {};
  config.__retryCount = config.__retryCount || 0;
  const maxRetries = 3;
  if (config.__retryCount < maxRetries) {
    config.__retryCount += 1;
    const delay = 300 * Math.pow(2, config.__retryCount - 1);
    await sleep(delay);
    return api(config);
  }
  // после ретраев: пытаться отдать кэш, если GET
  try {
    const method = (config.method || 'get').toLowerCase();
    if (method === 'get') {
      const key = cacheKey(config);
      const raw = localStorage.getItem(key);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts <= CACHE_TTL_MS) {
          return Promise.resolve({ data, status: 200, statusText: 'OK (stale-cache)', headers: { 'x-cache': 'stale' }, config, request: null });
        }
      }
    }
  } catch (_) {}
  return Promise.reject(error);
});

export default api;

export function invalidateGetCache(url, params) {
  try {
    const cfg = { baseURL: api.defaults.baseURL || '', url, params };
    const key = cacheKey(cfg);
    localStorage.removeItem(key);
  } catch (_) {}
}



