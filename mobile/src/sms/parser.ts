import { toMinor } from '@/lib/money';
import type { Channel } from '@/types';
import { detectBank, type BankDef, type ParserTemplate } from './banks';

export interface ParsedTx {
  bankCode: string;
  type: 'income' | 'expense';
  channel: Channel;
  amount: number;
  fee: number;
  balance: number | null;
  ref?: string;
  counterparty: string;
  occurredAt: number;
  accountTail?: string;
  incomeKind?: 'salary' | 'other';
  dedupeHash: string;
}

export type SmsVerdict =
  | { kind: 'ignored' }
  | { kind: 'parsed'; tx: ParsedTx }
  | { kind: 'unparsed' };

const NUM = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
const MONEY_RE = new RegExp(`(?:ETB|Birr|Br\\.?)\\s*${NUM}|${NUM}\\s*(?:ETB|Birr)`, 'gi');

const CREDIT_RE = /\b(credited|received|deposited|deposit|refund(?:ed)?|cash[- ]in)\b/i;
const DEBIT_RE = /\b(debited|withdrawn|withdrawal|withdrew|transferred|paid|payment|purchase[d]?|sent|bought|cash[- ]out|airtime|recharg(?:e|ed)|top(?:ped)?[- ]?up)\b/i;
const OTP_RE = /\b(otp|one[- ]time|verification code|passcode|password)\b/i;
const MAX_BODY = 800; // never run patterns on unexpectedly long text

export function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

interface MoneyHit { value: number; segment: string }

function findMoney(text: string): MoneyHit[] {
  const hits: MoneyHit[] = [];
  let last = 0;
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(text))) {
    const raw = m[1] ?? m[2];
    hits.push({ value: toMinor(raw), segment: text.slice(last, m.index) });
    last = m.index + m[0].length;
  }
  return hits;
}

function cleanName(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\s.,;:\-]+$/g, '').trim();
}

