import { motion } from 'framer-motion'
import PhoneFrame from '../components/PhoneFrame'
import { useLang } from '../i18n'

function Tag({ children, tone, style }) {
  const tones = { teal: 'bg-teal text-white', amber: 'bg-amber text-pine' }
  return (
    <span style={style} className={`absolute z-20 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold shadow-lg ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default function Trust() {
  const { t } = useLang()
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="max-w-lg text-4xl font-extrabold leading-tight md:text-5xl">{t('trust.title')}</h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-ink/75">
            BirrPulse tells you which number it worked out itself and which number your bank sent. You never have to guess.
          </p>
          <dl className="mt-10 space-y-7">
            <div className="border-l-4 border-teal pl-5">
              <dt className="text-xl font-bold">Calculated</dt>
              <dd className="mt-1 leading-7 text-ink/70">Your total balance carries a Calculated badge. BirrPulse works it out from the transactions it knows about.</dd>
            </div>
            <div className="border-l-4 border-amber pl-5">
              <dt className="text-xl font-bold">Reported by your bank</dt>
              <dd className="mt-1 leading-7 text-ink/70">Open any transaction to see Balance after (bank): the figure your bank put in its own message.</dd>
            </div>
            <div className="border-l-4 border-ink/20 pl-5">
              <dt className="text-xl font-bold">Spot what is missing</dt>
              <dd className="mt-1 leading-7 text-ink/70">If some bank messages cannot be read, a banner on the home screen tells you how many, and lets you review them.</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto flex h-[34rem] w-full max-w-lg items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-teal-deep to-teal sm:h-[38rem]">
          <motion.div initial={{ opacity: 0, y: 40, rotate: -9 }} whileInView={{ opacity: 1, y: 0, rotate: -5 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} className="absolute left-[4%] top-[8%] w-[48%]">
            <PhoneFrame id="b1" alt="Home screen with the Calculated badge" tilt />
            <Tag tone="amber" style={{ right: '-6%', top: '15%' }}>Calculated</Tag>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 60, rotate: 9 }} whileInView={{ opacity: 1, y: 0, rotate: 5 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }} className="absolute right-[4%] top-[18%] w-[48%]">
            <PhoneFrame id="b3" alt="Transaction details with the bank-reported balance" tilt />
            <Tag tone="teal" style={{ left: '-10%', top: '66%' }}>Reported by your bank</Tag>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
