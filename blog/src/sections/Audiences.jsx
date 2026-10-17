import { motion } from 'framer-motion'
import { Briefcase, GraduationCap, Store } from 'lucide-react'
import { useLang } from '../i18n'

const people = [
  { Icon: GraduationCap, t: 'Student', am: 'ተማሪ', line: 'Make allowance last', d: 'Set a budget and see what is safe to spend each day until your next top-up.' },
  { Icon: Briefcase, t: 'Employee', am: 'ተቀጣሪ', line: 'Stretch salary to payday', d: 'Add your payday and the daily figure counts down to the day your salary arrives.' },
  { Icon: Store, t: 'Business owner', am: 'የንግድ ባለቤት', line: 'Cash flow and debts', d: 'Use the Business workspace for cash flow, what customers owe and what you owe suppliers.' },
]

export default function Audiences() {
  const { t, lang } = useLang()
  return (
    <section className="bg-mint py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <h2 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">{t('who.title')}</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {people.map(({ Icon, t: title, am, line, d }, i) => (
            <motion.article key={title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ y: -6 }} className="rounded-[2rem] bg-gradient-to-br from-teal-deep to-teal p-8 text-white shadow-lg">
              <Icon className="h-10 w-10 text-amber" />
              <p className="mt-8 text-sm font-semibold uppercase tracking-wider text-white/70">{lang === 'am' ? am : title}</p>
              <h3 className="mt-1 text-2xl font-bold">{line}</h3>
              <p className="mt-3 leading-7 text-white/80">{d}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
