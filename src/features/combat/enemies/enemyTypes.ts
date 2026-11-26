import type { Vector3 } from 'three'

export enum StrongType {
  VERY_EASY = 'VERY_EASY',
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXTREME = 'EXTREME',
}

export interface EnemyDefinition {
  id: string
  type?: string
  initPosition: Vector3
  spawnDelay?: number
  text: string
  phase: string
  nextPhase?: string
  isImportantPhase?: boolean
  childrenIds: string[]
  isNeedChidAllDead?: boolean
  strongType: StrongType
  enableShoot?: boolean
  castCredit?: 'role' | 'performer' | 'target'
  shootIntervalTime?: number //0.6s
  health: number
  points?: number
}

export interface EnemyProps extends EnemyDefinition {
  onLeave?: (id: string) => void
  onDeath?: (
    id: string,
    phase?: string,
    nextPhase?: string,
    isImportantPhase?: boolean,
    isNeedChidAllDead?: boolean,
    childrenIds?: string[],
    points?: number
  ) => void
}
