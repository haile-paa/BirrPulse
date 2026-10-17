import assert from 'node:assert/strict';
import { parseSms } from '@/sms/parser';
import { demoSms } from '@/sms/sampleSms';

const now = Date.UTC(2026, 9, 15, 9, 0, 0);
const msgs = demoSms(now);
const get = (i: number) => {
  const v = parseSms(msgs[i].address, msgs[i].body, msgs[i].date);
  assert.equal(v.kind, 'parsed', `message ${i} should parse`);
  return (v as Extract<typeof v, { kind: 'parsed' }>).tx;
};

// Salary credit
let t = get(0);
assert.equal(t.type, 'income'); assert.equal(t.amount, 2000000); assert.equal(t.balance, 2435000);
assert.equal(t.incomeKind, 'salary'); assert.equal(t.ref, 'FT26274XK2P1'); assert.equal(t.accountTail, '4821');
// Debit with service charge + VAT
t = get(1);
assert.equal(t.type, 'expense'); assert.equal(t.amount, 120000); assert.equal(t.fee, 58); assert.equal(t.balance, 2314942);
// ATM withdrawal
t = get(2);
assert.equal(t.channel, 'withdrawal'); assert.equal(t.fee, 230);
// Wallet payment + ref
t = get(5);
assert.equal(t.channel, 'payment'); assert.equal(t.ref, 'DJ58P7QW11'); assert.match(t.counterparty, /Tomoca/);
// Airtime
t = get(7);
assert.equal(t.channel, 'airtime'); assert.equal(t.amount, 10000);
// Deposit
t = get(13);
assert.equal(t.type, 'income'); assert.equal(t.channel, 'deposit');
// OTP and non-transaction SMS are ignored
assert.equal(parseSms(msgs[14].address, msgs[14].body, msgs[14].date).kind, 'ignored');
assert.equal(parseSms(msgs[15].address, msgs[15].body, msgs[15].date).kind, 'ignored');
// Personal messages from unknown senders are never read
assert.equal(parseSms('0911223344', 'You have received ETB 500 from me', now).kind, 'ignored');
// Same message twice gives the same dedupe hash
const a = parseSms(msgs[0].address, msgs[0].body, msgs[0].date);
const b = parseSms(msgs[0].address, msgs[0].body, msgs[0].date + 5000);
assert.equal(a.kind === 'parsed' && b.kind === 'parsed' && a.tx.dedupeHash === b.tx.dedupeHash, true);
console.log('parser tests passed');

// ---- server-delivered templates and configuration -------------------------------------------------
import { BANKS, applyRemoteBanks, resetBanks, allowList } from '@/sms/banks';

const customBody = 'CBE>> Txn 77Z9XQ: you paid 1,234.50 Birr to Kaldis Coffee. Fee 2.00 + VAT 0.30. Bal 8,000.00 Birr';
// Before the server delivers a template the generic parser cannot read this unusual format reliably.
const before = parseSms('CBE', customBody, now);

const applied = applyRemoteBanks([
  {
    code: 'CBE', name: 'Commercial Bank of Ethiopia', short: 'CBE', color: '#7B2D8E', senders: ['CBE', 'CBEBirr', 'CBE-INFO'], bodyHints: ['banking with cbe'],
    templates: [
      { id: 'paid-v2', direction: 'debit', flags: 'i', channel: 'payment',
        pattern: 'Txn (?<ref>[A-Z0-9]+): you paid (?<amount>[\\d,]+\\.\\d{2}) Birr to (?<counterparty>[A-Za-z ]+)\\. Fee (?<fee>[\\d.]+) \\+ VAT (?<vat>[\\d.]+)\\. Bal (?<balance>[\\d,]+\\.\\d{2})' },
      { id: 'broken', direction: 'debit', pattern: '(?<amount>[' }, // invalid: must be dropped, not crash
      { id: 'evil-group', direction: 'debit', pattern: '(?<amount>\\d+)(?<evil>x)' }, // unknown group: dropped
    ],
  },
  { code: 'NEWBANK', name: 'New Bank', short: 'New', color: '#112233', senders: ['NEWBANK'], bodyHints: [], templates: [] },
  { code: 'BAD', name: 'x', short: 'x', color: 'not-a-color', senders: [], bodyHints: [], templates: [] }, // invalid: ignored
  'garbage',
]);
assert.equal(applied, 2, 'two valid banks applied, invalid entries ignored');
assert.equal(BANKS.find((b) => b.code === 'CBE')!.templates.length, 1, 'only the valid template is kept');
assert.ok(BANKS.some((b) => b.code === 'NEWBANK') && !BANKS.some((b) => b.code === 'BAD'));
assert.equal(BANKS[BANKS.length - 1].code, 'CASH', 'Cash stays last');
assert.ok(allowList().senders.includes('CBE-INFO') && allowList().senders.includes('NEWBANK'), 'allow-list follows server config');

const viaTemplate = parseSms('CBE', customBody, now);
assert.equal(viaTemplate.kind, 'parsed');
if (viaTemplate.kind === 'parsed') {
  const x = viaTemplate.tx;
  assert.equal(x.amount, 123450); assert.equal(x.fee, 230); assert.equal(x.balance, 800000);
  assert.equal(x.ref, '77Z9XQ'); assert.equal(x.counterparty, 'Kaldis Coffee'); assert.equal(x.channel, 'payment'); assert.equal(x.type, 'expense');
}
assert.equal(parseSms('NEWBANK', 'You have received ETB 100.00 from Abebe. Balance is ETB 500.00', now).kind, 'parsed');
// Templates must not break messages they do not match: the generic parser still handles the demo messages.
assert.equal(parseSms(msgs[1].address, msgs[1].body, msgs[1].date).kind, 'parsed');
resetBanks();
assert.ok(!BANKS.some((b) => b.code === 'NEWBANK'));
void before;
console.log('template + remote config tests passed');
