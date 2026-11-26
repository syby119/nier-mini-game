import type { EnemyDefinition } from '../enemyTypes'
import { castWaves } from './cast'
import { designAndArtWaves } from './designAndArt'
import { finaleWaves } from './finale'
import { programmingAndSoundWaves } from './programmingAndSound'
import { publishingWaves } from './publishing'

// Selected from the 2017 English staff roll and grouped for the web game's waves.
// In-game credits: https://www.youtube.com/watch?v=ZrG3WaeIwhk
export const EnemyData: EnemyDefinition[] = [
  ...castWaves,
  ...designAndArtWaves,
  ...programmingAndSoundWaves,
  ...publishingWaves,
  ...finaleWaves,
]
