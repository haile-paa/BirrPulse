import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Amharic terms for app features come from the app's own translations. The rest should be
// reviewed by a native speaker. Any key without Amharic falls back to English.
const dict = {
  en: {
    'nav.how': 'How it works',
    'nav.features': 'Features',
    'nav.screens': 'Screens',
    'nav.privacy': 'Privacy',
    'nav.blog': 'Blog',
    'nav.download': 'Download',
    'hero.kicker': 'Money tracker for Ethiopia',
    'hero.title': 'Your bank SMS, organised.',
    'hero.sub': 'BirrPulse reads supported bank messages on your phone and turns them into income, expenses, budgets and debts. Nothing to type.',
    'hero.note': 'Android. Personal messages are ignored.',
    'cta.apk': 'Download APK',
    'cta.play': 'Get it on Google Play',
    'cta.seeScreens': 'See the app',
    'how.title': 'From bank message to clear picture',
    'how.1.t': 'Your bank sends an SMS',
    'how.1.d': 'The same message you already get after every transaction.',
    'how.2.t': 'BirrPulse reads it on your phone',
    'how.2.d': 'Only supported banks. Personal messages are ignored.',
    'how.3.t': 'It becomes a transaction',
    'how.3.d': 'Income, expense, deposit or withdrawal, with the fee and reference.',
    'how.4.t': 'You see where you stand',
    'how.4.d': 'Balance, statistics, budgets and a safe daily spend.',
    'feat.title': 'Everything about your money, in Birr',
    'trust.title': 'Honest about every number',
    'priv.title': 'You stay in control of what is read',
    'who.title': 'Made for the way you earn and spend',
    'shots.title': 'A look inside the app',
    'blog.title': 'From the BirrPulse blog',
    'blog.all': 'All posts',
    'dl.title': 'Get BirrPulse on your phone',
    'dl.sub': 'Download the Android app straight from this page.',
    'dl.scan': 'Scan with your phone to download',
    'faq.title': 'Questions, answered',
    'footer.built': 'Built in Ethiopia by',
  },
  am: {
    'nav.how': 'እንዴት ይሰራል',
    'nav.features': 'ባህሪያት',
    'nav.screens': 'ስክሪኖች',
    'nav.privacy': 'ግላዊነት',
    'nav.blog': 'ብሎግ',
    'nav.download': 'አውርድ',
    'hero.title': 'የባንክ መልዕክቶችዎ፣ በሥርዓት።',
    'hero.sub': 'BirrPulse በስልክዎ ላይ የሚደገፉ የባንክ መልዕክቶችን አንብቦ ወደ ገቢ፣ ወጪ፣ በጀት እና ዕዳ ይቀይራል። ምንም መጻፍ አያስፈልግም።',
    'cta.apk': 'APK አውርድ',
    'cta.play': 'በ Google Play ያግኙ',
    'cta.seeScreens': 'መተግበሪያውን ይመልከቱ',
    'how.title': 'ከባንክ መልዕክት እስከ ግልጽ ምስል',
    'feat.title': 'ስለ ገንዘብዎ ሁሉም ነገር፣ በብር',
    'shots.title': 'የመተግበሪያው ውስጠኛ እይታ',
    'blog.title': 'ከ BirrPulse ብሎግ',
    'blog.all': 'ሁሉም ጽሑፎች',
    'dl.title': 'BirrPulse ን ስልክዎ ላይ ያግኙ',
    'dl.sub': 'የአንድሮይድ መተግበሪያውን ከዚህ ገጽ በቀጥታ ያውርዱ።',
    'dl.scan': 'ለማውረድ በስልክዎ ይቃኙ',
    'faq.title': 'ጥያቄዎች እና መልሶች',
  },
}

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k })

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('birrpulse-lang') || 'en' } catch { return 'en' }
  })
  useEffect(() => {
    document.documentElement.lang = lang
    try { localStorage.setItem('birrpulse-lang', lang) } catch { /* storage unavailable */ }
  }, [lang])
  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key) => dict[lang][key] ?? dict.en[key] ?? key,
  }), [lang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
