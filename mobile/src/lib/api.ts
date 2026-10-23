import * as SecureStore from 'expo-secure-store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'http://10.0.2.2:8080';

const K = { access: 'bp_access', refresh: 'bp_refresh' };

export const tokens = {
  get: async () => ({ access: await SecureStore.getItemAsync(K.access), refresh: await SecureStore.getItemAsync(K.refresh) }),
  set: async (access: string, refresh: string) => {
    await SecureStore.setItemAsync(K.access, access);
    await SecureStore.setItemAsync(K.refresh, refresh);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(K.access);
    await SecureStore.deleteItemAsync(K.refresh);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function raw(path: string, init: RequestInit, access?: string | null): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

let onSessionExpired: (() => void) | null = null;
/** Called when the server says the saved session is no longer valid (a month without use, or logged out elsewhere). */
export const setSessionExpiredHandler = (fn: (() => void) | null) => { onSessionExpired = fn; };

async function refreshTokens(): Promise<string | null> {
  const { refresh } = await tokens.get();
  if (!refresh) return null;
  try {
    const res = await raw('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: refresh }) });
    // Only an answer from the server counts: being offline or a server error never logs anyone out.
    if (res.status === 401 || res.status === 403) { await tokens.clear(); onSessionExpired?.(); return null; }
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    await tokens.set(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  let { access } = auth ? await tokens.get() : { access: null };
  let res: Response;
  try {
    res = await raw(`/api/v1${path}`, init, access);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  if (res.status === 401 && auth) {
    access = await refreshTokens();
    if (access) res = await raw(`/api/v1${path}`, init, access);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = ((await res.json()) as { error?: string }).error ?? msg; } catch { /* keep default */ }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  /** Saved setup answers: the role (locked once chosen), salary / allowance and payday. Money in minor units. */
  profile?: { userType?: 'student' | 'employee' | 'business'; incomeSource?: string; incomeAmount?: number; payday?: number };
}
export interface AuthResult { accessToken: string; refreshToken: string; user: AuthUser }
