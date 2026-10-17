import { motion } from 'framer-motion'
import { Briefcase, CalendarCheck, ChartColumn, FileText, Gauge, Handshake, Languages, MessageSquare, PencilLine, PiggyBank } from 'lucide-react'
import { site } from '../config'
import { useLang } from '../i18n'

// `am` titles are the app's own Amharic translations.
const tiles = [
  { Icon: MessageSquare, title: 'Bank SMS, organised', am: 'የባንክ መልዕክቶችዎ፣ በሥርዓት', text: 'BirrPulse reads supported bank messages on your phone and turns them into income, expenses, deposits and withdrawals, with the fee and reference.', cls: 'bg-pine text-white md:col-span-2', icon: 'bg-amber text-pine', banks: true },
  { Icon: Gauge, title: 'Safe to spend per day', am: 'በቀን ማውጣት የሚቻል', text: 'The money left in your budget, spread over the days until payday.', cls: 'bg-white', icon: 'bg-teal text-white' },
  { Icon: ChartColumn, title: 'Statistics', am: 'ስታቲስቲክስ', text: 'Day, week, month and year views, with your top spending and biggest transactions.', cls: 'bg-white', icon: 'bg-teal text-white' },
  { Icon: CalendarCheck, title: 'Budgets', am: 'በጀቶች', text: 'Set an overall budget or one for a category, and see how you are doing.', cls: 'bg-teal text-white', icon: 'bg-white text-teal-deep' },
  { Icon: PiggyBank, title: 'Savings goals', am: 'የቁጠባ ግቦች', text: 'Pick a target and a date. BirrPulse tells you how much to save each month.', cls: 'bg-white', icon: 'bg-amber text-pine' },
  { Icon: Handshake, title: 'Debts and credit', am: 'ዕዳና ብድር', text: 'Keep track of who owes you and who you owe.', cls: 'bg-white', icon: 'bg-teal text-white' },
  { Icon: FileText, title: 'Reports', am: 'ሪፖርቶች', text: 'Cash flow for the last six months and where the money went by category. In the Business workspace, also what customers owe you and what you owe suppliers.', cls: 'bg-teal-deep text-white md:col-span-2', icon: 'bg-amber text-pine' },
  { Icon: Briefcase, title: 'Personal and business', am: 'የግል እና ንግድ', text: 'Switch workspace in one tap and keep the two apart.', cls: 'bg-white', icon: 'bg-teal text-white' },
  { Icon: Languages, title: 'English and Amharic', am: 'እንግሊዝኛ እና አማርኛ', text: 'Change the whole app to Amharic from your profile.', cls: 'bg-white', icon: 'bg-teal text-white' },
  { Icon: PencilLine, title: 'Add by hand', am: 'በእጅ መጨመር', text: 'No SMS permission? Add transactions yourself. The category fills in from the name.', cls: 'bg-white', icon: 'bg-amber text-pine' },
]

export default function Features() {
  const { t, lang } = useLang()
  return (
    <section id="features" className="scroll-mt-16 bg-teal-soft py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <h2 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">{t('feat.title')}</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {tiles.map(({ Icon, title, am, text, cls, icon, banks }, i) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.07 }}
              whileHover={{ y: -5 }}
              className={`group rounded-[2rem] p-7 shadow-sm md:p-8 ${cls}`}
            >
              <span className={`grid h-14 w-14 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${icon}`}>
                <Icon className="h-7 w-7" />
              </span>
              <h3 className="mt-6 text-2xl font-bold">{lang === 'am' ? am : title}</h3>
              <p className="mt-2 max-w-lg leading-7 opacity-80">{text}</p>
              {banks && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {site.banks.map((b) => <li key={b} className="rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-medium text-white/90">{b}</li>)}
                </ul>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
