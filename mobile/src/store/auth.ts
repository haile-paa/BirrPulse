import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setSessionExpiredHandler, tokens, type AuthResult, type AuthUser } from '@/lib/api';
import { unregisterPush } from '@/services/push';
import { afterSignIn } from '@/services/session';

interface AuthState {
  loaded: boolean;
  user: AuthUser | null;
  load: () => Promise<void>;
  /** Create account: username, phone number and password. */
  register: (name: string, phone: string, password: string) => Promise<void>;
  /** Log in: phone number and password. */
  login: (phone: string, password: string) => Promise<void>;
  /** Forgot password step 1: e-mails a code (only when this email is linked to the account of that phone number). */
  requestReset: (phone: string, email: string) => Promise<{ resendIn: number }>;
  /** Forgot password step 2: checks the code and sets the new password. */
  confirmReset: (phone: string, email: string, code: string, password: string) => Promise<void>;
  /** Recovery email, set while signed in: step 1 sends a code to the address, step 2 confirms it. */
  requestRecoveryEmail: (email: string) => Promise<{ resendIn: number }>;
  confirmRecoveryEmail: (code: string) => Promise<void>;
  /** The server no longer accepts the saved session: back to sign-in, local data stays until the next sign-in. */
  expireSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const cleanPhone = (p: string) => p.replace(/[\s\-().]/g, '');

async function saveSession(res: AuthResult): Promise<void> {
  // The tokens stay in the phone's secure storage until the person taps Log out. The server keeps the session
  // alive for a month after the last use.
  await tokens.set(res.accessToken, res.refreshToken);
  await SecureStore.setItemAsync('bp_user', JSON.stringify(res.user));
}

export const useAuth = create<AuthState>((set, get) => ({
  loaded: false,
  user: null,
  async load() {
    const userJson = await SecureStore.getItemAsync('bp_user');
    const { access, refresh } = await tokens.get();
    set({ loaded: true, user: (access || refresh) && userJson ? JSON.parse(userJson) : null });
  },
  async register(name, phone, password) {
    const res = await api<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify({ name: name.trim(), phone: cleanPhone(phone), password }) }, false);
    await saveSession(res);
    await afterSignIn(res.user);
    set({ user: res.user });
  },
  async login(phone, password) {
    const res = await api<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ phone: cleanPhone(phone), password }) }, false);
    await saveSession(res);
    await afterSignIn(res.user);
    set({ user: res.user });
  },
  async requestReset(phone, email) {
    return api<{ resendIn: number }>('/auth/forgot/request', { method: 'POST', body: JSON.stringify({ phone: cleanPhone(phone), email: email.trim().toLowerCase() }) }, false);
  },
  async confirmReset(phone, email, code, password) {
    await api('/auth/forgot/confirm', { method: 'POST', body: JSON.stringify({ phone: cleanPhone(phone), email: email.trim().toLowerCase(), code: code.trim(), password }) }, false);
  },
  async requestRecoveryEmail(email) {
    return api<{ resendIn: number }>('/me/email/request', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }) });
  },
  async confirmRecoveryEmail(code) {
    const user = await api<AuthUser>('/me/email/verify', { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
    await SecureStore.setItemAsync('bp_user', JSON.stringify({ ...get().user, ...user }));
    set({ user: { ...get().user!, ...user } });
  },
  async expireSession() {
    await tokens.clear();
    await SecureStore.deleteItemAsync('bp_user').catch(() => {});
    set({ user: null });
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

// When the server says the saved session is gone, the app goes back to the sign-in screens.
setSessionExpiredHandler(() => { void useAuth.getState().expireSession(); });
