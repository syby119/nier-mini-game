import PubSub from 'pubsub-js'
import { Vector3, type Mesh } from 'three'
import { enemyProjectileEvents } from '../projectiles/projectileEvents'
import { StrongType } from './enemyTypes'

type Mount = 'Left' | 'Center' | 'Right'

export interface GunPort {
  name: string
  mount: Mount
  turnPerTick: number
  diagonal: boolean
}

function port(tier: string, mount: Mount, turnPerTick: number, diagonal = false): GunPort {
  return { name: tier + 'EnemyShootingPort' + mount + (diagonal ? '2' : ''), mount, turnPerTick, diagonal }
}

const aimedPort = [port('easy', 'Center', 0)]
export const gunPorts: Record<StrongType, GunPort[]> = {
  [StrongType.VERY_EASY]: aimedPort,
  [StrongType.EASY]: aimedPort,
  [StrongType.NORMAL]: [port('normal', 'Center', 0.003)],
  [StrongType.MEDIUM]: [port('medium', 'Left', 0.005), port('medium', 'Right', 0.003)],
  [StrongType.HARD]: [
    port('hard', 'Left', 0.003), port('hard', 'Left', 0.003, true),
    port('hard', 'Right', 0.005), port('hard', 'Right', 0.005, true),
  ],
  [StrongType.EXTREME]: [
    port('extreme', 'Center', 0.004), port('extreme', 'Center', 0.004, true),
    port('extreme', 'Left', 0.002), port('extreme', 'Left', 0.002, true),
    port('extreme', 'Right', 0.008), port('extreme', 'Right', 0.008, true),
  ],
}

const edgeMidpoints = [
  new Vector3(0, -0.025, 0), new Vector3(0.025, 0, 0),
  new Vector3(0, 0.025, 0), new Vector3(-0.025, 0, 0),
]

function fire(position: Vector3, direction: Vector3, unbroken: boolean) {
  const events = unbroken ? enemyProjectileEvents.unbroken : enemyProjectileEvents.normal
  PubSub.publish(events.shoot, { id: Math.random(), position: position.clone(), direction, projectileRotation: new Vector3() })
}

export function fireEnemyVolley(strength: StrongType, mounts: (Mesh | null)[], target: Vector3) {
  if (strength === StrongType.VERY_EASY || strength === StrongType.EASY) {
    const muzzle = mounts[0]
    if (!muzzle) return
    const direction = target.clone().sub(muzzle.position)
    const offset = (Math.random() > 0.5 ? 1 : -1) * Math.random()
    direction.x += offset
    direction.z += offset
    fire(muzzle.position, direction, strength === StrongType.EASY && Math.random() > 0.6)
    return
  }

  // Hard and extreme turrets alternate by mount. Other turrets alternate by edge.
  const alternateByMount = strength === StrongType.HARD || strength === StrongType.EXTREME
  mounts.forEach((mount, index) => {
    if (!mount) return
    const center = new Vector3().setFromMatrixPosition(mount.matrixWorld)
    edgeMidpoints.forEach((edge, side) => {
      const direction = edge.clone().applyMatrix4(mount.matrixWorld).sub(center).normalize()
      direction.y = 0
      fire(center, direction, (alternateByMount ? index : side) % 2 === 1)
    })
  })
}
