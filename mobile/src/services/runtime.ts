import { AppState } from 'react-native';
import { useEffect } from 'react';
import { useApp } from '@/store/useApp';
import { useAuth } from '@/store/auth';
import { hasSmsPermission, isSmsSupported, readBankSms } from '@/sms/smsService';
import { pushLocal } from './notify';
import { drainQueue } from '../../modules/birrpulse-sms';
import { loadCachedParserConfig, refreshParserConfig, syncNativeAllowList } from '@/sms/remoteConfig';
import { registerPush } from './push';
import { syncNow } from './sync';
import { syncProfile } from './session';
import { smsCutoff } from '@/sms/window';

/** Messages captured by the Android receiver while the app was closed. */
export function ingestNativeQueue(): number {
  const st = useApp.getState();
  const queued = drainQueue();
  if (queued.length === 0) return 0;
  if (!st.settings.smsEnabled) return 0; // tracking is off: discard
  return st.ingestSms(queued).added;
}

/** Reads new bank SMS since the last scan (never older than 5 months) and parses them into transactions. */
export async function scanSms(forceFull = false): Promise<{ added: number; unparsed: number } | null> {
  const st = useApp.getState();
  if (!st.settings.smsEnabled || !isSmsSupported() || !(await hasSmsPermission())) return null;
  // Never older than 5 months: older messages belong to bank accounts that are no longer in use.
  const cutoff = smsCutoff();
  const since = forceFull || st.settings.lastSmsScan === 0 ? cutoff : Math.max(cutoff, st.settings.lastSmsScan - 120000);
  const raw = await readBankSms(since);
  const res = st.ingestSms(raw);
  st.setSettings({ lastSmsScan: Date.now() });
  return res;
}

export async function runBackgroundWork(): Promise<void> {
  await loadCachedParserConfig();
  void refreshParserConfig(); // throttled; fixes for changed bank formats arrive without an app update
  syncNativeAllowList();
  ingestNativeQueue();
  try { await scanSms(); } catch { /* permission revoked or module missing: ignore */ }
  useApp.getState().pruneStale(); // drop bank accounts that have been silent for 5 months
  if (useAuth.getState().user) void registerPush();
  const st = useApp.getState();
  const fresh = st.refreshAlerts();
  if (st.settings.notificationsOn) await pushLocal(fresh);
  if (useAuth.getState().user) {
    await syncProfile();
    try { await syncNow(); } catch { /* offline: try again later */ }
  }
}

/** Re-scan on app start, whenever the app returns to the foreground, and every 5 minutes while it is open. */
export function useRuntime(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    void runBackgroundWork();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void runBackgroundWork(); });
    const iv = setInterval(() => void runBackgroundWork(), 5 * 60 * 1000);
    return () => { sub.remove(); clearInterval(iv); };
  }, [ready]);
}
