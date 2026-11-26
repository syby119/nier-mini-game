import { quat, vec3 } from '@react-three/rapier'
import PubSub from 'pubsub-js'
import type { Vector3 } from 'three'
import type { SupportFormation } from './SupportWingmen'

// In the 360p recording a formation shot first appears 15 px from its ship
// and travels 32 px between volleys. The 0.15-unit orbit measures 26.3 px.
const formationMuzzleOffset = 0.085
const formationShotSpeed = 1.82

export function shootVolley(center: Vector3, heading: number, support: SupportFormation | null, age: number) {
  const direction = vec3().set(Math.sin(heading), 0, Math.cos(heading))
  const modelAxis = vec3().set(1, 0, 0)
  const projectileRotation = quat().setFromUnitVectors(modelAxis, direction)
    .multiply(quat().setFromAxisAngle(modelAxis, Math.PI / 4))
  const speed = support ? formationShotSpeed : 2
  const muzzle = center.clone().addScaledVector(direction, support ? formationMuzzleOffset + speed * age : 0)

  const fireFrom = (position: Vector3) => {
    PubSub.publishSync('shootProjectile', { id: Math.random(), position, direction, speed, projectileRotation })
  }
  fireFrom(muzzle)
  support?.forEachReadyOffset(offset => fireFrom(offset.clone().add(muzzle)))
}
