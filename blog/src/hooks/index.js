import { useEffect, useRef, useState } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | BirrPulse` : 'BirrPulse | Your bank SMS, organised'
  }, [title])
}

export function useInView(options = { threshold: 0.05 }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), options)
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [ref, inView]
}

export function useWindowWidth() {
  const [w, setW] = useState(typeof window === 'undefined' ? 1200 : window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

let webglSupport
export function hasWebGL() {
  if (webglSupport !== undefined) return webglSupport
  try {
    const c = document.createElement('canvas')
    webglSupport = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    webglSupport = false
  }
  return webglSupport
}
