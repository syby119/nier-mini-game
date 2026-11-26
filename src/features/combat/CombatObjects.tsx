import { } from 'react'
import { EnemyExplosionEffects } from './effects/EnemyExplosionParticle'
import { EnemySpawnEffect } from './effects/EnemySpawnEffect'
import { HitEffects } from './effects/HitEffects'
import { HitExplosionParticleEffects } from './effects/HitExplosionParticle'
import { HitWhiteMaskEffects } from './effects/HitWhiteMaskEffects'
import { PlayerDeathEffect } from './effects/PlayerDeathEffect'
import { PlayerOnHitLightningEffect } from './effects/PlayerOnHitEffects'
import EnemyProjectiles from './projectiles/EnemyProjectiles'
import PlayerProjectile from './projectiles/PlayerProjectile'

export const CombatObjects = () => {
  return (
    <>
      <PlayerProjectile />
      <HitEffects />
      <HitExplosionParticleEffects />
      <EnemyProjectiles kind="normal" />
      <EnemyProjectiles kind="unbroken" />
      <EnemySpawnEffect />
      <EnemyExplosionEffects />
      <HitWhiteMaskEffects />
      <PlayerOnHitLightningEffect />
      <PlayerDeathEffect />
    </>
  )
}
