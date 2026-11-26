import { MathUtils } from 'three'

export type ParticleState = {
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

export function lerpRange(range: readonly [number, number], t: number) {
  return MathUtils.lerp(range[0], range[1], t)
}

export function spawnParticle(
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
