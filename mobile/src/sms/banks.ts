import type { Channel } from '@/types';

/** A server-deliverable extraction rule. Pattern uses named groups: amount, fee, vat, balance, ref, counterparty, tail. */
export interface ParserTemplate {
  id: string;
  direction: 'credit' | 'debit';
  pattern: string;
  flags?: string;
  channel?: Channel;
  incomeKind?: 'salary';
}

export interface BankDef {
  code: string;
  name: string;
  short: string;
  color: string;
  /** SMS sender IDs (matched case-insensitively). VERIFY against real inbox data for each bank. */
  senders: string[];
  /** Fallback phrases that identify the bank inside the message body. */
  bodyHints: RegExp[];
  hintSources: string[];
  /** Optional exact templates (usually delivered from the server). Tried before the generic parser. */
  templates: ParserTemplate[];
}

const bank = (code: string, name: string, short: string, color: string, senders: string[], hints: string[]): BankDef => ({
  code, name, short, color, senders, hintSources: hints, bodyHints: hints.map((h) => new RegExp(h, 'i')), templates: [],
});

const BUILTIN: BankDef[] = [
  bank('CBE', 'Commercial Bank of Ethiopia', 'CBE', '#7B2D8E', ['CBE', 'CBEBirr'], ['commercial bank of ethiopia', 'banking with cbe']),
  bank('TELEBIRR', 'Telebirr', 'tele', '#1C9AD6', ['127', 'telebirr'], ['telebirr']),
  bank('AWASH', 'Awash Bank', 'Awash', '#F28C1B', ['AwashBank', 'Awash'], ['awash bank']),
  bank('DASHEN', 'Dashen Bank', 'Dashen', '#1A4E9B', ['DashenBank', 'Dashen'], ['dashen bank']),
  bank('BOA', 'Bank of Abyssinia', 'BoA', '#C9A227', ['BOA', 'BankOfAbyssinia', 'Abyssinia'], ['bank of abyssinia']),
  bank('CASH', 'Cash', 'Cash', '#3A8D87', [], []),
];

/** Live list. It is mutated in place when server configuration arrives so every importer sees the update. */
export const BANKS: BankDef[] = BUILTIN.map((b) => ({ ...b }));

export const bankByCode = (code: string): BankDef =>
  BANKS.find((b) => b.code === code) ?? { code, name: code, short: code.slice(0, 4), color: '#3A8D87', senders: [], bodyHints: [], hintSources: [], templates: [] };

export function detectBank(address: string, body: string): BankDef | null {
  const a = (address || '').trim().toLowerCase();
  for (const b of BANKS) if (b.senders.some((s) => s.toLowerCase() === a)) return b;
  for (const b of BANKS) if (b.senders.some((s) => s.length > 3 && a.includes(s.toLowerCase()))) return b;
  for (const b of BANKS) if (b.bodyHints.some((h) => h.test(body))) return b;
  return null;
}

/** Sender IDs and body patterns the app (and the native background receiver) may read. */
export function allowList(): { senders: string[]; hints: string[] } {
  return { senders: BANKS.flatMap((b) => b.senders), hints: BANKS.flatMap((b) => b.hintSources) };
}

// ---- server configuration -------------------------------------------------------------------------------

export interface RemoteBank {
  code: string; name: string; short: string; color: string;
  senders: string[]; bodyHints: string[]; templates: ParserTemplate[];
}

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const CHANNELS = new Set(['deposit', 'withdrawal', 'transfer', 'payment', 'airtime', 'fee', 'other']);
const GROUPS = new Set(['amount', 'fee', 'vat', 'balance', 'ref', 'counterparty', 'tail']);

function cleanTemplate(t: unknown): ParserTemplate | null {
  const x = t as Partial<ParserTemplate> | null;
  if (!x || !isStr(x.id, 32) || (x.direction !== 'credit' && x.direction !== 'debit') || !isStr(x.pattern, 600)) return null;
  if (x.flags !== undefined && x.flags !== '' && x.flags !== 'i') return null;
  if (x.channel !== undefined && x.channel !== ('' as Channel) && !CHANNELS.has(x.channel)) return null;
  try {
    const re = new RegExp(x.pattern, x.flags || 'i');
    const names = [...x.pattern.matchAll(/\(\?<([A-Za-z]+)>/g)].map((m) => m[1]);
    if (!names.includes('amount') || names.some((n) => !GROUPS.has(n))) return null;
    void re;
  } catch {
    return null;
  }
  return { id: x.id, direction: x.direction, pattern: x.pattern, flags: x.flags || 'i', channel: x.channel || undefined, incomeKind: x.incomeKind === 'salary' ? 'salary' : undefined };
}

/** Validates server data (never trust it blindly) and merges it over the built-in banks. Returns how many banks were applied. */
export function applyRemoteBanks(remote: unknown): number {
  if (!Array.isArray(remote)) return 0;
  let applied = 0;
  for (const raw of remote.slice(0, 40)) {
    const r = raw as Partial<RemoteBank> | null;
    if (!r || !isStr(r.code, 16) || !isStr(r.name, 60) || !isStr(r.short, 8) || typeof r.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(r.color)) continue;
    if (!Array.isArray(r.senders) || !Array.isArray(r.bodyHints)) continue;
    const senders = r.senders.filter((s): s is string => isStr(s, 32)).slice(0, 20);
    const hintSources: string[] = [];
    for (const h of r.bodyHints.slice(0, 10)) {
      if (!isStr(h, 120)) continue;
      try { new RegExp(h, 'i'); hintSources.push(h); } catch { /* skip broken pattern */ }
    }
    const templates = (Array.isArray(r.templates) ? r.templates.slice(0, 30) : []).map(cleanTemplate).filter((t): t is ParserTemplate => t !== null);
    const def: BankDef = { code: r.code, name: r.name, short: r.short, color: r.color, senders, hintSources, bodyHints: hintSources.map((h) => new RegExp(h, 'i')), templates };
    const i = BANKS.findIndex((b) => b.code === def.code);
    if (i === -1) BANKS.splice(Math.max(0, BANKS.length - 1), 0, def); // keep "Cash" last
    else BANKS[i] = def;
    applied++;
  }
  return applied;
}

/** Test helper: restore the built-in list. */
export function resetBanks(): void {
  BANKS.splice(0, BANKS.length, ...BUILTIN.map((b) => ({ ...b })));
}
