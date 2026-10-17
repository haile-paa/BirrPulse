import { PermissionsAndroid, Platform } from 'react-native';
import { demoSms, type RawSms } from './sampleSms';
import { allowList } from './banks';

// react-native-get-sms-android only exists in a development build (not Expo Go) and only on Android.
let SmsAndroid: { list: (filter: string, fail: (e: string) => void, ok: (count: number, list: string) => void) => void } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-get-sms-android');
  SmsAndroid = (mod?.default ?? mod) || null;
  if (!SmsAndroid || typeof SmsAndroid.list !== 'function') SmsAndroid = null;
} catch {
  SmsAndroid = null;
}

export const isSmsSupported = (): boolean => Platform.OS === 'android' && SmsAndroid !== null;

export async function hasSmsPermission(): Promise<boolean> {
  if (!isSmsSupported()) return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!isSmsSupported()) return false;
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);
  return res[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
}

/** Sender IDs we are willing to read (the list can grow when server configuration arrives). Personal messages are never touched. */
const isAllowedSender = (address: string) => {
  const a = (address || '').toLowerCase();
  return allowList().senders.some((s) => { const l = s.toLowerCase(); return a === l || (l.length > 3 && a.includes(l)); });
};
const hintRegexes = () => allowList().hints.map((h) => { try { return new RegExp(h, 'i'); } catch { return null; } }).filter((r): r is RegExp => r !== null);

function readPage(sinceMs: number, indexFrom: number, pageSize: number): Promise<RawSms[]> {
  return new Promise((resolve, reject) => {
    SmsAndroid!.list(
      JSON.stringify({ box: 'inbox', minDate: sinceMs, indexFrom, maxCount: pageSize }),
      (err) => reject(new Error(String(err))),
      (_count, json) => {
        try {
          const rows = JSON.parse(json) as Array<{ _id: string; address: string; body: string; date: number }>;
          resolve(rows.map((r) => ({ id: String(r._id), address: r.address, body: r.body, date: Number(r.date) })));
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

/** Reads inbox pages (so 10,000+ message inboxes do not blow memory) and keeps only allow-listed senders. */
export async function readBankSms(sinceMs: number, maxPages = 40, pageSize = 250): Promise<RawSms[]> {
  if (!isSmsSupported()) return [];
  const out: RawSms[] = [];
  const hints = hintRegexes();
  for (let p = 0; p < maxPages; p++) {
    const rows = await readPage(sinceMs, p * pageSize, pageSize);
    for (const r of rows) if (isAllowedSender(r.address) || hints.some((h) => h.test(r.body))) out.push(r);
    if (rows.length < pageSize) break;
  }
  return out.sort((a, b) => a.date - b.date);
}

export const loadDemoSms = (): RawSms[] => demoSms();
