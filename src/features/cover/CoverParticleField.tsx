'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { lerpRange, spawnParticle, type CoverParticleFieldProps, type ParticleState } from './coverParticles'
import { fragmentShader, vertexShader } from './coverParticleShaders'

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
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </points>
  )
}
