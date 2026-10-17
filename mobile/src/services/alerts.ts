import { formatBirr } from '@/lib/money';
import { t, tr } from '@/i18n';
import { startOfDay } from '@/lib/format';
import { categoryById } from '@/lib/categories';
import type { AppNotification, Bill, Budget, Category, Debt, Transaction, Workspace } from '@/types';
import { budgetUsage, debtOutstanding, isInternal } from './insights';

interface Input {
  txs: Transaction[];
  budgets: Budget[];
  bills: Bill[];
  debts: Debt[];
  categories: Category[];
  ws: Workspace;
  existingKeys: Set<string>;
  now?: number;
}

const note = (key: string, kind: AppNotification['kind'], title: string, body: string, at: number): AppNotification => ({
  id: `n_${key}`, key, kind, title, body, at, read: false,
});

/** Pure function: returns only notifications that were not already raised (deduped by key). */
export function computeAlerts(i: Input): AppNotification[] {
  const now = i.now ?? Date.now();
  const day = startOfDay(now);
  const out: AppNotification[] = [];
  const push = (n: AppNotification) => { if (!i.existingKeys.has(n.key!)) out.push(n); };

  for (const b of i.budgets) {
    if (b.deleted || b.workspace !== i.ws) continue;
    const u = budgetUsage(b, i.txs, now);
    const name = b.categoryId ? tr(categoryById(i.categories, b.categoryId).name) : tr('Overall');
    const period = tr(b.period);
    const win = `${b.period}-${b.period === 'daily' ? day : b.period === 'weekly' ? Math.floor(day / 604800000) : new Date(now).getMonth()}`;
    if (u.pct >= 1) push(note(`budget100-${b.id}-${win}`, 'budget', t('{name} budget exceeded', { name }), t('You spent {spent} of your {limit} {period} budget.', { spent: formatBirr(u.spent), limit: formatBirr(b.limit), period }), now));
    else if (u.pct >= 0.8) push(note(`budget80-${b.id}-${win}`, 'budget', t('{name} budget at {pct}%', { name, pct: Math.round(u.pct * 100) }), t('{amount} left in your {period} budget.', { amount: formatBirr(u.remaining), period }), now));
  }

  for (const bill of i.bills) {
    if (bill.deleted || bill.workspace !== i.ws) continue;
    const days = Math.round((startOfDay(bill.nextDue) - day) / 86400000);
    const amount = formatBirr(bill.amount);
    if (days < 0) push(note(`billover-${bill.id}-${bill.nextDue}`, 'bill', t('{name} is overdue', { name: bill.name }), t('{amount} was due {n} day(s) ago.', { amount, n: Math.abs(days) }), now));
    else if (days <= 3) push(note(`billdue-${bill.id}-${bill.nextDue}`, 'bill', days === 0 ? t('{name} due today', { name: bill.name }) : t('{name} due in {n} day(s)', { name: bill.name, n: days }), t('{amount} is coming up.', { amount }), now));
  }

  for (const d of i.debts) {
    if (d.deleted || d.workspace !== i.ws || !d.dueDate || debtOutstanding(d) === 0) continue;
    const days = Math.round((startOfDay(d.dueDate) - day) / 86400000);
    if (days <= 3) {
      const who = d.direction === 'borrowed' ? t('Repay {person}', { person: d.person }) : t('{person} owes you', { person: d.person });
      const title = days < 0 ? t('{who}: overdue', { who }) : days === 0 ? t('{who}: due today', { who }) : t('{who}: due in {n} day(s)', { who, n: days });
      push(note(`debt-${d.id}-${d.dueDate}`, 'debt', title, t('{amount} outstanding.', { amount: formatBirr(debtOutstanding(d)) }), now));
    }
  }

  // High spending: today's spending is more than 2x the average of the previous 14 days (and not trivial).
  const mine = i.txs.filter((x) => !x.deleted && x.type === 'expense' && !isInternal(x) && x.workspace === i.ws);
  const today = mine.filter((x) => x.occurredAt >= day).reduce((sum, x) => sum + x.amount + x.fee, 0);
  const prev = mine.filter((x) => x.occurredAt >= day - 14 * 86400000 && x.occurredAt < day).reduce((sum, x) => sum + x.amount + x.fee, 0) / 14;
  if (today > 50000 && prev > 0 && today > prev * 2) push(note(`spike-${day}`, 'spending', t('High spending today'), t('You spent {amount} today, about {x}x your daily average.', { amount: formatBirr(today), x: (today / prev).toFixed(1) }), now));

  return out;
}
