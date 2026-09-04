'use client'

import React, { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
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

export type CoverParticleFieldProps = {
  // Number of live particles maintained in the field.
  count?: number
  // Base tint applied to both the particle core and halo.
  color?: string
  // Minimum rendered point size for the farthest particles.
  minSize?: number
  // Maximum rendered point size for the nearest particles.
  maxSize?: number
  // Shapes how strongly particles bias toward the near or far depth range.
  depthExponent?: number
  // Allowed launch angle range in radians.
  angleRange?: readonly [number, number]
  // Random multiplier applied on top of depth-based speed.
  speedScaleRange?: readonly [number, number]
  // Base speed range interpolated by particle depth.
  speedRange?: readonly [number, number]
  // Particle lifetime range in seconds.
  lifespanRange?: readonly [number, number]
  // Fade-in duration range in seconds.
  fadeInRange?: readonly [number, number]
  // Fade-out duration range in seconds.
  fadeOutRange?: readonly [number, number]
  // Oscillation speed range for per-particle sway motion.
  swaySpeedRange?: readonly [number, number]
  // Base horizontal sway amplitude range interpolated by depth.
  swayXRange?: readonly [number, number]
  // Base vertical sway amplitude range interpolated by depth.
  swayYRange?: readonly [number, number]
  // Random multiplier range applied to horizontal sway amplitude.
  swayXRandomScaleRange?: readonly [number, number]
  // Random multiplier range applied to vertical sway amplitude.
  swayYRandomScaleRange?: readonly [number, number]
  // Multiplier range for how much base velocity grows with depth.
  velocityInfluenceRange?: readonly [number, number]
  // Horizontal velocity clamp applied every frame.
  velocityClampX?: readonly [number, number]
  // Vertical velocity clamp applied every frame.
  velocityClampY?: readonly [number, number]
  // Brightness range interpolated by particle depth.
  brightnessRange?: readonly [number, number]
  // Blur / halo spread range interpolated by particle depth.
  blurRange?: readonly [number, number]
  // Initial age ratio range used to stagger spawned particles.
  initialAgeRatioRange?: readonly [number, number]
  // Probability cutoffs for choosing spawn zone 1/2/3.
  spawnModeThresholds?: readonly [number, number]
  // Spawn X ranges for the three spawn zones, expressed in viewport half-width units.
  spawnXRanges?: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ]
  // Spawn Y ranges for the three spawn zones, expressed in viewport half-height units.
  spawnYRanges?: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ]
  // Whether particles respawn after lifetime expiry or leaving bounds.
  respawnOnExit?: boolean
  // Extra bounds outside the viewport that count as out-of-range.
  exitBounds?: {
    // Extra right-side distance in viewport half-width units.
    right?: number
    // Extra left-side distance in viewport half-width units.
    left?: number
    // Extra top-side distance in viewport half-height units.
    top?: number
    // Extra bottom-side distance in viewport half-height units.
    bottom?: number
  }
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function lerpRange(range: readonly [number, number], t: number) {
  return THREE.MathUtils.lerp(range[0], range[1], t)
}

