export type TxType = 'income' | 'expense' | 'transfer';
export type Workspace = 'personal' | 'business';
export type Channel = 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'airtime' | 'fee' | 'other';
export type Period = 'daily' | 'weekly' | 'monthly';
export type UserType = 'student' | 'employee' | 'business';

/** All money values are integers in minor units (cents). 1,250.50 ETB = 125050. */
export interface Account {
  id: string;
  bankCode: string;
  nickname: string;
  tail?: string;
  verifiedBalance?: { amount: number; at: number } | null;
  calcBalance: number;
  workspace: Workspace;
  updatedAt: number;
  deleted?: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: TxType;
  channel: Channel;
  amount: number;
  fee: number;
  balanceAfter?: number | null;
  categoryId: string;
  incomeKind?: 'salary' | 'business' | 'allowance' | 'other';
  counterparty: string;
  ref?: string;
  occurredAt: number;
  source: 'sms' | 'manual';
  dedupeHash?: string;
  note?: string;
  workspace: Workspace;
  transferGroup?: string;
  /** Set when this money movement is a loan or its repayment. It is then not counted as income or spending. '' = none. */
  debtId?: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: 'expense' | 'income';
}

export interface Budget {
  id: string;
  categoryId: string | null;
  period: Period;
  limit: number;
  workspace: Workspace;
  updatedAt: number;
  deleted?: boolean;
}

export interface Repayment { id: string; amount: number; at: number; /** the transaction that recorded this repayment */ txId?: string }

export interface Debt {
  id: string;
  direction: 'borrowed' | 'lent';
  person: string;
  principal: number;
  repayments: Repayment[];
  dueDate?: number | null;
  note?: string;
  /** The transaction this debt was created from ("Move to debt"). */
  sourceTxId?: string;
  workspace: Workspace;
  updatedAt: number;
  deleted?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  deadline?: number | null;
  updatedAt: number;
  deleted?: boolean;
}

export interface Bill {
  id: string;
  name: string;
  icon: string;
  amount: number;
  repeat: 'monthly' | 'weekly' | 'once';
  nextDue: number;
  categoryId: string;
  workspace: Workspace;
  updatedAt: number;
  deleted?: boolean;
}

export interface AppNotification {
  id: string;
  kind: 'budget' | 'bill' | 'debt' | 'spending' | 'goal' | 'info';
  title: string;
  body: string;
  at: number;
  read: boolean;
  key?: string;
}

export interface UnparsedSms { id: string; address: string; body: string; date: number }

export interface Settings {
  workspace: Workspace;
  userType: UserType | null;
  onboarded: boolean;
  smsEnabled: boolean;
  lastSmsScan: number;
  lastSync: number;
  payday: number | null;
  /** Employee: the company. Student: who sends the allowance (optional). */
  incomeSource: string;
  /** Monthly salary / allowance in minor units, or null. */
  incomeAmount: number | null;
  /** Id of the account whose data is on this phone, so another account never sees it. */
  ownerId: string | null;
  /** false while the role / salary answers still have to be saved to the account. */
  profileSynced: boolean;
  notificationsOn: boolean;
  userName: string;
  language: 'en' | 'am';
}
