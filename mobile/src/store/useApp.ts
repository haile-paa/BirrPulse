import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, startOfDay, uid } from '@/lib/format';
import { toMinor } from '@/lib/money';
import { DEFAULT_CATEGORIES, categorize } from '@/lib/categories';
import { bankByCode } from '@/sms/banks';
import { setLang } from '@/i18n/lang';
import { parseSms } from '@/sms/parser';
import { smsCutoff } from '@/sms/window';
import { demoSms, type RawSms } from '@/sms/sampleSms';
import { computeAlerts } from '@/services/alerts';
import { isStaleSmsAccount } from '@/services/insights';
import type {
  Account, AppNotification, Bill, Budget, Category, Debt, Goal, Settings, Transaction, UnparsedSms, Workspace,
} from '@/types';

type Syncable = Account | Transaction | Budget | Debt | Goal | Bill;
export type CollectionName = 'accounts' | 'transactions' | 'budgets' | 'debts' | 'goals' | 'bills';
export const SYNC_COLLECTIONS: CollectionName[] = ['accounts', 'transactions', 'budgets', 'debts', 'goals', 'bills'];

function deviceLanguage(): 'en' | 'am' {
  try { return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('am') ? 'am' : 'en'; } catch { return 'en'; }
}

const initialSettings: Settings = {
  workspace: 'personal', userType: null, onboarded: false, smsEnabled: false, lastSmsScan: 0,
  lastSync: 0, payday: null, incomeSource: '', incomeAmount: null, ownerId: null, profileSynced: true, notificationsOn: true, userName: '',
  language: deviceLanguage(),
};

interface Data {
  settings: Settings;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  debts: Debt[];
  goals: Goal[];
  bills: Bill[];
  notifications: AppNotification[];
  unparsed: UnparsedSms[];
  learned: Record<string, string>;
}

interface Actions {
  hydrated: boolean;
  setSettings: (p: Partial<Settings>) => void;
  addTransaction: (t: Omit<Transaction, 'id' | 'updatedAt' | 'source' | 'workspace'> & { workspace?: Workspace }) => Transaction;
  updateTransaction: (id: string, p: Partial<Transaction>, learnCategory?: boolean) => void;
  deleteTransaction: (id: string) => void;
  /** Swap income <-> expense (fixes a message the app read the wrong way round). */
  flipTransaction: (id: string) => void;
  /** Turn a transaction into a loan record: spent money becomes "I lent", received money becomes "I borrowed". */
  moveToDebt: (id: string, opts: { person: string; dueDate?: number | null }) => void;
  /** Count a transaction as a repayment of an existing debt. Returns false when it does not fit. */
  applyToDebt: (txId: string, debtId: string) => boolean;
  /** Undo moveToDebt / applyToDebt: the transaction becomes normal income or spending again. */
  unlinkDebt: (txId: string) => void;
  /** Removes bank accounts (and their messages) that have been silent for more than 5 months. */
  pruneStale: () => number;
  /** Role / salary answers; marks them to be saved to the account. */
  setProfile: (p: Partial<Pick<Settings, 'userType' | 'incomeSource' | 'incomeAmount' | 'payday'>>) => void;
  ingestSms: (raw: RawSms[]) => { added: number; unparsed: number };
  dismissUnparsed: (id: string) => void;
  saveAccount: (a: Partial<Account> & { bankCode: string; nickname: string }) => Account;
  deleteAccount: (id: string) => void;
  saveBudget: (b: Partial<Budget> & { limit: number; period: Budget['period'] }) => void;
  deleteBudget: (id: string) => void;
  saveDebt: (d: Partial<Debt> & { person: string; principal: number; direction: Debt['direction'] }) => void;
  addRepayment: (debtId: string, amount: number) => void;
  deleteDebt: (id: string) => void;
  saveGoal: (g: Partial<Goal> & { name: string; target: number }) => void;
  contribute: (goalId: string, amount: number) => void;
  deleteGoal: (id: string) => void;
  saveBill: (b: Partial<Bill> & { name: string; amount: number; nextDue: number }) => void;
  payBill: (billId: string, accountId: string | null) => void;
  deleteBill: (id: string) => void;
  refreshAlerts: () => AppNotification[];
  markAllRead: () => void;
  mergeRemote: (changes: Partial<Record<CollectionName, Syncable[]>>, serverTime: number) => void;
  loadDemo: () => void;
  resetAll: () => void;
}

