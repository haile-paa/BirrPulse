import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PostCover from '../components/PostCover'
import { formatDate, posts } from '../data/posts'
import { useLang } from '../i18n'

export default function BlogPreview() {
  const { t } = useLang()
  const [first, ...rest] = posts
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex items-end justify-between gap-6">
          <h2 className="text-4xl font-extrabold leading-tight md:text-5xl">{t('blog.title')}</h2>
          <Link to="/blog" className="hidden items-center gap-2 font-semibold text-teal-deep hover:underline sm:flex">
            {t('blog.all')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <Link to={`/blog/${first.slug}`} className="group overflow-hidden rounded-[2rem] bg-mint">
            <PostCover cover={first.cover} className="h-72 md:h-96" />
            <div className="p-7">
              <p className="text-sm font-semibold text-teal-deep">{first.tag}, {formatDate(first.date)}</p>
              <h3 className="mt-2 text-2xl font-bold md:text-3xl">{first.title}</h3>
              <p className="mt-2 max-w-xl leading-7 text-ink/70">{first.excerpt}</p>
            </div>
          </Link>
          <div className="flex flex-col gap-5">
            {rest.slice(0, 3).map((p) => (
              <Link key={p.slug} to={`/blog/${p.slug}`} className="group grid grid-cols-[7rem_1fr] gap-5 rounded-3xl p-3 transition hover:bg-mint sm:grid-cols-[9rem_1fr]">
                <PostCover cover={p.cover} className="h-36 rounded-2xl" />
                <div className="self-center">
                  <p className="text-xs font-semibold text-teal-deep">{p.tag}</p>
                  <h3 className="mt-1 text-lg font-bold leading-snug">{p.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
