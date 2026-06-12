let currentBase = '/api/proxy/emu';
let currentAuthHeaders: Record<string, string> = {};
let handler401: (() => void) | null = null;

export function setApiBase(base: string) {
  currentBase = base;
}

export function setBasicAuth(username: string, password: string) {
  currentAuthHeaders = { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
}

export function setTokenAuth(token: string) {
  currentAuthHeaders = { 'X-Auth-Token': token };
}

export function clearAuth() {
  currentAuthHeaders = {};
}

export function getAuthHeaders(): Record<string, string> {
  return { ...currentAuthHeaders };
}

export function set401Handler(fn: (() => void) | null) {
  handler401 = fn;
}

async function apiFetch(path: string, options?: RequestInit) {
  const url = `${currentBase}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...currentAuthHeaders,
      ...(options?.headers as Record<string, string>),
    },
  });
  if (res.status === 401) {
    handler401?.();
    throw new Error('Unauthorized');
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

export const apiGet = (path: string) => apiFetch(path);

export const apiPatch = (path: string, body: unknown) =>
  apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const apiPost = (path: string, body: unknown) =>
  apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const apiPut = (path: string, body: unknown) =>
  apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const apiDelete = (path: string) =>
  apiFetch(path, { method: 'DELETE' });