export type AppState = Data & Actions;

const now = () => Date.now();
const upsert = <T extends { id: string }>(list: T[], item: T): T[] => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const copy = list.slice();
  copy[i] = item;
  return copy;
};

type TxDebt = { transactions: Transaction[]; debts: Debt[] };

/** Re-derives the normal category of a transaction that stops being a loan. */
function recategorize(t: Transaction, learned: Record<string, string>): Transaction {
  if (t.type === 'transfer') return { ...t, debtId: '', updatedAt: now() };
  return {
    ...t, debtId: '', updatedAt: now(),
    categoryId: categorize({ type: t.type, channel: t.channel, counterparty: t.counterparty, note: t.note, incomeKind: t.incomeKind, learned }),
  };
}

/** Detaches one transaction from its debt (removes the repayment, or the debt that was created from it). */
function unlinkTx(s: TxDebt & { learned: Record<string, string> }, txId: string): TxDebt {
  const tx = s.transactions.find((t) => t.id === txId);
  if (!tx?.debtId) return { transactions: s.transactions, debts: s.debts };
  const debt = s.debts.find((d) => d.id === tx.debtId);
  if (debt && debt.sourceTxId === txId) {
    return {
      debts: s.debts.map((d) => (d.id === debt.id ? { ...d, deleted: true, updatedAt: now() } : d)),
      transactions: s.transactions.map((t) => (t.debtId === debt.id ? recategorize(t, s.learned) : t)),
    };
  }
  return {
    debts: s.debts.map((d) => (d.id === tx.debtId ? { ...d, repayments: d.repayments.filter((r) => r.txId !== txId), updatedAt: now() } : d)),
    transactions: s.transactions.map((t) => (t.id === txId ? recategorize(t, s.learned) : t)),
  };
}

/** A transaction that was half of an own-account transfer stops being one once it is changed by hand. */
function clearTransfer(list: Transaction[], tx: Transaction): Transaction[] {
  if (!tx.transferGroup) return list;
  return list.map((t) => (t.transferGroup === tx.transferGroup ? { ...t, transferGroup: '', updatedAt: now() } : t));
}

