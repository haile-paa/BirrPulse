import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { site } from '../config'
import { useLang } from '../i18n'

const faqs = [
  ['Which banks does it work with?', `It starts with ${site.banks.join(', ')}. More can be added as the parser learns new message formats.`],
  ['Does BirrPulse read all my messages?', 'No. It only reads messages from supported banks and ignores personal messages. The reading happens on your phone.'],
  ['Do I have to allow SMS access?', 'No. You can decline and add transactions by hand. Automatic SMS tracking can be switched on or off from your profile.'],
  ['Why is my balance different from my bank?', 'The total balance is calculated from the transactions BirrPulse knows about. Each transaction also shows the balance your bank reported. A missing message or an account you have not added can cause a difference.'],
  ['Is there an iPhone version?', 'The download on this site is for Android. Automatic SMS tracking relies on the SMS permission on Android.'],
  ['How do I install the APK?', 'Tap Download APK, open the downloaded file and allow installs from your browser if Android asks. Our blog has a step-by-step install guide.'],
  ['Is it safe to install an APK?', 'Install it only from this website or from the official store listing. Android will ask for a one-time permission, which you can turn off again afterwards.'],
]

export default function Faq() {
  const { t } = useLang()
  const [open, setOpen] = useState(0)
  return (
    <section className="bg-mint py-24 md:py-32">
      <div className="mx-auto grid max-w-5xl gap-12 px-5 md:px-8 lg:grid-cols-[0.7fr_1.3fr]">
        <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">{t('faq.title')}</h2>
        <div className="divide-y divide-ink/10">
          {faqs.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-6 py-5 text-left text-lg font-semibold">
                {q}
                <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal/15 text-teal-deep"><Plus className="h-4 w-4" /></motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <p className="max-w-xl pb-6 leading-7 text-ink/70">{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
