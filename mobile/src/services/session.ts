import { useApp } from '@/store/useApp';
import { api, ApiError, type AuthUser } from '@/lib/api';
import type { Settings } from '@/types';
import { syncNow } from './sync';

/**
 * Runs right after a successful sign-in, before the app shows its next screen. It makes sure the phone holds this
 * account's data only, downloads it, and restores the role and salary answers so a returning user skips the setup.
 */
export async function afterSignIn(user: AuthUser): Promise<void> {
  const before = useApp.getState();
  if (before.settings.ownerId && before.settings.ownerId !== user.id) before.resetAll(); // another account used this phone
  useApp.setState((s) => ({ settings: { ...s.settings, ownerId: user.id } }));
  try { await syncNow(); } catch { /* offline: the regular sync will retry */ }

  const st = useApp.getState();
  const patch: Partial<Settings> = {};
  if (user.name && !st.settings.userName) patch.userName = user.name.split(' ')[0];
  const pr = user.profile;
  if (pr?.userType) {
    // The account is the authority for the role.
    patch.userType = pr.userType;
    patch.workspace = pr.userType === 'business' ? 'business' : 'personal';
    patch.incomeSource = pr.incomeSource ?? '';
    patch.incomeAmount = pr.incomeAmount ? pr.incomeAmount : null;
    patch.payday = pr.payday ? pr.payday : null;
    patch.profileSynced = true;
    patch.onboarded = true;
  } else if (st.settings.userType) {
    patch.profileSynced = false; // the answers exist only on this phone so far: send them to the account
  } else if (st.accounts.length > 0 || st.transactions.length > 0) {
    patch.onboarded = true;
  }
  if (Object.keys(patch).length) useApp.setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

/** Saves the role / salary answers to the account when they changed (or could not be sent earlier). */
export async function syncProfile(): Promise<void> {
  const s = useApp.getState().settings;
  if (s.profileSynced || !s.userType) return;
  const done = () => useApp.setState((st) => ({ settings: { ...st.settings, profileSynced: true } }));
  try {
    await api('/me', {
      method: 'PATCH',
      body: JSON.stringify({ userType: s.userType, incomeSource: s.incomeSource, incomeAmount: s.incomeAmount ?? 0, payday: s.payday ?? 0 }),
    });
    done();
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 409)) done(); // the server will not accept it: do not retry forever
  }
}

/** Uploads unsaved changes before signing out. Returns false when the phone is offline or the server is unreachable. */
export async function backupBeforeSignOut(): Promise<boolean> {
  try {
    await syncProfile();
    await syncNow();
    return true;
  } catch {
    return false;
  }
}
