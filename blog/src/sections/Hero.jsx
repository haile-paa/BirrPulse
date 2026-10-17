import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import DownloadButtons from '../components/DownloadButtons'
import HeroVisual from '../components/HeroVisual'
import { useLang } from '../i18n'
import { useInView, useWindowWidth } from '../hooks'

const word = {
  hidden: { y: '110%', rotate: 3 },
  show: (i) => ({ y: 0, rotate: 0, transition: { delay: 0.1 + i * 0.07, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] } }),
}

export default function Hero() {
  const { t, lang } = useLang()
  const calm = useReducedMotion()
  const w = useWindowWidth()
  const [ref, inView] = useInView()
  const words = t('hero.title').split(' ')

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-pine">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(60%_60%_at_76%_45%,#1f6a63_0%,#0b2a27_72%)]" />
      <div className="absolute inset-0 -z-10">
        <HeroVisual narrow={w < 900} calm={!!calm} active={inView} />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-[5] bg-gradient-to-r from-pine via-pine/55 to-transparent max-md:bg-gradient-to-b max-md:from-pine/30 max-md:via-pine/60 max-md:to-pine" />

      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-28 md:px-8 max-md:pt-[24rem]">
        <div className="max-w-2xl">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-amber">
            {t('hero.kicker')}
          </motion.p>
          <h1 className={`font-display font-extrabold leading-[1.02] text-white ${lang === 'am' ? 'text-5xl md:text-6xl' : 'text-[2.8rem] sm:text-6xl md:text-7xl'}`}>
            {words.map((wd, i) => (
              <span key={wd + i} className="mr-[0.25em] inline-block overflow-hidden align-bottom">
                <motion.span custom={i} variants={word} initial="hidden" animate="show" className="inline-block">{wd}</motion.span>
              </span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }} className="mt-6 max-w-xl text-lg leading-8 text-white/80">
            {t('hero.sub')}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.6 }}>
            <DownloadButtons className="mt-8" />
            <p className="mt-5 flex items-center gap-2 text-sm text-white/65">
              <ShieldCheck className="h-4 w-4 text-amber" /> {t('hero.note')}
              <Link to="/#screens" className="ml-3 font-semibold text-white underline decoration-amber decoration-2 underline-offset-4 hover:text-white">{t('cta.seeScreens')}</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
