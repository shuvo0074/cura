const BASE = '/api';

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: (options.body && !isFormData) ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed with ${res.status}`);
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