function spawnParticle(
  halfWidth: number,
  halfHeight: number,
  config: Required<CoverParticleFieldProps>,
  initial = false
): ParticleState {
  const depth = Math.pow(Math.random(), config.depthExponent)
  const startMode = initial ? Math.random() : randomRange(0, 1)
  const [thresholdA, thresholdB] = config.spawnModeThresholds
  const [spawnX1, spawnX2, spawnX3] = config.spawnXRanges
  const [spawnY1, spawnY2, spawnY3] = config.spawnYRanges
  const x =
    startMode < thresholdA
      ? randomRange(spawnX1[0] * halfWidth, spawnX1[1] * halfWidth)
      : startMode < thresholdB
        ? randomRange(spawnX2[0] * halfWidth, spawnX2[1] * halfWidth)
        : randomRange(spawnX3[0] * halfWidth, spawnX3[1] * halfWidth)
  const y =
    startMode < thresholdA
      ? randomRange(spawnY1[0] * halfHeight, spawnY1[1] * halfHeight)
      : startMode < thresholdB
        ? randomRange(spawnY2[0] * halfHeight, spawnY2[1] * halfHeight)
        : randomRange(spawnY3[0] * halfHeight, spawnY3[1] * halfHeight)
  const angle = randomRange(config.angleRange[0], config.angleRange[1])
  const speedScale = randomRange(config.speedScaleRange[0], config.speedScaleRange[1])
  const speed = lerpRange(config.speedRange, depth) * speedScale
  const lifespan = randomRange(config.lifespanRange[0], config.lifespanRange[1])
  const fadeIn = randomRange(config.fadeInRange[0], config.fadeInRange[1])
  const fadeOut = randomRange(config.fadeOutRange[0], config.fadeOutRange[1])
  const initialAgeRatio = randomRange(
    config.initialAgeRatioRange[0],
    config.initialAgeRatioRange[1]
  )

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
    age: initial ? lifespan * initialAgeRatio : 0,
    lifespan,
    fadeIn,
    fadeOut,
    swayPhase: randomRange(0, Math.PI * 2),
    swaySpeed: randomRange(config.swaySpeedRange[0], config.swaySpeedRange[1]),
    swayAmountX:
      lerpRange(config.swayXRange, depth) *
      randomRange(config.swayXRandomScaleRange[0], config.swayXRandomScaleRange[1]),
    swayAmountY:
      lerpRange(config.swayYRange, depth) *
      randomRange(config.swayYRandomScaleRange[0], config.swayYRandomScaleRange[1]),
    active: true,
  }
}

