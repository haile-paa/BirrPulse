import { Link } from 'react-router-dom'
import Logo from './Logo'
import { site } from '../config'
import { useLang } from '../i18n'

export default function Footer() {
  const { t } = useLang()
  return (
    <footer className="bg-pine text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-6">Track your money in Birr from the bank messages you already get.</p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-display text-base font-semibold text-white">Explore</p>
          <Link className="block hover:text-white" to="/#features">{t('nav.features')}</Link>
          <Link className="block hover:text-white" to="/#screens">{t('nav.screens')}</Link>
          <Link className="block hover:text-white" to="/#privacy">{t('nav.privacy')}</Link>
          <Link className="block hover:text-white" to="/blog">{t('nav.blog')}</Link>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-display text-base font-semibold text-white">Contact</p>
          <a className="block hover:text-white" href={`mailto:${site.support.email}`}>{site.support.email}</a>
          <a className="block hover:text-white" href={site.apk.url} download>{t('cta.apk')}</a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs md:px-8">
          © {new Date().getFullYear()} BirrPulse. {t('footer.built')}{' '}
          <a className="underline underline-offset-2 hover:text-white" href={site.developer.portfolio} target="_blank" rel="noreferrer">{site.developer.name}</a>.
        </p>
      </div>
    </footer>
  )
}
