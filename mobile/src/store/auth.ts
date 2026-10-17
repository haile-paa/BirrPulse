import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, tokens, type AuthResult } from '@/lib/api';
import { unregisterPush } from '@/services/push';
import { afterSignIn } from '@/services/session';

interface AuthState {
  loaded: boolean;
  user: AuthResult['user'] | null;
  load: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, identifier: string, password: string) => Promise<void>;
  requestEmailCode: (email: string) => Promise<{ resendIn: number; expiresIn: number }>;
  verifyEmailCode: (email: string, code: string, name?: string) => Promise<{ isNew: boolean }>;
  logout: () => Promise<void>;
}

const isEmail = (s: string) => s.includes('@');
const credentials = (identifier: string) => (isEmail(identifier) ? { email: identifier.trim().toLowerCase() } : { phone: identifier.replace(/\s+/g, '') });

export const useAuth = create<AuthState>((set) => ({
  loaded: false,
  user: null,
  async load() {
    await SecureStore.deleteItemAsync('bp_guest').catch(() => {}); // guest mode no longer exists: older installs must sign in
    const userJson = await SecureStore.getItemAsync('bp_user');
    const { access } = await tokens.get();
    set({ loaded: true, user: access && userJson ? JSON.parse(userJson) : null });
  },
  async login(identifier, password) {
    const res = await api<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ ...credentials(identifier), password }) }, false);
    await tokens.set(res.accessToken, res.refreshToken);
    await SecureStore.setItemAsync('bp_user', JSON.stringify(res.user));
    await afterSignIn(res.user);
    set({ user: res.user });
  },
  async register(name, identifier, password) {
    const res = await api<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify({ name, ...credentials(identifier), password }) }, false);
    await tokens.set(res.accessToken, res.refreshToken);
    await SecureStore.setItemAsync('bp_user', JSON.stringify(res.user));
    await afterSignIn(res.user);
    set({ user: res.user });
  },
  async requestEmailCode(email) {
    return api<{ resendIn: number; expiresIn: number }>('/auth/otp/request', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }) }, false);
  },
  async verifyEmailCode(email, code, name) {
    const res = await api<AuthResult & { isNew: boolean }>('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), name: name?.trim() || undefined }) }, false);
    await tokens.set(res.accessToken, res.refreshToken);
    await SecureStore.setItemAsync('bp_user', JSON.stringify(res.user));
    await afterSignIn(res.user);
    set({ user: res.user });
    return { isNew: res.isNew };
  },
  async logout() {
    await unregisterPush();
    // Revoke the refresh token on the server too, so a copied token cannot be used after sign-out (best effort).
    const { refresh } = await tokens.get();
    if (refresh) await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: refresh }) }, false).catch(() => {});
    await tokens.clear();
    await SecureStore.deleteItemAsync('bp_user');
    set({ user: null });
  },
}));