export default function CoverParticleField({
  count = 42,
  color = '#fff6d8',
  minSize = 0.75,
  maxSize = 66,
  depthExponent = 0.7,
  angleRange = [0.04, 1.46],
  speedScaleRange = [0.22, 2.9],
  speedRange = [0.00055, 0.0045],
  lifespanRange = [2.6, 7.2],
  fadeInRange = [0.25, 1.1],
  fadeOutRange = [0.35, 1.1],
  swaySpeedRange = [0.12, 0.78],
  swayXRange = [0.0001, 0.0019],
  swayYRange = [0.00012, 0.0028],
  swayXRandomScaleRange = [0.2, 2.2],
  swayYRandomScaleRange = [0.2, 2.2],
  velocityInfluenceRange = [0.38, 0.66],
  velocityClampX = [-0.005, 0.012],
  velocityClampY = [-0.004, 0.013],
  brightnessRange = [0.18, 0.95],
  blurRange = [0.18, 0.82],
  initialAgeRatioRange = [0, 0.55],
  spawnModeThresholds = [0.4, 0.8],
  spawnXRanges = [
    [-1.08, -0.1],
    [-1, 0.2],
    [-1, 1],
  ],
  spawnYRanges = [
    [-1, -0.08],
    [-1.22, -1.04],
    [-1, 1],
  ],
  respawnOnExit = true,
  exitBounds = {
    right: 0.2,
    left: 0.2,
    top: 0.2,
    bottom: 0.2,
  },
}: CoverParticleFieldProps) {
  const { viewport } = useThree()
  const halfWidth = viewport.width / 2
  const halfHeight = viewport.height / 2
  const particleConfig = useMemo(
    () => ({
      count,
      color,
      minSize,
      maxSize,
      depthExponent,
      angleRange,
      speedScaleRange,
      speedRange,
      lifespanRange,
      fadeInRange,
      fadeOutRange,
      swaySpeedRange,
      swayXRange,
      swayYRange,
      swayXRandomScaleRange,
      swayYRandomScaleRange,
      velocityInfluenceRange,
      velocityClampX,
      velocityClampY,
      brightnessRange,
      blurRange,
      initialAgeRatioRange,
      spawnModeThresholds,
      spawnXRanges,
      spawnYRanges,
      respawnOnExit,
      exitBounds: {
        right: exitBounds.right ?? 0.2,
        left: exitBounds.left ?? 0.2,
        top: exitBounds.top ?? 0.2,
        bottom: exitBounds.bottom ?? 0.2,
      },
    }),
    [
      angleRange,
      blurRange,
      brightnessRange,
      color,
      count,
      depthExponent,
      exitBounds.bottom,
      exitBounds.left,
      exitBounds.right,
      exitBounds.top,
      fadeInRange,
      fadeOutRange,
      initialAgeRatioRange,
      lifespanRange,
      maxSize,
      minSize,
      respawnOnExit,
      spawnModeThresholds,
      spawnXRanges,
      spawnYRanges,
      speedRange,
      speedScaleRange,
      swaySpeedRange,
      swayXRandomScaleRange,
      swayXRange,
      swayYRandomScaleRange,
      swayYRange,
      velocityClampX,
      velocityClampY,
      velocityInfluenceRange,
    ]
  )

  const particles = useMemo<ParticleState[]>(
    () => Array.from({ length: count }, () => spawnParticle(halfWidth, halfHeight, particleConfig, true)),
    [count, halfHeight, halfWidth, particleConfig]
  )

  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const sizes = useMemo(() => new Float32Array(count), [count])
  const alphas = useMemo(() => new Float32Array(count), [count])
  const depths = useMemo(() => new Float32Array(count), [count])
  const blurStrengths = useMemo(() => new Float32Array(count), [count])
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
      const light = lerpRange(particleConfig.brightnessRange, particle.depth) * lifeAlpha

      particle.swayPhase += delta * particle.swaySpeed

      const nextVX =
        particle.vx * 0.972 +
        particle.baseVelocityX *
          lerpRange(particleConfig.velocityInfluenceRange, particle.depth) +
        Math.sin(particle.swayPhase) * particle.swayAmountX
      const nextVY =
        particle.vy * 0.972 +
        particle.baseVelocityY *
          lerpRange(particleConfig.velocityInfluenceRange, particle.depth) +
        Math.cos(particle.swayPhase * 0.9) * particle.swayAmountY
      particle.vx = THREE.MathUtils.clamp(
        nextVX,
        particleConfig.velocityClampX[0],
        particleConfig.velocityClampX[1]
      )
      particle.vy = THREE.MathUtils.clamp(
        nextVY,
        particleConfig.velocityClampY[0],
        particleConfig.velocityClampY[1]
      )

      particle.x += particle.vx
      particle.y += particle.vy

      const exceededBounds =
        particle.x > halfWidth + particleConfig.exitBounds.right * halfWidth ||
        particle.x < -halfWidth - particleConfig.exitBounds.left * halfWidth ||
        particle.y > halfHeight + particleConfig.exitBounds.top * halfHeight ||
        particle.y < -halfHeight - particleConfig.exitBounds.bottom * halfHeight

      if (
        particle.age >= particle.lifespan ||
        exceededBounds
      ) {
        if (!particleConfig.respawnOnExit) {
          particle.active = false
          sizes[index] = 0
          alphas[index] = 0
          return
        }

        const reset = spawnParticle(halfWidth, halfHeight, particleConfig)
        particles[index] = reset
        positions[index * 3] = reset.x
        positions[index * 3 + 1] = reset.y
        sizes[index] = 0
        alphas[index] = 0
        depths[index] = reset.depth
        blurStrengths[index] = lerpRange(particleConfig.blurRange, reset.depth)
        return
      }

      positions[index * 3] = particle.x
      positions[index * 3 + 1] = particle.y
      sizes[index] =
        THREE.MathUtils.lerp(minSize, maxSize, particle.depth) *
        THREE.MathUtils.lerp(0.95, 1.04, fadeInAlpha)
      alphas[index] = light
      depths[index] = particle.depth
      blurStrengths[index] = lerpRange(particleConfig.blurRange, particle.depth)
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
          uColor: { value: new THREE.Color(color) },
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
            vec3 finalColor = mix(uColor, vec3(1.0), core * 0.24);
            gl_FragColor = vec4(finalColor, alpha);
          }
        `}
      />
    </points>
  )
}
