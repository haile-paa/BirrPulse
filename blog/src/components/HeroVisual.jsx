import { lazy, Suspense, useEffect, useState } from 'react'
import { hasWebGL } from '../hooks'

const HeroScene = lazy(() => import('./three/HeroScene'))

/**
 * The hero art. The SVG mark paints instantly (it is just markup), so the first screen is
 * never empty. The 3D version loads when the browser is idle, draws its first frames, and only
 * then fades in over the SVG. With reduced motion, Data Saver or no WebGL, the SVG stays.
 */
export function Mark({ className = '' }) {
  return (
    <svg viewBox="205 205 614 614" className={className} role="img" aria-label="BirrPulse mark">
      <circle cx="512" cy="512" r="270" fill="none" stroke="#f4fbf9" strokeWidth="46" />
      {[[373, 590, 90], [475, 530, 150], [577, 465, 215]].map(([x, y, h], i) => (
        <rect key={x} x={x} y={y} width="74" height={h} rx="16" fill="#f4fbf9" className="mark-bar" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
      <polyline points="352,500 452,420 510,462 650,338" fill="none" stroke="#f2a33a" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="623,418 650,338 568,355" fill="none" stroke="#f2a33a" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function HeroVisual({ narrow, calm, active }) {
  const [mount, setMount] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saveData = navigator.connection && navigator.connection.saveData
    if (calm || saveData || !hasWebGL()) return
    const ric = window.requestIdleCallback
    const id = ric ? ric(() => setMount(true), { timeout: 600 }) : setTimeout(() => setMount(true), 200)
    return () => (ric ? window.cancelIdleCallback(id) : clearTimeout(id))
  }, [calm])

  return (
    <div className="absolute inset-0">
      <div
        aria-hidden={ready}
        className={`absolute transition-opacity duration-700 ${ready ? 'opacity-0' : 'opacity-100'} ${
          narrow ? 'left-1/2 top-[9%] w-[58vw] max-w-[280px] -translate-x-1/2' : 'right-[9%] top-1/2 w-[min(38vw,480px)] -translate-y-1/2'
        }`}
      >
        <Mark className="w-full [animation:hero-float_6s_ease-in-out_infinite] [filter:drop-shadow(0_0_30px_rgba(58,141,135,.7))]" />
      </div>
      {mount && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}>
          <Suspense fallback={null}>
            <HeroScene narrow={narrow} active={active} onReady={() => setReady(true)} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
