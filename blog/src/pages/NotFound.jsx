import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks'

export default function NotFound() {
  usePageTitle('Page not found')
  return (
    <main className="grid min-h-screen place-items-center bg-pine px-5 text-center text-white">
      <div>
        <p className="font-display text-8xl font-extrabold text-amber">404</p>
        <h1 className="mt-4 text-3xl font-bold">This page took a wrong turn.</h1>
        <p className="mt-2 text-white/70">The link may be old or mistyped.</p>
        <Link to="/" className="mt-8 inline-block rounded-full bg-teal px-6 py-3 font-semibold">Back to home</Link>
      </div>
    </main>
  )
}
