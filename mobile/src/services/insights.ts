import { addDays, daysInMonth, monthName, startOfDay, startOfMonth, startOfWeek, dayName } from '@/lib/format';
import { smsCutoff } from '@/sms/window';
import type { Account, Bill, Budget, Debt, Transaction, Workspace } from '@/types';

export type Range = 'Day' | 'Week' | 'Month' | 'Year';

/** Own-account transfers and loans/repayments move money but are neither income nor spending. */
export const isInternal = (t: Transaction) => !!t.transferGroup || !!t.debtId;
export const live = (txs: Transaction[], ws?: Workspace) => txs.filter((t) => !t.deleted && (!ws || t.workspace === ws));
export const signed = (t: Transaction) => (t.type === 'income' ? t.amount : -(t.amount + t.fee));

export interface Totals { income: number; expense: number; fees: number; deposits: number; withdrawals: number; net: number }

export function totals(txs: Transaction[], from: number, to: number): Totals {
  const r: Totals = { income: 0, expense: 0, fees: 0, deposits: 0, withdrawals: 0, net: 0 };
  for (const t of txs) {
    if (t.deleted || t.occurredAt < from || t.occurredAt >= to) continue;
    r.fees += t.fee;
    if (t.channel === 'deposit') r.deposits += t.amount;
    if (t.channel === 'withdrawal') r.withdrawals += t.amount;
    if (isInternal(t)) continue;
    if (t.type === 'income') r.income += t.amount;
    else if (t.type === 'expense') r.expense += t.amount + t.fee;
  }
  r.net = r.income - r.expense;
  return r;
}

export function monthTotals(txs: Transaction[], now = Date.now()): Totals {
  const s = startOfMonth(now);
  return totals(txs, s, addDays(startOfDay(now), 1));
}

