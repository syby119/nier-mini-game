import { englishAdditional, englishCast, japaneseEnsemble, japaneseLeads, type VoiceCredit } from '@/features/credits/VoiceCredits'
import { vec3 } from '@react-three/rapier'
import { StrongType, type EnemyDefinition } from '../enemyTypes'

type VoiceTarget = [text: string, x: number, z: number, strength: StrongType]

function voiceWave(phase: string, nextPhase: string, rows: VoiceCredit[],
  targets: VoiceTarget[], requiredChildren: number, checkpoint = false): EnemyDefinition[] {
  const entrances = new Map<string, number>()
  for (const [time, role, performer] of rows) {
    entrances.set(role, time)
    entrances.set(performer, time)
  }

  // The firing positions and points belong to the existing wave. Short role
  // captions travel across the screen independently of the required credits.
  const scored = targets.map(([text, x, z, strongType], index): EnemyDefinition => ({
    id: `enemy_${phase}_${index}`, phase, text, strongType, castCredit: 'target',
    initPosition: vec3({ x, y: 0, z }), spawnDelay: entrances.get(text) ?? 0,
    health: strongType === StrongType.NORMAL ? 15 : 3, points: 100, childrenIds: [],
  }))
  scored[0].nextPhase = nextPhase
  scored[0].childrenIds = scored.slice(1, requiredChildren + 1).map(enemy => enemy.id)
  scored[0].isNeedChidAllDead = true
  scored[0].isImportantPhase = checkpoint

  const fixedNames = new Set(scored.map(enemy => enemy.text))
  const result = [...scored]
  rows.forEach(([spawnDelay, role, performer], row) => {
    [role, performer].forEach((text, column) => {
      if (!text || fixedNames.has(text)) return
      const side = column === 0 ? 1 : -1
      const x = side * (0.36 + (row % 5) * 0.13)
      result.push({
        id: `cast_${phase}_${row}_${column}`, phase, text, spawnDelay,
        initPosition: vec3({ x, y: 0, z: 0 }), castCredit: column === 0 ? 'role' : 'performer',
        strongType: StrongType.VERY_EASY, health: 1, points: 0, enableShoot: false, childrenIds: [],
      })
    })
  })
  return result
}


export const castWaves: EnemyDefinition[] = [
  {
    id: 'enemy_0_0',
    initPosition: vec3({ x: 0, y: 0, z: 0 }),
    text: 'DIRECTOR',
    phase: '0',
    isImportantPhase: true,
    nextPhase: '1',
    childrenIds: [],
    strongType: StrongType.NORMAL,
    health: 15,
    points: 100,
    spawnDelay: 2,
  },
  {
    id: 'enemy_1_0',
    initPosition: vec3({ x: 0.6, y: 0, z: 0.3 }),
    text: 'YOKO TARO',
    phase: '1',
    nextPhase: '2',
    childrenIds: [],
    strongType: StrongType.NORMAL,
    points: 100,
    health: 15,
  },
  {
    id: 'enemy_2_0',
    initPosition: vec3({ x: -0.6, y: 0, z: 0.3 }),
    text: 'Japanese Voices',
    phase: '2',
    isImportantPhase: true,
    nextPhase: '3',
    childrenIds: [],
    strongType: StrongType.NORMAL,
    points: 100,
    health: 15,
  },
  ...voiceWave('3', '4', japaneseLeads.slice(0, 1), [
    ['Yui Ishikawa', 0, 0, StrongType.NORMAL],
  ], 0),
  ...voiceWave('4', '5', japaneseLeads.slice(1), [
    ['Natsuki Hanae', 0.5, 0, StrongType.NORMAL],
    ['Ayaka Suwa', -0.5, 0, StrongType.NORMAL],
  ], 1),
  ...voiceWave('5', '6', japaneseEnsemble, [
    ['Additional Voices', 0, 0, StrongType.NORMAL],
    ['Daisuke Namikawa', 0.6, 0.3, StrongType.VERY_EASY],
    ['Tatsuhisa Suzuki', -0.6, 0.3, StrongType.VERY_EASY],
    ['Hiroki Yasumoto', -0.3, 0.1, StrongType.VERY_EASY],
    ['Kaoru Akiyama', 0.1, 0.6, StrongType.VERY_EASY],
    ['Mai Kadowaki', 0.8, 0.1, StrongType.VERY_EASY],
    ['Chiaki Kanou', -0.5, 0.5, StrongType.NORMAL],
    ['Aoi Yuki', 0.5, 0.1, StrongType.NORMAL],
    ['Katsuyuki Yamazaki', 0.5, 0.5, StrongType.VERY_EASY],
  ], 6),
  ...voiceWave('6', '7', englishCast, [
    ['English Voices', 0, 0, StrongType.NORMAL],
    ['Kira Buckland', 0.8, 0.5, StrongType.NORMAL],
    ['Kyle McCarley', 0.2, 0.2, StrongType.EASY],
    ['Darin De Paul', -0.5, 0.5, StrongType.EASY],
    ['Cherami Leigh', 0, 0.7, StrongType.EASY],
    ['Greg Chun', 0.5, 0.5, StrongType.EASY],
    ['Ray Chase', -0.5, 0.2, StrongType.EASY],
    ['DC Douglas', 0.2, 0.1, StrongType.EASY],
  ], 3, true),
  ...voiceWave('7', '7_1', englishAdditional, [
    ['Additional Voices', -0.8, 0.5, StrongType.NORMAL],
    ['Robbie Daymond', 0.8, 0.3, StrongType.EASY],
    ['Kyle Hebert', -0.8, 0.5, StrongType.EASY],
    ['Carrie Keranen', -0.8, 0.6, StrongType.EASY],
    ['Lauren Landa', 0.5, 0.5, StrongType.EASY],
    ['Wendee Lee', -0.5, 0.2, StrongType.EASY],
    ['Julie Maddalena', 0.2, 0.1, StrongType.EASY],
  ], 3),
]
