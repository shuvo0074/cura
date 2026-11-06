const BASE = '/api';
const EXPIRY_SKEW_MS = 30_000;

let accessToken = null;
let expiresAt = 0;
let refreshing = null;

export function setAccessToken(token, expiresInSeconds = 0) {
  accessToken = token;
  expiresAt = token ? Date.now() + expiresInSeconds * 1000 : 0;
}

// Account routes stay at /api; everything else moved to /api/directory.
const urlFor = path =>
  /^\/(auth|account)(\/|$)/.test(path) ? `${BASE}${path}` : `${BASE}/directory${path}`;

// One refresh at a time: the refresh token rotates on every use.
function refreshSession() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async res => {
      if (!res.ok) {
        setAccessToken(null);
        return false;
      }
      const session = await res.json();
      setAccessToken(session.accessToken, session.expiresIn);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request(path, options = {}, canRetry = true) {
  const isSessionRoute = ['/auth/login', '/auth/logout', '/auth/refresh', '/auth/handoff/redeem'].includes(path);
  // Optional-auth routes treat an expired token as anonymous, so refresh first.
  if (!isSessionRoute && accessToken && Date.now() >= expiresAt - EXPIRY_SKEW_MS) {
    await refreshSession();
  }

  const isFormData = options.body instanceof FormData;
  const headers = {};
  if (options.body && !isFormData) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(urlFor(path), { credentials: 'include', ...options, headers });

  if (res.status === 401 && canRetry && !isSessionRoute && (await refreshSession())) {
    return request(path, options, false);
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed with ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const api = {
  get: path => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData }),
  del: path => request(path, { method: 'DELETE' }),
};
