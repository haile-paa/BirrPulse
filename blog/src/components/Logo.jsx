import { Link } from 'react-router-dom'

export default function Logo({ light = true }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="BirrPulse home">
      <img src="/logo.png" alt="" width="36" height="36" className="h-9 w-9 rounded-xl" />
      <span className={`font-display text-lg font-bold ${light ? 'text-white' : 'text-ink'}`}>BirrPulse</span>
    </Link>
  )
}
