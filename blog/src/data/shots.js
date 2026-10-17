// Screenshot files live in /public/shots (b1..b9). Swap files or edit captions here.
export const shotSrc = (id) => `/shots/${id}.webp`

export const shots = [
  { id: 'b2', group: 'start', title: 'Your bank SMS, organised', text: 'BirrPulse reads supported bank messages on your phone and turns them into income, expenses, deposits and withdrawals.' },
  { id: 'b9', group: 'start', title: 'Set up in two quick steps', text: 'Tell it your name and whether you are a student, an employee or a business owner. Add a payday if you have one.' },
  { id: 'b1', group: 'money', title: 'Your balance at a glance', text: 'Total balance, income and expenses this month, what is safe to spend per day, and your latest transactions.' },
  { id: 'b3', group: 'money', title: 'Every transaction in detail', text: 'See who it was from, the time, account, fee and VAT, and the balance your bank reported after it.' },
  { id: 'b4', group: 'money', title: 'Statistics by day, week, month and year', text: 'Top spending categories and your biggest transactions, with a chart you can switch between income and expense.' },
  { id: 'b5', group: 'money', title: 'Debts and credit', text: 'Keep track of what people owe you and what you owe, and see both totals at the top.' },
  { id: 'b6', group: 'setup', title: 'Personal or business', text: 'Switch workspace and language, and manage accounts, budgets, savings goals, debts and reports from your profile.' },
  { id: 'b7', group: 'amharic', title: 'The home screen in Amharic', text: 'The whole app can be switched to Amharic with one tap.' },
  { id: 'b8', group: 'amharic', title: 'Statistics in Amharic', text: 'Charts, categories and transactions, all in Amharic.' },
]
export const groups = [
  { id: 'start', label: 'Get started' },
  { id: 'money', label: 'Your money' },
  { id: 'setup', label: 'Settings' },
  { id: 'amharic', label: 'አማርኛ' },
]
