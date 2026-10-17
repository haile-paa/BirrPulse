import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox, Sparkles } from '@react-three/drei'

const C = { teal: '#3a8d87', deep: '#1e5e59', white: '#f4fbf9', amber: '#f2a33a', pine: '#0b2a27' }

// The BirrPulse mark in 3D: coin ring, three rising bars and an amber trend arrow.
// Dimensions come from the app icon (1 unit = 180 icon px).
const BARS = [
  { x: -0.57, h: 0.5 },
  { x: 0, h: 0.83 },
  { x: 0.57, h: 1.19 },
]
const BASE = -0.93

function Bar({ x, h, i }) {
  const g = useRef()
  useFrame((s) => { g.current.scale.y = 0.86 + Math.sin(s.clock.elapsedTime * 1.3 + i * 0.9) * 0.14 })
  return (
    <group ref={g} position={[x, BASE, 0]}>
      <RoundedBox args={[0.41, h, 0.34]} radius={0.1} smoothness={4} position={[0, h / 2, 0]}>
        <meshStandardMaterial color={C.white} roughness={0.35} />
      </RoundedBox>
    </group>
  )
}

function Arrow() {
  const { geo, pos, quat } = useMemo(() => {
    const pts = [[-0.89, 0.07], [-0.33, 0.51], [-0.01, 0.28], [0.74, 0.93]].map(([x, y]) => new THREE.Vector3(x, y, 0.06))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15)
    const dir = pts[3].clone().sub(pts[2]).normalize()
    return {
      geo: new THREE.TubeGeometry(curve, 64, 0.075, 12, false),
      pos: pts[3].clone().add(dir.clone().multiplyScalar(0.1)),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    }
  }, [])
  return (
    <group>
      <mesh geometry={geo}><meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={0.35} roughness={0.4} /></mesh>
      <mesh position={pos} quaternion={quat}>
        <coneGeometry args={[0.2, 0.36, 24]} />
        <meshStandardMaterial color={C.amber} emissive={C.amber} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Coin({ r, speed, y, phase, size = 0.26 }) {
  const g = useRef()
  useFrame((s) => {
    const t = s.clock.elapsedTime * speed + phase
    g.current.position.set(Math.cos(t) * r, y + Math.sin(t * 1.7) * 0.25, Math.sin(t) * r * 0.55)
    g.current.rotation.x = t * 1.4
    g.current.rotation.y = t * 0.8
  })
  return (
    <group ref={g}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size, size, size * 0.2, 28]} />
        <meshStandardMaterial color={C.amber} metalness={0.55} roughness={0.28} emissive="#8a5a10" emissiveIntensity={0.25} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[size * 0.72, size * 0.05, 8, 28]} />
        <meshStandardMaterial color="#ffd48a" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** A text-message bubble that drifts in from the right and is absorbed by the ring. */
function Sms({ offset, y0, z0, speed = 0.11 }) {
  const g = useRef()
  const mat = useRef()
  useFrame((s) => {
    const p = (s.clock.elapsedTime * speed + offset) % 1
    const e = p * p * (3 - 2 * p)
    g.current.position.set(THREE.MathUtils.lerp(4.4, 0.2, e), THREE.MathUtils.lerp(y0, 0, e) + Math.sin(p * 6) * 0.1, THREE.MathUtils.lerp(z0, 0.4, e))
    g.current.rotation.set(0, THREE.MathUtils.lerp(-0.5, 0, e), THREE.MathUtils.lerp(0.18, 0, e))
    const sc = Math.sin(Math.PI * Math.min(1, p * 1.05)) ** 0.6
    g.current.scale.setScalar(Math.max(0.001, sc))
    mat.current.opacity = Math.min(1, sc * 1.4) * 0.95
  })
  return (
    <group ref={g}>
      <RoundedBox args={[1.0, 0.58, 0.08]} radius={0.14} smoothness={4}>
        <meshStandardMaterial ref={mat} color={C.white} transparent roughness={0.4} />
      </RoundedBox>
      {[0.14, 0, -0.14].map((y, i) => (
        <mesh key={y} position={[-0.08 + (i === 2 ? -0.12 : 0), y, 0.05]}>
          <boxGeometry args={[i === 2 ? 0.5 : 0.7, 0.06, 0.01]} />
          <meshBasicMaterial color={i === 0 ? C.teal : '#9cc9c4'} />
        </mesh>
      ))}
      <mesh position={[-0.33, -0.34, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.1, 0.16, 3]} />
        <meshStandardMaterial color={C.white} />
      </mesh>
    </group>
  )
}

function World({ narrow, onReady }) {
  const root = useRef()
  const frames = useRef(0)
  useFrame((s) => {
    root.current.rotation.y += (s.pointer.x * 0.5 + Math.sin(s.clock.elapsedTime * 0.5) * 0.12 - root.current.rotation.y) * 0.05
    root.current.rotation.x += (-s.pointer.y * 0.25 - root.current.rotation.x) * 0.05
    if (frames.current < 3 && ++frames.current === 3) onReady?.()
  })
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 5, 6]} intensity={2.4} />
      <pointLight position={[-4, -1, 3]} intensity={28} color={C.amber} />
      <pointLight position={[3, 3, -2]} intensity={34} color={C.teal} />
      <group position={narrow ? [0, 0.3, 0] : [2.3, 0, 0]} scale={narrow ? 0.62 : 1}>
        <group ref={root}>
          <mesh>
            <torusGeometry args={[1.5, 0.15, 28, 110]} />
            <meshStandardMaterial color={C.white} roughness={0.3} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0, -0.16]}>
            <circleGeometry args={[1.5, 64]} />
            <meshStandardMaterial color={C.deep} roughness={0.6} transparent opacity={0.85} />
          </mesh>
          {BARS.map((b, i) => <Bar key={i} i={i} {...b} />)}
          <Arrow />
          <Coin r={2.9} speed={0.35} y={1.2} phase={0} />
          <Coin r={3.2} speed={0.28} y={-1.3} phase={2.1} size={0.32} />
          <Coin r={2.5} speed={0.42} y={0.1} phase={4.2} size={0.2} />
          <Coin r={3.5} speed={0.22} y={0.6} phase={5.4} size={0.24} />
          <Sms offset={0} y0={1.6} z0={-0.6} />
          <Sms offset={0.34} y0={-1.5} z0={0.4} />
          <Sms offset={0.67} y0={0.4} z0={-1} />
          <Sparkles count={50} scale={[9, 6, 5]} size={3.4} speed={0.35} color="#ffd48a" />
        </group>
      </group>
    </>
  )
}

export default function HeroScene({ narrow = false, active = true, onReady }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 9.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      eventSource={document.getElementById('root')}
      eventPrefix="client"
    >
      <World narrow={narrow} onReady={onReady} />
    </Canvas>
  )
}
