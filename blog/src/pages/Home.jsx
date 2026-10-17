import Hero from '../sections/Hero'
import HowItWorks from '../sections/HowItWorks'
import Features from '../sections/Features'
import Showcase from '../sections/Showcase'
import Trust from '../sections/Trust'
import Privacy from '../sections/Privacy'
import Audiences from '../sections/Audiences'
import BlogPreview from '../sections/BlogPreview'
import DownloadCta from '../sections/DownloadCta'
import Faq from '../sections/Faq'
import { usePageTitle } from '../hooks'

export default function Home() {
  usePageTitle('')
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Showcase />
      <Trust />
      <Privacy />
      <Audiences />
      <BlogPreview />
      <DownloadCta />
      <Faq />
    </>
  )
}
