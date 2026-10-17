import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PhoneFrame from '../components/PhoneFrame'
import { groups, shots } from '../data/shots'
import { useLang } from '../i18n'
import { useWindowWidth } from '../hooks'

export default function Showcase() {
  const { t } = useLang()
  const [group, setGroup] = useState('start')
  const [idx, setIdx] = useState(0)
  const w = useWindowWidth()
  const list = shots.filter((s) => s.group === group)
  const pw = w < 640 ? 170 : w < 1024 ? 220 : 260
  const step = pw * (w < 640 ? 0.78 : 0.72)
  const go = (n) => setIdx(Math.max(0, Math.min(list.length - 1, n)))

  useEffect(() => setIdx(0), [group]) // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(idx + 1)
    if (e.key === 'ArrowLeft') go(idx - 1)
  }
  const current = list[idx] ?? list[0]

  return (
    <section id="screens" className="relative scroll-mt-16 overflow-hidden bg-pine py-24 text-white md:py-32">
      <div className="absolute left-1/2 top-1/2 -z-0 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/25 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <h2 className="max-w-xl text-4xl font-extrabold leading-tight md:text-5xl">{t('shots.title')}</h2>
          <div className="flex w-fit rounded-full bg-white/10 p-1" role="tablist" aria-label="App sections">
            {groups.map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={group === g.id}
                onClick={() => setGroup(g.id)}
                className="relative rounded-full px-4 py-2 text-sm font-semibold sm:px-5"
              >
                {group === g.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-teal" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="relative mt-12 touch-pan-y outline-none"
          style={{ height: pw * 2.167 + 40, perspective: 1600 }}
          tabIndex={0}
          onKeyDown={onKey}
          aria-roledescription="carousel"
          aria-label="App screenshots. Use left and right arrow keys."
        >
          <motion.div
            className="absolute inset-0"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50) go(idx + 1)
              else if (info.offset.x > 50) go(idx - 1)
            }}
          >
            {list.map((s, i) => {
              const off = i - idx
              const a = Math.abs(off)
              return (
                <motion.button
                  key={s.id}
                  onClick={() => go(i)}
                  aria-label={s.title}
                  initial={false}
                  animate={{
                    x: off * step,
                    rotateY: off * -30,
                    scale: 1 - Math.min(a, 3) * 0.13,
                    opacity: a > 2 ? 0 : 1 - a * 0.3,
                    zIndex: 10 - a,
                  }}
                  transition={{ type: 'spring', stiffness: 190, damping: 24 }}
                  style={{ width: pw, marginLeft: -pw / 2, left: '50%', top: 20, pointerEvents: a > 2 ? 'none' : 'auto' }}
                  className="absolute cursor-pointer"
                >
                  <PhoneFrame id={s.id} alt={s.title} />
                </motion.button>
              )
            })}
          </motion.div>
          <button onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous screen" className="absolute left-0 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20 disabled:opacity-30">
            <ChevronLeft />
          </button>
          <button onClick={() => go(idx + 1)} disabled={idx === list.length - 1} aria-label="Next screen" className="absolute right-0 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20 disabled:opacity-30">
            <ChevronRight />
          </button>
        </div>

        <div className="mx-auto mt-10 min-h-32 max-w-xl text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <h3 className="text-2xl font-bold">{current.title}</h3>
              <p className="mt-2 leading-7 text-white/70">{current.text}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-5 flex justify-center gap-2" aria-hidden>
            {list.map((s, i) => (
              <span key={s.id} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8 bg-amber' : 'w-1.5 bg-white/30'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
