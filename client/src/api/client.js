import { tokens } from './tokens.js';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// ---------- Single-flight refresh ----------
let refreshPromise = null;

async function doRefresh() {
  const refreshToken = tokens.getRefresh();
  if (!refreshToken) return false;

  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    tokens.clear(); // expired, revoked or reused: the session is over
    return false;
  }

  const data = await res.json();
  tokens.set(data.accessToken, data.refreshToken);
  return true;
}

// Every caller shares the SAME refresh while one is in progress
function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ---------- The one function every page uses ----------
export async function api(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const accessToken = tokens.getAccess();
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Expired or missing access token: refresh once, then retry once
  if (res.status === 401 && auth && retry && tokens.getRefresh()) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return api(path, { method, body, auth, retry: false });
    }
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.details);
  }
  return data;
}