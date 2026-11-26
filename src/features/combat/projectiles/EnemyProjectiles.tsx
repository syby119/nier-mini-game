import useGamePauseStore from '@/game/state/GamePauseStore'
import { useFixedFrameUpdate } from '@/shared/three/useFixedFrameUpdate'
import { InstancedRigidBodies, interactionGroups, type CollisionEnterPayload, type RapierRigidBody } from '@react-three/rapier'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { enemyProjectileMaterials, vertexShader } from './enemyProjectileMaterials'
import { enemyProjectileEvents, type EnemyProjectileKind, type EnemyShot } from './projectileEvents'

const poolSize = 200
const speed = 0.5
const maxRange = 3
const zeroVelocity = { x: 0, y: 0, z: 0 }
const identityRotation = { x: 0, y: 0, z: 0, w: 1 }

export default function EnemyProjectiles({ kind }: { kind: EnemyProjectileKind }) {
  const type = 'enemy_' + kind + '_projectile'
  const normal = kind === 'normal'
  const bodies = useRef<RapierRigidBody[]>([])
  const nextIndex = useRef(0)
  const velocities = useRef<Vector3[]>([])
  const instances = useMemo(() => Array.from({ length: poolSize }, (_, index) => {
    const id = type + '_' + index
    return { key: id, position: new Vector3(0, -1 - 0.01 * index, normal ? 11 : 12), userData: { id, type, index } }
  }), [type, normal])

  const recycle = useCallback((body: RapierRigidBody) => {
    const { index } = body.userData as { index: number }
    body.setEnabled(false)
    body.setLinvel(zeroVelocity, true)
    body.setTranslation(instances[index].position, true)
    body.setRotation(identityRotation, true)
  }, [instances])

  useEffect(() => {
    bodies.current.forEach(body => body.setEnabled(false))
    const events = enemyProjectileEvents[kind]
    const shoot = PubSub.subscribe(events.shoot, (_, shot: EnemyShot) => {
      const index = nextIndex.current
      const body = bodies.current[index]
      if (!body) return
      nextIndex.current = (index + 1) % poolSize
      const velocity = new Vector3(shot.direction.x, 0, shot.direction.z).normalize().multiplyScalar(speed)
      velocities.current[index] = velocity
      body.setEnabled(true)
      body.setTranslation(shot.position, true)
      body.setLinvel(velocity, true)
    })
    const reset = PubSub.subscribe(events.reset, () => bodies.current.forEach(recycle))
    const unsubscribePause = useGamePauseStore.subscribe(state => state.isPaused, paused => {
      bodies.current.forEach((body, index) => {
        if (body.isEnabled()) body.setLinvel(paused ? zeroVelocity : velocities.current[index] ?? zeroVelocity, true)
      })
    })
    return () => {
      PubSub.unsubscribe(shoot)
      PubSub.unsubscribe(reset)
      unsubscribePause()
    }
  }, [kind, recycle])

  useFixedFrameUpdate(() => {
    for (const body of bodies.current) {
      if (!body.isEnabled() || !body.isMoving()) continue
      const { x, z } = body.translation()
      if (Math.abs(x) > maxRange || Math.abs(z) > maxRange) recycle(body)
    }
  })

  function onHit({ target, other }: CollisionEnterPayload) {
    if (!target.rigidBody) return
    if (other.colliderObject?.name === 'player_on_hit_expanding_ring_hit_box') {
      PubSub.publish('hitExplosionSmallParticle', { position: target.rigidBody.translation() })
    }
    recycle(target.rigidBody)
  }

  return (
    <InstancedRigidBodies ref={bodies} name={type + '_rigid_bodies'} instances={instances}
      collisionGroups={interactionGroups(normal ? 2 : 3, [0])} gravityScale={0}
      onCollisionEnter={onHit} type="kinematicVelocity">
      <instancedMesh args={[undefined, undefined, poolSize]} frustumCulled={false} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.1, 0.1]} />
        <shaderMaterial vertexShader={vertexShader} {...enemyProjectileMaterials[kind]} transparent />
      </instancedMesh>
    </InstancedRigidBodies>
  )
}
