import { lazy, Suspense } from 'react'
import { useReducedMotion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import DownloadButtons from '../components/DownloadButtons'
import { site } from '../config'
import { useLang } from '../i18n'
import { hasWebGL, useInView } from '../hooks'

const PhoneScene = lazy(() => import('../components/three/PhoneScene'))

export default function DownloadCta() {
  const { t } = useLang()
  const calm = useReducedMotion()
  const [ref, inView] = useInView()
  const meta = [`Version ${site.apk.version}`, site.apk.size, site.apk.minAndroid].filter(Boolean)
  const apkAbsolute = new URL(site.apk.url, site.url).href

  return (
    <section id="download" ref={ref} className="relative scroll-mt-16 overflow-hidden bg-pine py-24 text-white md:py-32">
      <div className="absolute right-0 top-0 h-[34rem] w-[34rem] rounded-full bg-teal/30 blur-[130px]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 md:px-8 lg:grid-cols-2">
        <div>
          <h2 className="max-w-lg text-4xl font-extrabold leading-tight md:text-6xl">{t('dl.title')}</h2>
          <p className="mt-5 max-w-md text-lg leading-8 text-white/75">{t('dl.sub')}</p>
          <DownloadButtons className="mt-8" />
          {meta.length > 0 && <p className="mt-4 text-sm text-white/55">Android, {meta.join(', ')}</p>}
          <div className="mt-10 flex items-center gap-5 rounded-3xl bg-white/[0.06] p-4 sm:w-fit sm:pr-8">
            <div className="rounded-2xl bg-white p-2.5">
              <QRCodeSVG value={apkAbsolute} size={104} fgColor="#15103a" bgColor="#ffffff" level="M" />
            </div>
            <p className="max-w-[11rem] text-sm leading-6 text-white/75">{t('dl.scan')}</p>
          </div>
        </div>
        <div className="relative h-[30rem] md:h-[40rem]">
          {hasWebGL() ? (
            <Suspense fallback={null}>
              <PhoneScene calm={!!calm} active={inView} />
            </Suspense>
          ) : null}
        </div>
      </div>
    </section>
  )
}
