import { useFixedFrameUpdate } from '@/shared/three/useFixedFrameUpdate'
import { type CollisionEnterPayload, InstancedRigidBodies, interactionGroups, RapierRigidBody, vec3 } from '@react-three/rapier'
import PubSub from 'pubsub-js'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import usePlayerStore from '../player/PlayerStore'
import type { PlayerShot } from './projectileEvents'

// Keep complete volleys in flight across the visible arena, even from opposite corners.
const PLAYER_PROJECTILE_COUNT = 7 * 32
const maxRange = 5

export default function PlayerProjectile() {
  const projectileRigidBodies = useRef<RapierRigidBody[]>([])
  const projectilesIndex = useRef(-1)
  const addCombatStats = usePlayerStore(state => state.addCombatStats)
  const playerInstances = useMemo(() => Array.from({ length: PLAYER_PROJECTILE_COUNT }, (_, index) => {
    const id = 'player_projectile_' + index
    return { key: id, name: id, position: new THREE.Vector3(0, -1 - index * 0.05, 10), userData: { id, index, type: 'player_projectile' } }
  }), [])

  const shootProjectile = (data: PlayerShot) => {
    projectilesIndex.current = (projectilesIndex.current + 1) % PLAYER_PROJECTILE_COUNT
    const projectile = projectileRigidBodies.current[projectilesIndex.current]
    const velocity = vec3().set(data.direction.x, 0, data.direction.z).normalize().multiplyScalar(data.speed ?? 2)
    projectile.setEnabled(true)
    projectile.setTranslation(data.position, true)
    projectile.setRotation(data.projectileRotation, true)
    projectile.setLinvel(velocity, true)
    projectile.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  const onHit = ({ target, other }: CollisionEnterPayload) => {
    if (!target.rigidBody) return
    addCombatStats({ shootHitCount: 1 })
    const hitPosition = target.rigidBody.translation()
    if (other?.rigidBodyObject?.userData.type == 'enemy_normal_projectile') {
      PubSub.publish('startHitExpandingRingBoundaryAnimation', { position: hitPosition })
      PubSub.publish('hitExplosionSmallParticle', { position: hitPosition })
      PubSub.publish('hitWhiteMaskEffects', { position: hitPosition })
    } else if (other?.rigidBodyObject?.userData.type == 'enemy_rigidbody') {
      PubSub.publish('startHitAnimation', hitPosition)
      PubSub.publish('startHitExpandingRingAnimation', { position: hitPosition })
      PubSub.publish('hitExplosionParticle', { position: hitPosition })
    }
    recycle(target.rigidBody)
  }

  const recycle = (projectile: RapierRigidBody) => {
    const { index } = projectile.userData as { index: number }
    const idlePosition = playerInstances[index].position
    projectile.setLinvel(vec3({ x: 0, y: 0, z: 0 }), true)
    projectile.setTranslation(idlePosition, true)
    projectile.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    projectile.setEnabled(false)
  }

  useFixedFrameUpdate(() => {
    projectileRigidBodies.current.forEach((projectileRigidBody) => {
      //如果x或z超出边界，销毁
      if (!projectileRigidBody.isEnabled()) return
      if (!projectileRigidBody.isMoving()) return
      const position = projectileRigidBody.translation()
      if (Math.abs(position.x) > maxRange || Math.abs(position.z) > maxRange) {
        recycle(projectileRigidBody)
      }
    })
  })

  useEffect(() => {
    projectileRigidBodies.current.forEach(projectile => projectile.setEnabled(false))
    const shootProjectileToken = PubSub.subscribe('shootProjectile', (msg: string, data: PlayerShot) => {
      shootProjectile(data)
    })
    const resetPlayerProjectilesToken = PubSub.subscribe('resetPlayerProjectiles', () => {
      projectileRigidBodies.current.forEach((projectile) => {
        recycle(projectile)
      })
    })
    return () => {
      PubSub.unsubscribe(shootProjectileToken)
      PubSub.unsubscribe(resetPlayerProjectilesToken)
    }
  }, [])

  return (
    <InstancedRigidBodies
      name="player_projectile_rigid_bodies"
      ref={projectileRigidBodies}
      instances={playerInstances}
      collisionGroups={interactionGroups(0, [1, 2, 101])}
      gravityScale={0}
      enabledRotations={[false, false, false]}
      enabledTranslations={[true, false, true]}

      onCollisionEnter={onHit}
    >
      <instancedMesh args={[undefined, undefined, PLAYER_PROJECTILE_COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.11, 0.028, 0.028]} />
        <meshStandardMaterial color={'#D8B589'} emissive={'#D8B589'} emissiveIntensity={2} />
      </instancedMesh>
    </InstancedRigidBodies>
  )
}
