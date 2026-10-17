import { Link } from 'react-router-dom'
import PostCover from '../components/PostCover'
import { formatDate, posts, readingTime } from '../data/posts'
import { usePageTitle } from '../hooks'

export default function Blog() {
  usePageTitle('Blog')
  return (
    <main className="min-h-screen bg-mint pb-24 pt-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <h1 className="text-5xl font-extrabold md:text-7xl">The BirrPulse blog</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-ink/70">Guides, explainers and updates on tracking your money with BirrPulse.</p>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <PostCover cover={p.cover} className="h-60" />
              <div className="flex flex-1 flex-col p-6">
                <p className="text-sm font-semibold text-teal-deep">{p.tag}</p>
                <h2 className="mt-2 text-xl font-bold leading-snug">{p.title}</h2>
                <p className="mt-2 flex-1 leading-7 text-ink/70">{p.excerpt}</p>
                <p className="mt-4 text-sm text-ink/50">{formatDate(p.date)}, {readingTime(p)} min read</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
