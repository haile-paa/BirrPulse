import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { shotSrc } from '../data/shots'

/** Android-style phone frame. `id` is a screenshot id (b1..b9). Pass `tilt` for a 3D hover effect. */
export default function PhoneFrame({ id, alt = 'BirrPulse app screen', tilt = false, className = '', eager = false }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 140, damping: 16 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 140, damping: 16 })
  const glare = useTransform(mx, [-0.5, 0.5], ['0%', '100%'])

  const onMove = (e) => {
    if (!tilt) return
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }
  const reset = () => { mx.set(0); my.set(0) }

  return (
    <div className={`[perspective:1100px] ${className}`} onPointerMove={onMove} onPointerLeave={reset}>
      <motion.div
        style={tilt ? { rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' } : undefined}
        className="relative aspect-[1080/2340] w-full rounded-[14%/6.45%] bg-[#06201d] p-[3%] shadow-[0_30px_70px_-20px_rgba(4,30,27,0.75),inset_0_0_0_2px_rgba(255,255,255,0.09)]"
      >
        <span className="absolute -right-[1.1%] top-[20%] h-[7%] w-[1.4%] rounded-r bg-[#10403a]" />
        <span className="absolute -right-[1.1%] top-[30%] h-[12%] w-[1.4%] rounded-r bg-[#10403a]" />
        <div className="relative h-full w-full overflow-hidden rounded-[11.7%/5.4%] bg-black">
          <img
            src={shotSrc(id)}
            alt={alt}
            width="600"
            height="1300"
            loading={eager ? 'eager' : 'lazy'}
            draggable="false"
            className="h-full w-full select-none object-cover"
          />
          {tilt && (
            <motion.span
              aria-hidden
              style={{ backgroundPositionX: glare }}
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.14)_48%,transparent_60%)] bg-[length:250%_100%]"
            />
          )}
          <span className="absolute left-1/2 top-[1.6%] h-[1.6%] w-[3.4%] -translate-x-1/2 rounded-full bg-black/90" />
        </div>
      </motion.div>
    </div>
  )
}
