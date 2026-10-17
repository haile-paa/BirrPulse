import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/lib/api';
import { allowList, applyRemoteBanks } from './banks';
import { setAllowList } from '../../modules/birrpulse-sms';

const KEY = 'birrpulse-parser-config-v1';
const MIN_INTERVAL = 6 * 60 * 60 * 1000; // ask the server at most every 6 hours unless forced

interface Cached { version: string; banks: unknown[]; fetchedAt: number }
let cached: Cached | null = null;

/** Tells the Android background receiver which senders it may keep. Call after any change to the bank list. */
export function syncNativeAllowList(): void {
  const { senders, hints } = allowList();
  setAllowList(senders, hints);
}

/** Applies the last configuration saved on this phone (works offline). */
export async function loadCachedParserConfig(): Promise<void> {
  if (!cached) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      cached = raw ? (JSON.parse(raw) as Cached) : null;
    } catch {
      cached = null;
    }
    if (cached) applyRemoteBanks(cached.banks);
  }
  syncNativeAllowList();
}

/** Downloads new bank/template configuration. Public endpoint, so it also works in guest mode. */
export async function refreshParserConfig(force = false): Promise<'updated' | 'unchanged' | 'skipped' | 'failed'> {
  await loadCachedParserConfig();
  if (!force && cached && Date.now() - cached.fetchedAt < MIN_INTERVAL) return 'skipped';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const q = cached ? `?v=${encodeURIComponent(cached.version)}` : '';
    const res = await fetch(`${API_URL}/api/v1/config/parsers${q}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return 'failed';
    const data = (await res.json()) as { unchanged?: boolean; version?: string; banks?: unknown[] };
    if (data.unchanged && cached) {
      cached = { ...cached, fetchedAt: Date.now() };
      await AsyncStorage.setItem(KEY, JSON.stringify(cached));
      return 'unchanged';
    }
    if (typeof data.version !== 'string' || !Array.isArray(data.banks)) return 'failed';
    applyRemoteBanks(data.banks);
    cached = { version: data.version, banks: data.banks, fetchedAt: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(cached));
    syncNativeAllowList();
    return 'updated';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}
