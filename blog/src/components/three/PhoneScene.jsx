import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, RoundedBox, useTexture } from '@react-three/drei'

const SCREENS = ['b1', 'b4', 'b3', 'b5', 'b7'].map((id) => `/shots/${id}.webp`)
const SW = 1.5
const SH = SW * (2340 / 1080)

/** Rounded-rect geometry with UVs mapped 0..1 so a screenshot fits the screen exactly. */
function useScreenGeometry() {
  return useMemo(() => {
    const r = 0.17, w = SW, h = SH
    const s = new THREE.Shape()
    s.moveTo(-w / 2 + r, -h / 2)
    s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
    const g = new THREE.ShapeGeometry(s, 12)
    const pos = g.attributes.position
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + w / 2) / w
      uv[i * 2 + 1] = (pos.getY(i) + h / 2) / h
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    return g
  }, [])
}

function Phone({ calm }) {
  const textures = useTexture(SCREENS)
  const geo = useScreenGeometry()
  const [idx, setIdx] = useState(0)
  const group = useRef()
  const ringA = useRef()
  const ringB = useRef()

  useMemo(() => textures.forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8 }), [textures])
  useEffect(() => {
    if (calm) return
    const id = setInterval(() => setIdx((i) => (i + 1) % SCREENS.length), 3200)
    return () => clearInterval(id)
  }, [calm])

  useFrame((state, delta) => {
    const g = group.current
    const tx = state.pointer.x * 0.6 + (calm ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.25)
    const ty = -state.pointer.y * 0.25
    g.rotation.y += (tx - g.rotation.y) * 0.06
    g.rotation.x += (ty - g.rotation.x) * 0.06
    if (!calm) {
      ringA.current.rotation.z += delta * 0.35
      ringB.current.rotation.z -= delta * 0.22
    }
  })

  return (
    <group ref={group}>
      <RoundedBox args={[SW + 0.16, SH + 0.16, 0.16]} radius={0.24} smoothness={6}>
        <meshStandardMaterial color="#06201d" metalness={0.7} roughness={0.3} />
      </RoundedBox>
      <mesh geometry={geo} position={[0, 0, 0.082]}>
        <meshBasicMaterial map={textures[idx]} toneMapped={false} />
      </mesh>
      <mesh position={[0, SH / 2 - 0.14, 0.085]}>
        <circleGeometry args={[0.04, 24]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <mesh ref={ringA} position={[0, 0, -0.2]} rotation={[1.1, 0.4, 0]}>
        <torusGeometry args={[2.6, 0.012, 8, 120]} />
        <meshBasicMaterial color="#f2a33a" />
      </mesh>
      <mesh ref={ringB} position={[0, 0, -0.2]} rotation={[0.6, -0.7, 0]}>
        <torusGeometry args={[2.9, 0.01, 8, 120]} />
        <meshBasicMaterial color="#3a8d87" />
      </mesh>
    </group>
  )
}

export default function PhoneScene({ calm = false, active = true }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 7.4], fov: 36 }}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true }}
      eventSource={document.getElementById('root')}
      eventPrefix="client"
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <pointLight position={[-3, -2, 3]} intensity={25} color="#3a8d87" />
      <Float speed={calm ? 0 : 1.6} rotationIntensity={0.15} floatIntensity={0.6}>
        <Phone calm={calm} />
      </Float>
    </Canvas>
  )
}
