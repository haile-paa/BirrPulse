import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ChartColumn, MessageSquare, Receipt, ShieldCheck } from 'lucide-react'
import { useLang } from '../i18n'

const steps = [
  { k: 1, Icon: MessageSquare },
  { k: 2, Icon: ShieldCheck },
  { k: 3, Icon: Receipt },
  { k: 4, Icon: ChartColumn },
]

function Step({ i, progress, Icon, title, text }) {
  const start = i / 4
  const on = useTransform(progress, [start, start + 0.12], [0, 1])
  const scale = useTransform(on, [0, 1], [0.85, 1])
  const bg = useTransform(on, [0, 1], ['#cfe7e3', '#3a8d87'])
  const color = useTransform(on, [0, 1], ['#1e5e59', '#ffffff'])
  return (
    <li className="relative flex gap-5 pl-0 md:block md:pt-14">
      <motion.span
        style={{ scale, backgroundColor: bg, color }}
        className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg md:absolute md:left-0 md:top-0"
      >
        <Icon className="h-6 w-6" />
      </motion.span>
      <div>
        <h3 className="text-xl font-bold md:mt-0">{title}</h3>
        <p className="mt-1.5 max-w-[16rem] leading-7 text-ink/70">{text}</p>
      </div>
    </li>
  )
}

export default function HowItWorks() {
  const { t } = useLang()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 55%'] })
  const bikeLeft = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section id="how" className="scroll-mt-16 bg-mint py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <h2 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">{t('how.title')}</h2>
        <div ref={ref} className="relative mt-16">
          {/* progress rail (desktop) */}
          <div className="absolute left-6 right-6 top-6 hidden h-1 rounded-full bg-teal/20 md:block">
            <motion.div style={{ scaleX: scrollYProgress, transformOrigin: 'left' }} className="h-full rounded-full bg-teal" />
            <motion.div style={{ left: bikeLeft }} className="absolute -top-3.5 -ml-3 text-amber">
              <ChartColumn className="h-7 w-7 drop-shadow" strokeWidth={2.5} />
            </motion.div>
          </div>
          {/* progress rail (mobile) */}
          <div className="absolute bottom-6 left-6 top-6 w-1 -translate-x-1/2 rounded-full bg-teal/20 md:hidden">
            <motion.div style={{ scaleY: scrollYProgress, transformOrigin: 'top' }} className="h-full rounded-full bg-teal" />
          </div>
          <ol className="relative grid gap-12 md:grid-cols-4 md:gap-8">
            {steps.map(({ k, Icon }, i) => (
              <Step key={k} i={i} progress={scrollYProgress} Icon={Icon} title={t(`how.${k}.t`)} text={t(`how.${k}.d`)} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
