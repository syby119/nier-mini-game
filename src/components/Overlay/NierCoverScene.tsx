'use client'

import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

type ParticleState = {
  x: number
  y: number
  vx: number
  vy: number
  baseVelocityX: number
  baseVelocityY: number
  speed: number
  speedScale: number
  blinkFrequency: number
  blinkCount: number
  border: number
  showFrequency: number
  showCount: number
  depth: number
  glowBias: number
  age: number
  lifespan: number
  fadeIn: number
  fadeOut: number
  swayPhase: number
  swaySpeed: number
  swayAmountX: number
  swayAmountY: number
  active: boolean
}

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

const TOTAL_PARTICLES = 42
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

function spawnParticle(
  halfWidth: number,
  halfHeight: number,
  initial = false
): ParticleState {
  const depth = Math.pow(Math.random(), 0.7)
  const startMode = initial ? Math.random() : randomRange(0, 1)
  const x =
    startMode < 0.4
      ? randomRange(-halfWidth - 0.08 * halfWidth, -halfWidth * 0.1)
      : startMode < 0.8
        ? randomRange(-halfWidth, halfWidth * 0.2)
        : randomRange(-halfWidth, halfWidth)
  const y =
    startMode < 0.4
      ? randomRange(-halfHeight, -halfHeight * 0.08)
      : startMode < 0.8
        ? -halfHeight - randomRange(0.04, 0.22) * halfHeight
        : randomRange(-halfHeight, halfHeight)
  const angle = randomRange(0.04, 1.46)
  const speedScale = randomRange(0.22, 2.9)
  const speed = THREE.MathUtils.lerp(0.00055, 0.0045, depth) * speedScale
  const lifespan = randomRange(2.6, 7.2)
  const fadeIn = randomRange(0.25, 1.1)
  const fadeOut = randomRange(0.35, 1.1)

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    baseVelocityX: Math.cos(angle) * speed,
    baseVelocityY: Math.sin(angle) * speed,
    speed,
    speedScale,
    blinkFrequency: randomRange(0.015, 0.11),
    blinkCount: randomRange(0, Math.PI * 2),
    border: Math.random() < 0.6 ? randomRange(0.02, 0.07) : randomRange(0.04, 0.12),
    showFrequency: Math.floor(randomRange(8, 22)),
    showCount: 1,
    depth,
    glowBias: randomRange(0.85, 1.2),
    age: initial ? randomRange(0, lifespan * 0.55) : 0,
    lifespan,
    fadeIn,
    fadeOut,
    swayPhase: randomRange(0, Math.PI * 2),
    swaySpeed: randomRange(0.12, 0.78),
    swayAmountX: THREE.MathUtils.lerp(0.0001, 0.0019, depth) * randomRange(0.2, 2.2),
    swayAmountY: THREE.MathUtils.lerp(0.00012, 0.0028, depth) * randomRange(0.2, 2.2),
    active: true,
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

function ParticleField() {
  const { viewport } = useThree()
  const halfWidth = viewport.width / 2
  const halfHeight = viewport.height / 2

  const particles = useMemo<ParticleState[]>(
    () => Array.from({ length: TOTAL_PARTICLES }, () => spawnParticle(halfWidth, halfHeight, true)),
    [halfHeight, halfWidth]
  )

  const positions = useMemo(() => new Float32Array(TOTAL_PARTICLES * 3), [])
  const sizes = useMemo(() => new Float32Array(TOTAL_PARTICLES), [])
  const alphas = useMemo(() => new Float32Array(TOTAL_PARTICLES), [])
  const depths = useMemo(() => new Float32Array(TOTAL_PARTICLES), [])
  const blurStrengths = useMemo(() => new Float32Array(TOTAL_PARTICLES), [])

  const geometryRef = useRef<THREE.BufferGeometry>(null)

  useMemo(() => {
    particles.forEach((particle, index) => {
      positions[index * 3] = particle.x
      positions[index * 3 + 1] = particle.y
      positions[index * 3 + 2] = 0
      sizes[index] = 10
      alphas[index] = 0.5
      depths[index] = particle.depth
      blurStrengths[index] = THREE.MathUtils.lerp(0.18, 0.78, particle.depth)
    })
  }, [alphas, blurStrengths, depths, particles, positions, sizes])

  useFrame((_, delta) => {
    particles.forEach((particle, index) => {
      if (!particle.active) {
        sizes[index] = 0
        alphas[index] = 0
        return
      }

      particle.age += delta
      particle.blinkCount += particle.blinkFrequency * delta * 60

      const fadeInAlpha = Math.min(particle.age / particle.fadeIn, 1)
      const fadeOutStart = Math.max(particle.lifespan - particle.fadeOut, particle.fadeIn)
      const fadeOutAlpha =
        particle.age <= fadeOutStart
          ? 1
          : Math.max(0, 1 - (particle.age - fadeOutStart) / particle.fadeOut)
      const lifeAlpha = fadeInAlpha * fadeOutAlpha
      const light = THREE.MathUtils.lerp(0.18, 0.95, particle.depth) * lifeAlpha

      particle.swayPhase += delta * particle.swaySpeed

      const nextVX =
        particle.vx * 0.972 +
        particle.baseVelocityX * (0.38 + particle.depth * 0.28) +
        Math.sin(particle.swayPhase) * particle.swayAmountX
      const nextVY =
        particle.vy * 0.972 +
        particle.baseVelocityY * (0.38 + particle.depth * 0.28) +
        Math.cos(particle.swayPhase * 0.9) * particle.swayAmountY
      particle.vx = THREE.MathUtils.clamp(nextVX, -0.005, 0.012)
      particle.vy = THREE.MathUtils.clamp(nextVY, -0.004, 0.013)

      particle.x += particle.vx
      particle.y += particle.vy

      if (
        particle.age >= particle.lifespan ||
        particle.x > halfWidth + 0.2 * halfWidth ||
        particle.y > halfHeight + 0.2 * halfHeight
      ) {
        const reset = spawnParticle(halfWidth, halfHeight)
        particles[index] = reset
        positions[index * 3] = reset.x
        positions[index * 3 + 1] = reset.y
        sizes[index] = 0
        alphas[index] = 0
        depths[index] = reset.depth
        blurStrengths[index] = THREE.MathUtils.lerp(0.18, 0.82, reset.depth)
        return
      }

      positions[index * 3] = particle.x
      positions[index * 3 + 1] = particle.y
      sizes[index] =
        THREE.MathUtils.lerp(0.75, 66, particle.depth) *
        THREE.MathUtils.lerp(0.95, 1.04, fadeInAlpha)
      alphas[index] = light
      depths[index] = particle.depth
      blurStrengths[index] = THREE.MathUtils.lerp(0.18, 0.82, particle.depth)
    })

    if (!geometryRef.current) return
    geometryRef.current.attributes.position.needsUpdate = true
    geometryRef.current.attributes.aSize.needsUpdate = true
    geometryRef.current.attributes.aAlpha.needsUpdate = true
    geometryRef.current.attributes.aDepth.needsUpdate = true
    geometryRef.current.attributes.aBlur.needsUpdate = true
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[alphas, 1]} />
        <bufferAttribute attach="attributes-aDepth" args={[depths, 1]} />
        <bufferAttribute attach="attributes-aBlur" args={[blurStrengths, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uPixelRatio: {
            value: Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2),
          },
          uColor: { value: new THREE.Color('#fff6d8') },
        }}
        vertexShader={`
          attribute float aSize;
          attribute float aAlpha;
          attribute float aDepth;
          attribute float aBlur;
          varying float vAlpha;
          varying float vDepth;
          varying float vBlur;
          uniform float uPixelRatio;

          void main() {
            vAlpha = aAlpha;
            vDepth = aDepth;
            vBlur = aBlur;
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            vec4 viewPosition = viewMatrix * modelPosition;
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = aSize * uPixelRatio;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          varying float vAlpha;
          varying float vDepth;
          varying float vBlur;

          void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord) * 2.0;
            float coreRadius = mix(0.22, 0.06, vDepth);
            float haloRadius = mix(0.58, 0.96, vBlur);
            float core = smoothstep(coreRadius, 0.0, dist);
            float crispCore = smoothstep(coreRadius * 0.72, 0.0, dist);
            float halo = smoothstep(haloRadius, 0.06, dist);
            float blurHalo = mix(0.18, 0.7, vBlur) * halo;
            float sharpCenter = mix(1.0, 0.55, vBlur) * crispCore;
            float alpha = (sharpCenter + blurHalo) * vAlpha;
            vec3 color = mix(uColor, vec3(1.0), core * 0.24);
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </points>
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
      <ParticleField />
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
