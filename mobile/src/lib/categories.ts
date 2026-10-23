import type { Category, Channel } from '@/types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food', icon: 'fast-food', color: '#F2A33A', kind: 'expense' },
  { id: 'transport', name: 'Transport', icon: 'car', color: '#4A90D9', kind: 'expense' },
  { id: 'shopping', name: 'Shopping', icon: 'bag-handle', color: '#B66DD1', kind: 'expense' },
  { id: 'rent', name: 'Rent', icon: 'home', color: '#3A8D87', kind: 'expense' },
  { id: 'bills', name: 'Bills', icon: 'flash', color: '#F2C94C', kind: 'expense' },
  { id: 'airtime', name: 'Airtime & data', icon: 'call', color: '#56B8A8', kind: 'expense' },
  { id: 'health', name: 'Health', icon: 'medkit', color: '#EF5B5B', kind: 'expense' },
  { id: 'education', name: 'Education', icon: 'school', color: '#5B8DEF', kind: 'expense' },
  { id: 'fun', name: 'Entertainment', icon: 'film', color: '#E86FA3', kind: 'expense' },
  { id: 'stock', name: 'Stock & supplies', icon: 'cube', color: '#8D6E63', kind: 'expense' },
  { id: 'supplier', name: 'Supplier payments', icon: 'business', color: '#6C7A89', kind: 'expense' },
  { id: 'staff', name: 'Staff', icon: 'people', color: '#4DB6AC', kind: 'expense' },
  { id: 'fees', name: 'Bank fees', icon: 'receipt', color: '#9AA5A3', kind: 'expense' },
  { id: 'other_exp', name: 'Other', icon: 'ellipsis-horizontal', color: '#9AA5A3', kind: 'expense' },
  { id: 'debt', name: 'Lent / debt', icon: 'swap-horizontal', color: '#8E9BA8', kind: 'expense' },
  { id: 'salary', name: 'Salary', icon: 'briefcase', color: '#2E9E6B', kind: 'income' },
  { id: 'business_inc', name: 'Business income', icon: 'storefront', color: '#3A8D87', kind: 'income' },
  { id: 'allowance', name: 'Allowance', icon: 'wallet', color: '#5BB98B', kind: 'income' },
  { id: 'gift', name: 'Gift', icon: 'gift', color: '#E86FA3', kind: 'income' },
  { id: 'other_inc', name: 'Other income', icon: 'cash', color: '#7FBF9E', kind: 'income' },
  { id: 'debt_in', name: 'Borrowed / debt', icon: 'swap-horizontal', color: '#8E9BA8', kind: 'income' },
];

/** Categories the app assigns by itself (loans). They are not offered in the category pickers. */
export const AUTO_CATEGORY_IDS = new Set(['debt', 'debt_in']);
export const pickable = (cats: Category[]): Category[] => cats.filter((c) => !AUTO_CATEGORY_IDS.has(c.id));

export const categoryById = (cats: Category[], id: string): Category =>
  cats.find((c) => c.id === id) ?? DEFAULT_CATEGORIES.find((c) => c.id === id) ?? DEFAULT_CATEGORIES.find((c) => c.id === 'other_exp')!;

const RULES: Array<[string, RegExp]> = [
  ['rent', /\brent|landlord|house rent/i],
  ['bills', /electric|\beeu\b|\beep\b|water|wasasa|internet|utility|dstv|\bbill\b/i],
  ['food', /restaurant|cafe|coffee|kaldi|tomoca|pizza|burger|bakery|supermarket|shoa|food|lunch|dinner|injera|yod|buna|juice/i],
  ['transport', /\bride\b|feres|zay|taxi|fuel|oilibya|nopetrol|\bbus\b|anbessa|sheger|parking|transport/i],
  ['health', /pharmacy|hospital|clinic|medical|\bdrug|lab\b/i],
  ['education', /school|college|university|tuition|book|library|course/i],
  ['shopping', /\bshop|\bmall\b|market|\bstore\b|boutique|merkato|\bmart\b/i],
  ['fun', /cinema|netflix|game|music|\bbet\b|movie/i],
  ['stock', /stock|inventory|wholesale|supplies/i],
  ['staff', /wage|staff|employee pay|payroll out/i],
];

export function categorize(args: {
  type: 'income' | 'expense';
  channel: Channel;
  counterparty: string;
  note?: string;
  incomeKind?: string;
  learned?: Record<string, string>;
}): string {
  const key = args.counterparty.trim().toLowerCase();
  if (key && args.learned?.[key]) return args.learned[key];
  const hay = `${args.counterparty} ${args.note ?? ''}`;
  if (args.type === 'income') {
    if (args.incomeKind === 'salary' || /salary|payroll/i.test(hay)) return 'salary';
    return 'other_inc';
  }
  if (args.channel === 'airtime') return 'airtime';
  if (args.channel === 'fee') return 'fees';
  for (const [id, re] of RULES) if (re.test(hay)) return id;
  return 'other_exp';
}
