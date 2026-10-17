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

const FIRST_IMPORT_DAYS = 90;

/** Reads new bank SMS since the last scan (or the last 90 days on first run) and parses them into transactions. */
/** Messages captured by the Android receiver while the app was closed. */
export function ingestNativeQueue(): number {
  const st = useApp.getState();
  const queued = drainQueue();
  if (queued.length === 0) return 0;
  if (!st.settings.smsEnabled) return 0; // tracking is off: discard
  return st.ingestSms(queued).added;
}

export async function scanSms(forceFull = false): Promise<{ added: number; unparsed: number } | null> {
  const st = useApp.getState();
  if (!st.settings.smsEnabled || !isSmsSupported() || !(await hasSmsPermission())) return null;
  const since = forceFull || st.settings.lastSmsScan === 0 ? Date.now() - FIRST_IMPORT_DAYS * 86400000 : Math.max(0, st.settings.lastSmsScan - 120000);
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
  if (useAuth.getState().user) void registerPush();
  const st = useApp.getState();
  const fresh = st.refreshAlerts();
  if (st.settings.notificationsOn) await pushLocal(fresh);
  if (useAuth.getState().user) { try { await syncNow(); } catch { /* offline: try again later */ } }
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
