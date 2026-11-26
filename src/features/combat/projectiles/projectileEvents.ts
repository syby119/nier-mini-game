import type { Quaternion, Vector3 } from 'three'

export const enemyProjectileEvents = {
  normal: { shoot: 'enemyShootProjectile', reset: 'resetEnemyShootProjectile' },
  unbroken: { shoot: 'enemyShootUnbrokenProjectileToken', reset: 'resetEnemyShootUnbrokenProjectileToken' },
} as const

export type EnemyProjectileKind = keyof typeof enemyProjectileEvents

export interface EnemyShot {
  position: Pick<Vector3, 'x' | 'y' | 'z'>
  direction: Pick<Vector3, 'x' | 'z'>
}

export interface PlayerShot {
  position: Vector3
  direction: Vector3
  projectileRotation: Quaternion
  speed?: number
}
