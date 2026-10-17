import { Link, useParams } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import PhoneFrame from '../components/PhoneFrame'
import DownloadButtons from '../components/DownloadButtons'
import { formatDate, getPost, posts, readingTime } from '../data/posts'
import { usePageTitle } from '../hooks'
import NotFound from './NotFound'

function Block({ b }) {
  switch (b.t) {
    case 'h2': return <h2 className="mb-3 mt-12 text-3xl font-bold">{b.text}</h2>
    case 'p': return <p className="my-5">{b.text}</p>
    case 'ul':
      return (
        <ul className="my-5 space-y-3">
          {b.items.map((it) => (
            <li key={it} className="relative pl-7 before:absolute before:left-0 before:top-[0.7em] before:h-2.5 before:w-2.5 before:rounded-full before:bg-amber">{it}</li>
          ))}
        </ul>
      )
    case 'steps':
      return (
        <ol className="my-8 space-y-6">
          {b.items.map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal font-display font-bold text-white">{i + 1}</span>
              <div>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="mt-1 text-ink/75">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      )
    case 'callout':
      return <aside className="my-10 rounded-3xl border-l-8 border-amber bg-white p-6 text-lg font-medium shadow-sm">{b.text}</aside>
    case 'shots':
      return (
        <figure className="my-12">
          <div className="grid grid-cols-3 gap-4 rounded-[2rem] bg-gradient-to-br from-teal-deep to-teal p-5 sm:gap-8 sm:p-10">
            {b.ids.map((id, i) => (
              <div key={id} className={i === 1 ? 'sm:-translate-y-6' : ''}>
                <PhoneFrame id={id} tilt />
              </div>
            ))}
          </div>
          {b.caption && <figcaption className="mt-3 text-center text-sm text-ink/55">{b.caption}</figcaption>}
        </figure>
      )
    default: return null
  }
}

export default function Post() {
  const { slug } = useParams()
  const post = getPost(slug)
  usePageTitle(post?.title)
  const { scrollYProgress } = useScroll()
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 24 })
  if (!post) return <NotFound />
  const more = posts.filter((p) => p.slug !== slug).slice(0, 2)

  return (
    <main className="bg-mint pb-24">
      <motion.div style={{ scaleX: bar }} className="fixed inset-x-0 top-0 z-[60] h-1 origin-left bg-amber" />
      <header className="relative overflow-hidden bg-pine pb-16 pt-32 text-white">
        <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-teal/30 blur-[110px]" />
        <div className="relative mx-auto max-w-3xl px-5">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" /> All posts</Link>
          <p className="mt-8 text-sm font-semibold text-amber">{post.tag}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-6xl">{post.title}</h1>
          <p className="mt-5 text-white/60">{formatDate(post.date)}, {readingTime(post)} min read</p>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 pt-12 text-lg leading-8 text-ink/85">
        {post.blocks.map((b, i) => <Block key={i} b={b} />)}
        <div className="mt-16 rounded-[2rem] bg-pine p-8 text-white">
          <h2 className="text-2xl font-bold">Try BirrPulse</h2>
          <p className="mt-2 text-white/70">Free to download for Android.</p>
          <DownloadButtons className="mt-5" />
        </div>
      </article>
      <section className="mx-auto mt-20 max-w-3xl px-5">
        <h2 className="text-2xl font-bold">Keep reading</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {more.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <p className="text-sm font-semibold text-teal-deep">{p.tag}</p>
              <h3 className="mt-1 text-lg font-bold leading-snug">{p.title}</h3>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
