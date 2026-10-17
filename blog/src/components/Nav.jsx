import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { useLang } from '../i18n'
import { site } from '../config'

const links = [
  ['nav.how', '/#how'],
  ['nav.features', '/#features'],
  ['nav.screens', '/#screens'],
  ['nav.privacy', '/#privacy'],
  ['nav.blog', '/blog'],
]

export default function Nav() {
  const { t, lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => setOpen(false), [pathname])

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${solid || open ? 'bg-pine/85 shadow-[0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl' : 'bg-transparent'}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8" aria-label="Main">
        <Logo />
        <ul className="hidden items-center gap-8 lg:flex">
          {links.map(([k, to]) => (
            <li key={k}><Link to={to} className="text-sm font-medium text-white/75 transition hover:text-white">{t(k)}</Link></li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-semibold" role="group" aria-label="Language">
            {[['en', 'EN'], ['am', 'አማ']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setLang(id)}
                aria-pressed={lang === id}
                className={`rounded-full px-3 py-1.5 transition ${lang === id ? 'bg-teal text-white' : 'text-white/70 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <a href={site.apk.url} download className="hidden rounded-full bg-amber px-5 py-2 text-sm font-semibold text-pine transition hover:brightness-105 sm:block">{t('nav.download')}</a>
          <button className="rounded-lg p-2 text-white lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-5 pb-5 lg:hidden">
            {links.map(([k, to]) => (
              <li key={k}><Link to={to} className="block border-b border-white/10 py-3 text-lg font-medium text-white">{t(k)}</Link></li>
            ))}
            <li className="pt-4"><a href={site.apk.url} download className="block rounded-full bg-amber py-3 text-center font-semibold text-pine">{t('cta.apk')}</a></li>
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  )
}
