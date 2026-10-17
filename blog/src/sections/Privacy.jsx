import { motion } from 'framer-motion'
import { Smartphone, ShieldCheck, ToggleRight } from 'lucide-react'
import { site } from '../config'
import { useLang } from '../i18n'

const cards = [
  { Icon: ShieldCheck, t: 'Supported banks only', d: 'BirrPulse only reads messages from supported banks. Personal messages are ignored.' },
  { Icon: Smartphone, t: 'Read on your phone', d: 'Messages are turned into transactions on your phone, not read out loud somewhere else.' },
  { Icon: ToggleRight, t: 'Your choice', d: 'Switch Automatic SMS tracking on or off any time, or decline and add transactions by hand.' },
]

export default function Privacy() {
  const { t } = useLang()
  return (
    <section id="privacy" className="relative scroll-mt-16 overflow-hidden bg-pine-2 py-24 text-white md:py-32">
      <div className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-teal/25 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <h2 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">{t('priv.title')}</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map(({ Icon, t: title, d }, i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="rounded-[2rem] bg-white/[0.07] p-8 ring-1 ring-white/10">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber text-pine"><Icon className="h-7 w-7" /></span>
              <h3 className="mt-6 text-2xl font-bold">{title}</h3>
              <p className="mt-2 leading-7 text-white/75">{d}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-white/60">Starts with</span>
          {site.banks.map((b) => <span key={b} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium">{b}</span>)}
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-white/55">SMS tracking works on Android. It depends on the permission you give and on the format of your bank messages.</p>
      </div>
    </section>
  )
}