export interface CatTotal { categoryId: string; total: number; count: number }
export function byCategory(txs: Transaction[], type: 'income' | 'expense', from: number, to: number): CatTotal[] {
  const map = new Map<string, CatTotal>();
  for (const t of txs) {
    if (t.deleted || t.type !== type || isInternal(t) || t.occurredAt < from || t.occurredAt >= to) continue;
    const v = t.type === 'expense' ? t.amount + t.fee : t.amount;
    const cur = map.get(t.categoryId) ?? { categoryId: t.categoryId, total: 0, count: 0 };
    cur.total += v;
    cur.count += 1;
    map.set(t.categoryId, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function rangeBounds(range: Range, now = Date.now()): { from: number; to: number } {
  const today = startOfDay(now);
  switch (range) {
    case 'Day': return { from: today, to: addDays(today, 1) };
    case 'Week': return { from: startOfWeek(now), to: addDays(startOfWeek(now), 7) };
    case 'Month': return { from: startOfMonth(now), to: new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime() };
    case 'Year': return { from: new Date(new Date(now).getFullYear(), 0, 1).getTime(), to: new Date(new Date(now).getFullYear() + 1, 0, 1).getTime() };
  }
}

export interface Series { labels: string[]; values: number[]; activeIndex: number }

export function series(txs: Transaction[], range: Range, type: 'income' | 'expense', now = Date.now()): Series {
  const { from } = rangeBounds(range, now);
  const val = (t: Transaction) => (type === 'expense' ? t.amount + t.fee : t.amount);
  const match = (t: Transaction) => !t.deleted && t.type === type && !isInternal(t);
  const d = new Date(now);
  let labels: string[] = [];
  let bucketOf: (t: number) => number;
  let activeIndex = 0;
  if (range === 'Day') {
    labels = ['0h', '3h', '6h', '9h', '12h', '15h', '18h', '21h'];
    bucketOf = (t) => Math.min(7, Math.floor(new Date(t).getHours() / 3));
    activeIndex = Math.floor(d.getHours() / 3);
  } else if (range === 'Week') {
    labels = Array.from({ length: 7 }, (_, i) => dayName(addDays(from, i)));
    bucketOf = (t) => Math.floor((startOfDay(t) - from) / 86400000);
    activeIndex = d.getDay();
  } else if (range === 'Month') {
    const n = daysInMonth(now);
    labels = Array.from({ length: n }, (_, i) => String(i + 1));
    bucketOf = (t) => new Date(t).getDate() - 1;
    activeIndex = d.getDate() - 1;
  } else {
    labels = Array.from({ length: 12 }, (_, i) => monthName(new Date(d.getFullYear(), i, 1).getTime()));
    bucketOf = (t) => new Date(t).getMonth();
    activeIndex = d.getMonth();
  }
  const values = new Array(labels.length).fill(0);
  const { to } = rangeBounds(range, now);
  for (const t of txs) {
    if (!match(t) || t.occurredAt < from || t.occurredAt >= to) continue;
    const i = bucketOf(t.occurredAt);
    if (i >= 0 && i < values.length) values[i] += val(t);
  }
  return { labels, values, activeIndex };
}

export interface Balance { amount: number; verified: boolean; at: number | null }

/** Verified balance comes from a bank SMS. Anything added after it by hand makes the number a calculated one. */
export function accountBalance(acc: Account, txs: Transaction[]): Balance {
  const mine = txs.filter((t) => t.accountId === acc.id && !t.deleted);
  if (acc.verifiedBalance) {
    const later = mine.filter((t) => t.occurredAt > acc.verifiedBalance!.at && t.source === 'manual');
    const amount = acc.verifiedBalance.amount + later.reduce((s, t) => s + signed(t), 0);
    return { amount, verified: later.length === 0, at: acc.verifiedBalance.at };
  }
  return { amount: acc.calcBalance + mine.reduce((s, t) => s + signed(t), 0), verified: false, at: null };
}

export function totalBalance(accounts: Account[], txs: Transaction[], ws: Workspace): { amount: number; allVerified: boolean } {
  const list = accounts.filter((a) => !a.deleted && a.workspace === ws);
  let amount = 0;
  let allVerified = list.length > 0;
  for (const a of list) {
    const b = accountBalance(a, txs);
    amount += b.amount;
    if (!b.verified) allVerified = false;
  }
  return { amount, allVerified };
}

export function budgetWindow(period: Budget['period'], now = Date.now()): { from: number; to: number } {
  const today = startOfDay(now);
  if (period === 'daily') return { from: today, to: addDays(today, 1) };
  if (period === 'weekly') return { from: startOfWeek(now), to: addDays(startOfWeek(now), 7) };
  return rangeBounds('Month', now);
}

export function budgetUsage(b: Budget, txs: Transaction[], now = Date.now()) {
  const { from, to } = budgetWindow(b.period, now);
  let spent = 0;
  for (const t of txs) {
    if (t.deleted || t.type !== 'expense' || isInternal(t) || t.workspace !== b.workspace) continue;
    if (t.occurredAt < from || t.occurredAt >= to) continue;
    if (b.categoryId && t.categoryId !== b.categoryId) continue;
    spent += t.amount + t.fee;
  }
  return { spent, limit: b.limit, pct: b.limit > 0 ? spent / b.limit : 0, remaining: b.limit - spent };
}

export const debtPaid = (d: Debt) => d.repayments.reduce((s, r) => s + r.amount, 0);
export const debtOutstanding = (d: Debt) => Math.max(0, d.principal - debtPaid(d));

export function debtSummary(debts: Debt[], ws: Workspace) {
  let owedToMe = 0;
  let iOwe = 0;
  for (const d of debts) {
    if (d.deleted || d.workspace !== ws) continue;
    if (d.direction === 'lent') owedToMe += debtOutstanding(d);
    else iOwe += debtOutstanding(d);
  }
  return { owedToMe, iOwe };
}

export function daysUntilPayday(payday: number | null, now = Date.now()): number {
  const d = new Date(now);
  if (!payday) return daysInMonth(now) - d.getDate() + 1;
  const thisMonth = new Date(d.getFullYear(), d.getMonth(), Math.min(payday, daysInMonth(now))).getTime();
  const target = thisMonth > startOfDay(now) ? thisMonth : new Date(d.getFullYear(), d.getMonth() + 1, payday).getTime();
  return Math.max(1, Math.round((target - startOfDay(now)) / 86400000));
}

/** Money left in the monthly budget (or tracked balance) spread over the days until next payday. */
export function safeToSpend(args: { budgets: Budget[]; txs: Transaction[]; accounts: Account[]; ws: Workspace; payday: number | null; now?: number }) {
  const now = args.now ?? Date.now();
  const monthly = args.budgets.find((b) => !b.deleted && b.period === 'monthly' && b.categoryId === null && b.workspace === args.ws);
  const days = daysUntilPayday(args.payday, now);
  const remaining = monthly ? budgetUsage(monthly, args.txs, now).remaining : totalBalance(args.accounts, args.txs, args.ws).amount;
  return { perDay: Math.max(0, Math.floor(remaining / days)), days, fromBudget: !!monthly, remaining };
}

export function savingsSuggestion(txs: Transaction[], now = Date.now()) {
  const { from, to } = rangeBounds('Month', now);
  const cats = byCategory(txs, 'expense', from, to).filter((c) => !['rent', 'bills', 'fees', 'education', 'health'].includes(c.categoryId));
  if (!cats.length) return null;
  const top = cats[0];
  return { categoryId: top.categoryId, current: top.total, saving: Math.round(top.total * 0.1) };
}

export function dueBills(bills: Bill[], now = Date.now(), withinDays = 7) {
  const end = addDays(startOfDay(now), withinDays + 1);
  return bills.filter((b) => !b.deleted && b.nextDue < end).sort((a, b) => a.nextDue - b.nextDue);
}

export function monthlyCashflow(txs: Transaction[], months = 6, now = Date.now()) {
  const out: Array<{ label: string; income: number; expense: number; net: number }> = [];
  const d = new Date(now);
  for (let i = months - 1; i >= 0; i--) {
    const s = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime();
    const e = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
    const t = totals(txs, s, e);
    out.push({ label: monthName(s), income: t.income, expense: t.expense, net: t.net });
  }
  return out;
}

export interface PayCycle { prev: number; next: number; daysLeft: number; totalDays: number; elapsedPct: number }

/** The pay cycle around today: the last payday, the next payday and how many days are left (0 = payday is today). */
export function payCycle(payday: number, now = Date.now()): PayCycle {
  const today = startOfDay(now);
  const at = (y: number, m: number) => new Date(y, m, Math.min(payday, new Date(y, m + 1, 0).getDate())).getTime();
  const d = new Date(now);
  let next = at(d.getFullYear(), d.getMonth());
  if (next < today) next = at(d.getFullYear(), d.getMonth() + 1);
  const n = new Date(next);
  const prev = at(n.getFullYear(), n.getMonth() - 1);
  const totalDays = Math.max(1, Math.round((next - prev) / 86400000));
  const daysLeft = Math.max(0, Math.round((next - today) / 86400000));
  return { prev, next, daysLeft, totalDays, elapsedPct: Math.min(1, Math.max(0, (totalDays - daysLeft) / totalDays)) };
}

/** Money received for this cycle (a salary / allowance transaction since a few days before the last payday). */
export function incomeReceived(txs: Transaction[], cycleStart: number, kind: 'employee' | 'student'): Transaction | null {
  const from = cycleStart - 3 * 86400000;
  const match = (t: Transaction) => (kind === 'employee' ? t.incomeKind === 'salary' || t.categoryId === 'salary' : t.incomeKind === 'allowance' || t.categoryId === 'allowance');
  return txs.find((t) => !t.deleted && t.type === 'income' && !isInternal(t) && t.occurredAt >= from && match(t)) ?? null;
}

/** Spending (without loans and own transfers) from a date until now. */
export function spentSince(txs: Transaction[], from: number, now = Date.now()): number {
  return totals(txs, from, now + 1).expense;
}

/**
 * A bank account found from SMS that has had no activity for 5 months is treated as closed: the person cannot use it
 * any more. Accounts created by hand (no bank message ever) and accounts with hand-added transactions are kept.
 */
export function isStaleSmsAccount(acc: Account, txs: Transaction[], now = Date.now()): boolean {
  if (acc.deleted || acc.bankCode === 'CASH') return false;
  const mine = txs.filter((t) => t.accountId === acc.id && !t.deleted);
  if (mine.some((t) => t.source === 'manual')) return false;
  if (!acc.verifiedBalance && mine.length === 0) return false; // added by hand and never used by a bank message
  const last = Math.max(acc.verifiedBalance?.at ?? 0, ...mine.map((t) => t.occurredAt));
  return last < smsCutoff(now);
}