/** Pairs an outgoing and an incoming transaction of the same amount between two tracked accounts so they are not counted twice. */
function linkTransfers(all: Transaction[], fresh: Transaction[]): Transaction[] {
  const result = all.slice();
  for (const t of fresh) {
    const idx = result.findIndex((x) => x.id === t.id);
    if (idx === -1 || result[idx].transferGroup || result[idx].deleted) continue;
    const me = result[idx];
    const otherIdx = result.findIndex((o) =>
      o.id !== me.id && !o.deleted && !o.transferGroup && o.accountId !== me.accountId && o.type !== me.type &&
      o.amount === me.amount && Math.abs(o.occurredAt - me.occurredAt) <= 15 * 60000);
    if (otherIdx === -1) continue;
    const group = uid();
    result[idx] = { ...me, transferGroup: group, channel: 'transfer', updatedAt: now() };
    result[otherIdx] = { ...result[otherIdx], transferGroup: group, channel: 'transfer', updatedAt: now() };
  }
  return result;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      settings: initialSettings,
      accounts: [],
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      budgets: [],
      debts: [],
      goals: [],
      bills: [],
      notifications: [],
      unparsed: [],
      learned: {},

      setSettings: (p) => {
        if (p.language) setLang(p.language);
        set((s) => {
          const patch = { ...p };
          // The role is chosen once. It cannot be switched afterwards (for example from personal to business).
          if (s.settings.userType && patch.userType && patch.userType !== s.settings.userType) delete patch.userType;
          const next = { ...s.settings, ...patch };
          if (next.userType) next.workspace = next.userType === 'business' ? 'business' : 'personal';
          return { settings: next };
        });
      },
      setProfile: (p) => get().setSettings({ ...p, profileSynced: false }),

      saveAccount: (a) => {
        const existing = a.id ? get().accounts.find((x) => x.id === a.id) : undefined;
        const acc: Account = {
          id: a.id ?? uid(), bankCode: a.bankCode, nickname: a.nickname, tail: a.tail ?? existing?.tail,
          verifiedBalance: a.verifiedBalance ?? existing?.verifiedBalance ?? null,
          calcBalance: a.calcBalance ?? existing?.calcBalance ?? 0,
          workspace: a.workspace ?? existing?.workspace ?? get().settings.workspace, updatedAt: now(),
        };
        set((s) => ({ accounts: upsert(s.accounts, acc) }));
        return acc;
      },
      deleteAccount: (id) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, deleted: true, updatedAt: now() } : a)) })),

      addTransaction: (t) => {
        const tx: Transaction = { ...t, id: uid(), source: 'manual', workspace: t.workspace ?? get().settings.workspace, updatedAt: now() };
        set((s) => ({ transactions: linkTransfers(upsert(s.transactions, tx), [tx]) }));
        return tx;
      },
      updateTransaction: (id, p, learnCategory) =>
        set((s) => {
          const old = s.transactions.find((t) => t.id === id);
          if (!old) return s;
          const next = { ...old, ...p, updatedAt: now() };
          const learned = learnCategory && p.categoryId && old.counterparty ? { ...s.learned, [old.counterparty.trim().toLowerCase()]: p.categoryId } : s.learned;
          return { transactions: upsert(s.transactions, next), learned };
        }),
      deleteTransaction: (id) =>
        set((s) => {
          const un = unlinkTx(s, id); // a deleted loan transaction takes its repayment (or its debt) with it
          return { debts: un.debts, transactions: un.transactions.map((t) => (t.id === id ? { ...t, deleted: true, updatedAt: now() } : t)) };
        }),

      flipTransaction: (id) =>
        set((s) => {
          const old = s.transactions.find((t) => t.id === id);
          if (!old || old.type === 'transfer') return s;
          const un = unlinkTx(s, id);
          const cur = un.transactions.find((t) => t.id === id)!;
          const type: Transaction['type'] = cur.type === 'income' ? 'expense' : 'income';
          const flipped: Transaction = {
            ...cur, type, transferGroup: '', fee: type === 'income' ? 0 : cur.fee, incomeKind: type === 'income' ? 'other' : undefined, updatedAt: now(),
            categoryId: categorize({ type, channel: cur.channel, counterparty: cur.counterparty, note: cur.note, learned: s.learned }),
          };
          const cleared = clearTransfer(un.transactions, cur);
          return { debts: un.debts, transactions: upsert(cleared, flipped) };
        }),

      moveToDebt: (id, opts) =>
        set((s) => {
          const old = s.transactions.find((t) => t.id === id);
          const person = opts.person.trim();
          if (!old || old.type === 'transfer' || !person) return s;
          const un = unlinkTx(s, id);
          const cur = un.transactions.find((t) => t.id === id)!;
          const debt: Debt = {
            id: uid(), direction: cur.type === 'expense' ? 'lent' : 'borrowed', person, principal: cur.amount, repayments: [],
            dueDate: opts.dueDate ?? null, note: cur.note, sourceTxId: cur.id, workspace: cur.workspace, updatedAt: now(),
          };
          const linked: Transaction = { ...cur, debtId: debt.id, transferGroup: '', counterparty: cur.counterparty || person, categoryId: cur.type === 'expense' ? 'debt' : 'debt_in', updatedAt: now() };
          return { debts: [debt, ...un.debts], transactions: upsert(clearTransfer(un.transactions, cur), linked) };
        }),

      applyToDebt: (txId, debtId) => {
        const s = get();
        const tx = s.transactions.find((t) => t.id === txId && !t.deleted);
        const debt = s.debts.find((d) => d.id === debtId && !d.deleted);
        if (!tx || !debt || tx.type === 'transfer') return false;
        // Money going out repays something I borrowed; money coming in is a person paying back what I lent.
        if ((tx.type === 'expense') !== (debt.direction === 'borrowed')) return false;
        const outstanding = Math.max(0, debt.principal - debt.repayments.reduce((n, r) => n + r.amount, 0));
        if (outstanding <= 0) return false;
        set((st) => {
          const un = unlinkTx(st, txId);
          const cur = un.transactions.find((t) => t.id === txId)!;
          const repayment = { id: uid(), amount: Math.min(cur.amount, outstanding), at: cur.occurredAt, txId };
          return {
            debts: un.debts.map((d) => (d.id === debtId ? { ...d, repayments: [...d.repayments, repayment], updatedAt: now() } : d)),
            transactions: upsert(clearTransfer(un.transactions, cur), { ...cur, debtId, transferGroup: '', categoryId: cur.type === 'expense' ? 'debt' : 'debt_in', updatedAt: now() }),
          };
        });
        return true;
      },

      unlinkDebt: (txId) => set((s) => unlinkTx(s, txId)),

      pruneStale: () => {
        const s = get();
        const cutoff = smsCutoff();
        if (s.unparsed.some((u) => u.date < cutoff)) set((st) => ({ unparsed: st.unparsed.filter((u) => u.date >= cutoff) }));
        const stale = s.accounts.filter((a) => isStaleSmsAccount(a, s.transactions));
        if (!stale.length) return 0;
        const ids = new Set(stale.map((a) => a.id));
        set((st) => ({
          accounts: st.accounts.map((a) => (ids.has(a.id) ? { ...a, deleted: true, updatedAt: now() } : a)),
          transactions: st.transactions.map((t) => (ids.has(t.accountId) && !t.deleted ? { ...t, deleted: true, updatedAt: now() } : t)),
        }));
        return stale.length;
      },

      ingestSms: (raw) => {
        const s = get();
        const seen = new Set(s.transactions.map((t) => t.dedupeHash).filter(Boolean) as string[]);
        const seenUnparsed = new Set(s.unparsed.map((u) => u.id));
        let accounts = s.accounts.slice();
        const fresh: Transaction[] = [];
        const unparsed: UnparsedSms[] = [];

        const cutoff = smsCutoff(); // messages older than 5 months belong to accounts that are no longer in use
        for (const m of [...raw].sort((a, b) => a.date - b.date)) {
          if (m.date < cutoff) continue;
          const v = parseSms(m.address, m.body, m.date);
          if (v.kind === 'unparsed') {
            if (!seenUnparsed.has(m.id)) unparsed.push({ id: m.id, address: m.address, body: m.body, date: m.date });
            continue;
          }
          if (v.kind !== 'parsed') continue;
          const p = v.tx;
          if (seen.has(p.dedupeHash)) continue;
          seen.add(p.dedupeHash);
          // The same SMS can arrive twice (live capture and an inbox re-scan) with timestamps a few seconds apart.
          const near = (t: Transaction) => t.source === 'sms' && !t.deleted && t.type === p.type && t.amount === p.amount && Math.abs(t.occurredAt - p.occurredAt) <= 3 * 60000
            && (p.balance === null || t.balanceAfter == null || t.balanceAfter === p.balance);
          if (s.transactions.some(near) || fresh.some(near)) continue;

          let acc = accounts.find((a) => !a.deleted && a.bankCode === p.bankCode && (!p.accountTail || !a.tail || a.tail === p.accountTail));
          if (!acc) {
            acc = {
              id: uid(), bankCode: p.bankCode, nickname: bankByCode(p.bankCode).name, tail: p.accountTail,
              verifiedBalance: null, calcBalance: 0, workspace: s.settings.workspace, updatedAt: now(),
            };
            accounts = [acc, ...accounts];
          }
          if (p.balance !== null && (!acc.verifiedBalance || p.occurredAt >= acc.verifiedBalance.at)) {
            acc = { ...acc, tail: acc.tail ?? p.accountTail, verifiedBalance: { amount: p.balance, at: p.occurredAt }, updatedAt: now() };
            accounts = accounts.map((a) => (a.id === acc!.id ? acc! : a));
          }
          fresh.push({
            id: uid(), accountId: acc.id, type: p.type, channel: p.channel, amount: p.amount, fee: p.fee, balanceAfter: p.balance,
            categoryId: categorize({ type: p.type, channel: p.channel, counterparty: p.counterparty, incomeKind: p.incomeKind, learned: s.learned }),
            incomeKind: p.incomeKind === 'salary' ? 'salary' : p.type === 'income' ? 'other' : undefined,
            counterparty: p.counterparty || bankByCode(p.bankCode).name, ref: p.ref, occurredAt: p.occurredAt, source: 'sms',
            dedupeHash: p.dedupeHash, workspace: acc.workspace, updatedAt: now(),
          });
        }
        if (fresh.length || unparsed.length) {
          set((st) => ({
            accounts,
            transactions: linkTransfers([...fresh, ...st.transactions], fresh),
            unparsed: [...unparsed, ...st.unparsed].slice(0, 200),
          }));
        }
        return { added: fresh.length, unparsed: unparsed.length };
      },
      dismissUnparsed: (id) => set((s) => ({ unparsed: s.unparsed.filter((u) => u.id !== id) })),

      saveBudget: (b) => {
        const item: Budget = { id: b.id ?? uid(), categoryId: b.categoryId ?? null, period: b.period, limit: b.limit, workspace: b.workspace ?? get().settings.workspace, updatedAt: now() };
        set((s) => ({ budgets: upsert(s.budgets, item) }));
      },
      deleteBudget: (id) => set((s) => ({ budgets: s.budgets.map((b) => (b.id === id ? { ...b, deleted: true, updatedAt: now() } : b)) })),

      saveDebt: (d) => {
        const old = d.id ? get().debts.find((x) => x.id === d.id) : undefined;
        const item: Debt = {
          id: d.id ?? uid(), direction: d.direction, person: d.person, principal: d.principal, repayments: old?.repayments ?? d.repayments ?? [],
          dueDate: d.dueDate ?? null, note: d.note, workspace: d.workspace ?? old?.workspace ?? get().settings.workspace, updatedAt: now(),
        };
        set((s) => ({ debts: upsert(s.debts, item) }));
      },
      addRepayment: (debtId, amount) =>
        set((s) => ({ debts: s.debts.map((d) => (d.id === debtId ? { ...d, repayments: [...d.repayments, { id: uid(), amount, at: now() }], updatedAt: now() } : d)) })),
      deleteDebt: (id) =>
        set((s) => ({
          debts: s.debts.map((d) => (d.id === id ? { ...d, deleted: true, updatedAt: now() } : d)),
          transactions: s.transactions.map((t) => (t.debtId === id ? recategorize(t, s.learned) : t)), // they count as normal money again
        })),

      saveGoal: (g) => {
        const old = g.id ? get().goals.find((x) => x.id === g.id) : undefined;
        const item: Goal = { id: g.id ?? uid(), name: g.name, icon: g.icon ?? old?.icon ?? 'flag', target: g.target, saved: g.saved ?? old?.saved ?? 0, deadline: g.deadline ?? null, updatedAt: now() };
        set((s) => ({ goals: upsert(s.goals, item) }));
      },
      contribute: (goalId, amount) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? { ...g, saved: Math.max(0, g.saved + amount), updatedAt: now() } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, deleted: true, updatedAt: now() } : g)) })),

      saveBill: (b) => {
        const old = b.id ? get().bills.find((x) => x.id === b.id) : undefined;
        const item: Bill = {
          id: b.id ?? uid(), name: b.name, icon: b.icon ?? old?.icon ?? 'receipt', amount: b.amount, repeat: b.repeat ?? old?.repeat ?? 'monthly',
          nextDue: b.nextDue, categoryId: b.categoryId ?? old?.categoryId ?? 'bills', workspace: b.workspace ?? old?.workspace ?? get().settings.workspace, updatedAt: now(),
        };
        set((s) => ({ bills: upsert(s.bills, item) }));
      },
      payBill: (billId, accountId) => {
        const bill = get().bills.find((b) => b.id === billId);
        if (!bill) return;
        const acc = accountId ?? get().accounts.find((a) => !a.deleted && a.workspace === bill.workspace)?.id;
        if (acc) get().addTransaction({ accountId: acc, type: 'expense', channel: 'payment', amount: bill.amount, fee: 0, categoryId: bill.categoryId, counterparty: bill.name, occurredAt: now(), workspace: bill.workspace, note: 'Bill payment' });
        const d = new Date(bill.nextDue);
        const next = bill.repeat === 'monthly' ? new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime() : bill.repeat === 'weekly' ? addDays(bill.nextDue, 7) : null;
        set((s) => ({
          bills: s.bills.map((b) => (b.id === billId ? { ...b, nextDue: next ?? b.nextDue, deleted: next === null ? true : b.deleted, updatedAt: now() } : b)),
        }));
      },
      deleteBill: (id) => set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, deleted: true, updatedAt: now() } : b)) })),

      refreshAlerts: () => {
        const s = get();
        const fresh = computeAlerts({
          txs: s.transactions, budgets: s.budgets, bills: s.bills, debts: s.debts, categories: s.categories, ws: s.settings.workspace,
          existingKeys: new Set(s.notifications.map((n) => n.key!).filter(Boolean)),
        });
        if (fresh.length) set((st) => ({ notifications: [...fresh, ...st.notifications].slice(0, 100) }));
        return fresh;
      },
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      mergeRemote: (changes, serverTime) =>
        set((s) => {
          const next: Partial<Data> = {};
          for (const name of SYNC_COLLECTIONS) {
            const incoming = changes[name];
            if (!incoming?.length) continue;
            const list = (s[name] as Syncable[]).slice();
            for (const doc of incoming) {
              const i = list.findIndex((x) => x.id === doc.id);
              if (i === -1) list.push(doc);
              else if (doc.updatedAt > list[i].updatedAt) list[i] = doc;
            }
            (next as Record<string, unknown>)[name] = list;
          }
          return { ...next, settings: { ...s.settings, lastSync: serverTime } };
        }),

      loadDemo: () => {
        const s = get();
        const t = now();
        get().ingestSms(demoSms(t));
        if (!s.budgets.length) {
          get().saveBudget({ categoryId: null, period: 'monthly', limit: toMinor(12000) });
          get().saveBudget({ categoryId: 'food', period: 'monthly', limit: toMinor(2500) });
          get().saveBudget({ categoryId: 'transport', period: 'weekly', limit: toMinor(600) });
        }
        if (!s.bills.length) {
          get().saveBill({ name: 'House rent', icon: 'home', amount: toMinor(3500), nextDue: addDays(startOfDay(t), 12), repeat: 'monthly', categoryId: 'rent' });
          get().saveBill({ name: 'Electricity', icon: 'flash', amount: toMinor(640), nextDue: addDays(startOfDay(t), 2), repeat: 'monthly', categoryId: 'bills' });
          get().saveBill({ name: 'Internet', icon: 'wifi', amount: toMinor(1100), nextDue: addDays(startOfDay(t), 6), repeat: 'monthly', categoryId: 'bills' });
        }
        if (!s.debts.length) {
          get().saveDebt({ person: 'Dawit Bekele', direction: 'lent', principal: toMinor(2000), dueDate: addDays(startOfDay(t), 5), note: 'Emergency loan' });
          get().saveDebt({ person: 'Meseret Alemu', direction: 'borrowed', principal: toMinor(1500), dueDate: addDays(startOfDay(t), 9) });
        }
        if (!s.goals.length) get().saveGoal({ name: 'New phone', icon: 'phone-portrait', target: toMinor(25000), saved: toMinor(6400), deadline: addDays(startOfDay(t), 120) });
        get().setSettings({ payday: 1, userName: s.settings.userName || 'Haile' });
        get().refreshAlerts();
      },

      resetAll: () => set({ ...{ settings: { ...initialSettings, language: get().settings.language }, accounts: [], transactions: [], categories: DEFAULT_CATEGORIES, budgets: [], debts: [], goals: [], bills: [], notifications: [], unparsed: [], learned: {} } }),
    }),
    {
      name: 'birrpulse-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { hydrated: _h, ...rest } = s;
        void _h;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function'));
      },
      // Keep new settings (added in later versions) when older saved data is loaded.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const settings = { ...current.settings, ...(p.settings ?? {}) };
        if (settings.userType) settings.workspace = settings.userType === 'business' ? 'business' : 'personal'; // one role, one workspace
        return { ...current, ...p, categories: DEFAULT_CATEGORIES, settings };
      },
      onRehydrateStorage: () => (state) => {
        setLang(state?.settings?.language ?? 'en');
        useApp.setState({ hydrated: true });
      },
    },
  ),
);

export const selectWorkspace = (s: AppState) => s.settings.workspace;