function extractCounterparty(text: string, isCredit: boolean): string {
  const NAME = "([A-Za-z][A-Za-z0-9 .'&\\-]{1,45}?)";
  const END = '(?=\\s*(?:\\(|,|\\.\\s|\\.$|\\bon\\b|\\bwith\\b|\\bat\\b|\\bRef\\b|\\bfor\\b|\\bto your\\b|\\bYour\\b|\\bthank|$))';
  const re = new RegExp(`\\b${isCredit ? 'from' : 'to'}\\s+${NAME}${END}`, 'i');
  const m = re.exec(text);
  if (m) {
    const name = cleanName(m[1]);
    if (!/^(your|account|a\/c|the)\b/i.test(name)) return name;
  }
  const alt = /\b(?:at|for goods purchased from|purchased from)\s+([A-Za-z][A-Za-z0-9 .'&\-]{1,40}?)(?=\s*(?:\(|,|\.|\bon\b|$))/i.exec(text);
  return alt ? cleanName(alt[1]) : '';
}

function inferChannel(text: string): Channel {
  if (/withdraw|cash[- ]out|atm/i.test(text)) return 'withdrawal';
  if (/airtime|recharge|top[- ]?up/i.test(text)) return 'airtime';
  if (/\bdeposit|cash[- ]in/i.test(text)) return 'deposit';
  if (/transfer|sent|received from|credited with .* from/i.test(text)) return 'transfer';
  if (/paid|payment|purchase|bill/i.test(text)) return 'payment';
  return 'other';
}

const REF_RE = /(?:ref(?:erence)?(?:\s*(?:no|number|id))?|transaction\s*(?:number|id|no)|txn\s*(?:id|no)?|receipt\s*(?:no|number))\W{0,3}(?:is\s+)?([A-Z0-9]{6,})/i;

function tailOf(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\D/g, '').slice(-4) || undefined;
}

function finish(bank: BankDef, p: {
  isCredit: boolean; amount: number; fee: number; balance: number | null; channel: Channel; counterparty: string;
  ref?: string; tail?: string; receivedAt: number; salary: boolean;
}): ParsedTx {
  const dedupeHash = djb2(p.ref ? `${bank.code}|${p.ref}|${p.amount}` : `${bank.code}|${p.amount}|${Math.floor(p.receivedAt / 60000)}|${p.balance ?? ''}`);
  return {
    bankCode: bank.code, type: p.isCredit ? 'income' : 'expense', channel: p.channel, amount: p.amount, fee: p.fee, balance: p.balance,
    ref: p.ref, counterparty: p.counterparty, occurredAt: p.receivedAt, accountTail: p.tail,
    incomeKind: p.isCredit && p.salary ? 'salary' : p.isCredit ? 'other' : undefined, dedupeHash,
  };
}

const compiled = new Map<string, RegExp | null>();
function compile(t: ParserTemplate): RegExp | null {
  const key = `${t.id}|${t.flags ?? ''}|${t.pattern}`;
  if (!compiled.has(key)) {
    try { compiled.set(key, new RegExp(t.pattern, t.flags || 'i')); } catch { compiled.set(key, null); }
  }
  return compiled.get(key) ?? null;
}

/** Exact, server-delivered templates. They win over the generic heuristics when they match. */
function parseWithTemplates(bank: BankDef, text: string, receivedAt: number): ParsedTx | null {
  for (const t of bank.templates) {
    const re = compile(t);
    const m = re?.exec(text);
    const g = m?.groups;
    if (!g?.amount) continue;
    const amount = toMinor(g.amount);
    if (amount <= 0) continue;
    const isCredit = t.direction === 'credit';
    return finish(bank, {
      isCredit, amount, fee: (g.fee ? toMinor(g.fee) : 0) + (g.vat ? toMinor(g.vat) : 0),
      balance: g.balance ? toMinor(g.balance) : null, channel: t.channel ?? inferChannel(text),
      counterparty: g.counterparty ? cleanName(g.counterparty) : extractCounterparty(text, isCredit),
      ref: g.ref || REF_RE.exec(text)?.[1], tail: tailOf(g.tail), receivedAt, salary: t.incomeKind === 'salary' || /salary|payroll/i.test(text),
    });
  }
  return null;
}

export function parseSms(address: string, body: string, receivedAt: number): SmsVerdict {
  const bank = detectBank(address, body);
  if (!bank) return { kind: 'ignored' };
  if (OTP_RE.test(body) && !/balance/i.test(body)) return { kind: 'ignored' };

  const text = body.replace(/\s+/g, ' ').trim().slice(0, MAX_BODY);
  if (bank.templates.length) {
    const viaTemplate = parseWithTemplates(bank, text, receivedAt);
    if (viaTemplate) return { kind: 'parsed', tx: viaTemplate };
  }

  const money = findMoney(text);
  if (money.length === 0) return { kind: 'ignored' };

  let amount = 0;
  let fee = 0;
  let balance: number | null = null;
  for (const hit of money) {
    const seg = hit.segment;
    if (/balance\W*(?:is|of)?\W*$/i.test(seg) || /balance/i.test(seg.slice(-30))) balance = hit.value;
    else if (/total/i.test(seg.slice(-25))) continue;
    else if (/\b(vat|tax)\b/i.test(seg.slice(-25))) fee += hit.value;
    else if (/\b(service charge|service fee|charge|fee|commission)\b/i.test(seg.slice(-30))) fee += hit.value;
    else if (amount === 0) amount = hit.value;
  }

  const credit = CREDIT_RE.exec(text);
  const debit = DEBIT_RE.exec(text);
  if (amount === 0 || (!credit && !debit)) return { kind: 'unparsed' };
  const isCredit = !!credit && (!debit || credit.index <= debit.index);

  let channel = inferChannel(text);
  const counterparty = extractCounterparty(text, isCredit);
  if (channel === 'other' && counterparty && !isCredit) channel = 'transfer';

  const acct = /(?:account|a\/c|acct?)\.?\s*(?:no\.?|number)?\s*:?\s*([0-9*xX]{5,})/i.exec(text)?.[1];
  return {
    kind: 'parsed',
    tx: finish(bank, { isCredit, amount, fee, balance, channel, counterparty, ref: REF_RE.exec(text)?.[1], tail: tailOf(acct), receivedAt, salary: /salary|payroll/i.test(text) }),
  };
}
