'use client'

import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import CoverParticleField from './CoverParticleField'

type BlockState = {
  left: number
  top: number
  width: number
  height: number
  ratio: number
  blinkPeriod: number
  blinkCount: number
  invert: boolean
}

const TOTAL_BLOCKS = 100
const DARK_COLOR = new THREE.Color('#141828')
const LIGHT_COLOR = new THREE.Color('#e6e6da')

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function shuffle(values: number[]) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
}

function BackgroundPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { viewport } = useThree()

  useFrame((_, delta) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value += delta
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]} position={[0, 0, -4]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;

          float rand(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }

          void main() {
            vec2 uv = vUv;
            vec3 topColor = vec3(0.06, 0.07, 0.15);
            vec3 bottomColor = vec3(0.01, 0.015, 0.03);
            vec3 color = mix(bottomColor, topColor, pow(1.0 - uv.y, 1.6));

            float gridX = step(0.94, fract(uv.x * 240.0));
            float gridY = step(0.94, fract(uv.y * 140.0));
            float grid = max(gridX, gridY) * 0.035;

            float noise = rand(floor(uv * vec2(320.0, 180.0) + uTime * 3.0)) * 0.03;
            float vignette = smoothstep(0.95, 0.28, distance(uv, vec2(0.5)));
            float mist = smoothstep(0.55, 1.0, 1.0 - uv.y) * 0.1;

            color += vec3(grid + noise + mist);
            color *= vignette;

            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  )
}

function RandBlockField() {
  const { viewport } = useThree()
  const groupRefs = useRef<Array<THREE.Group | null>>([])
  const darkRefs = useRef<Array<THREE.Mesh | null>>([])
  const lightRefs = useRef<Array<THREE.Mesh | null>>([])
  const frameRef = useRef(0)
  const activeIndicesRef = useRef<number[]>([])
  const visibleCountRef = useRef(8)

  const blocks = useMemo<BlockState[]>(
    () =>
      Array.from({ length: TOTAL_BLOCKS }, () => ({
        left: randomRange(0.164, 0.752),
        top: randomRange(0.436, 0.503),
        width: randomRange(0.01, 0.12),
        height: randomRange(0.007, 0.018),
        ratio: randomRange(0.01, 0.99),
        blinkPeriod: Math.floor(randomRange(1, 4)),
        blinkCount: Math.floor(randomRange(0, 10)),
        invert: Math.random() > 0.5,
      })),
    []
  )

  useMemo(() => {
    activeIndicesRef.current = Array.from({ length: TOTAL_BLOCKS }, (_, index) => index)
    shuffle(activeIndicesRef.current)
  }, [])

  useFrame(() => {
    frameRef.current += 1

    if (frameRef.current % 4 === 0) {
      shuffle(activeIndicesRef.current)
      visibleCountRef.current = Math.floor(randomRange(7, 12))

      if (frameRef.current % 80 === 0) {
        visibleCountRef.current = Math.floor(randomRange(60, 80))
      }
    }

    if (frameRef.current % 3 !== 0) return

    blocks.forEach((block, index) => {
      const group = groupRefs.current[index]
      const dark = darkRefs.current[index]
      const light = lightRefs.current[index]

      if (!group || !dark || !light) return

      block.blinkCount += 1

      const visible = activeIndicesRef.current
        .slice(0, visibleCountRef.current)
        .includes(index) && block.blinkCount % block.blinkPeriod !== 0

      group.visible = visible
      if (!visible) return

      const totalWidth = block.width * viewport.width
      const totalHeight = block.height * viewport.height
      const centerX = (block.left + block.width / 2 - 0.5) * viewport.width
      const centerY = (0.5 - (block.top + block.height / 2)) * viewport.height

      const leftWidth = totalWidth * block.ratio
      const rightWidth = Math.max(totalWidth - leftWidth, 0.001)
      const darkOnLeft = block.invert

      group.position.set(centerX, centerY, -0.5)

      dark.position.x = darkOnLeft
        ? -totalWidth / 2 + leftWidth / 2
        : totalWidth / 2 - rightWidth / 2
      dark.scale.set(darkOnLeft ? leftWidth : rightWidth, totalHeight, 1)
      ;(dark.material as THREE.MeshBasicMaterial).color.copy(DARK_COLOR)

      light.position.x = darkOnLeft
        ? totalWidth / 2 - rightWidth / 2
        : -totalWidth / 2 + leftWidth / 2
      light.scale.set(darkOnLeft ? rightWidth : leftWidth, totalHeight, 1)
      ;(light.material as THREE.MeshBasicMaterial).color.copy(LIGHT_COLOR)
    })
  })

  return (
    <group>
      {blocks.map((block, index) => (
        <group key={index} ref={(node) => void (groupRefs.current[index] = node)}>
          <mesh ref={(node) => void (darkRefs.current[index] = node)}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial toneMapped={false} />
          </mesh>
          <mesh ref={(node) => void (lightRefs.current[index] = node)}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function GearSymbol() {
  const groupRef = useRef<THREE.Group>(null)
  const { viewport } = useThree()

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.z += delta * 0.85
  })

  const teeth = useMemo(() => Array.from({ length: 16 }, (_, index) => index), [])
  const spokes = useMemo(() => Array.from({ length: 3 }, (_, index) => index), [])

  return (
    <group
      ref={groupRef}
      position={[
        (466 / 1344 - 0.5) * viewport.width,
        (0.5 - 333 / 756) * viewport.height,
        0.4,
      ]}
      scale={Math.min(viewport.width, viewport.height) * 0.06}
    >
      <mesh>
        <ringGeometry args={[0.42, 0.56, 64]} />
        <meshBasicMaterial color="#c8c0a8" toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.18, 32]} />
        <meshBasicMaterial color="#d8cfb7" toneMapped={false} />
      </mesh>
      {teeth.map((tooth) => {
        const angle = (Math.PI * 2 * tooth) / teeth.length
        return (
          <mesh
            key={tooth}
            position={[Math.cos(angle) * 0.62, Math.sin(angle) * 0.62, 0]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.09, 0.22, 0.02]} />
            <meshBasicMaterial color="#c8c0a8" toneMapped={false} />
          </mesh>
        )
      })}
      {spokes.map((spoke) => {
        const angle = (Math.PI * 2 * spoke) / spokes.length
        return (
          <mesh key={spoke} rotation={[0, 0, angle]}>
            <boxGeometry args={[0.06, 0.48, 0.02]} />
            <meshBasicMaterial color="#d8cfb7" toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function CoverSceneContent() {
  return (
    <>
      <BackgroundPlane />
      <CoverParticleField />
      <RandBlockField />
      <GearSymbol />
    </>
  )
}

export default function NierCoverScene() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <CoverSceneContent />
      </Canvas>
    </div>
  )
}
