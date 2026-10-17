import { useApp } from '@/store/useApp';
import type { Settings } from '@/types';
import { syncNow } from './sync';

/**
 * Runs right after a successful sign-in, before the app shows its next screen: downloads the account's data so a
 * returning user opens straight into it instead of the first-time setup.
 */
export async function afterSignIn(user: { name?: string }): Promise<void> {
  try { await syncNow(); } catch { /* offline: the regular sync will retry */ }
  const st = useApp.getState();
  const patch: Partial<Settings> = {};
  if (user.name && !st.settings.userName) patch.userName = user.name.split(' ')[0];
  if (st.accounts.length > 0 || st.transactions.length > 0) patch.onboarded = true;
  if (Object.keys(patch).length) st.setSettings(patch);
}

/** Uploads unsaved changes before signing out. Returns false when the phone is offline or the server is unreachable. */
export async function backupBeforeSignOut(): Promise<boolean> {
  try {
    await syncNow();
    return true;
  } catch {
    return false;
  }
}
