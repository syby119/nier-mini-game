import { Howl } from 'howler'
import { create } from 'zustand'
import { setCreditsDialogueLevel, setCreditsVolume } from './CreditsMusic'

type SoundPool = { pool: Howl[]; index: number; volume: number; type?: string }

type AudioStore = {
  initVolume: number // 初始音量
  sounds: Record<string, SoundPool>
  play: (name: string, config?: {
    volume?: number
    sprite?: string
  }) => void
  setVolume: (name: string, volume: number) => void
  setAllVolume: (volume: number) => void
  stop: (name: string) => void
  addSound: (name: string, src: string, config?: {
    volume?: number,
    sprite?: { [key: string]: [number, number] },
    poolSize?: number,
    loop?: boolean,
    type?: string
  }) => void
  removeSound: (name: string) => void
  removeSoundByType: (type: string) => void
}

const duckingLevels = { opening: .2, pod: .1 }
type DuckingReason = keyof typeof duckingLevels

const lastVoice = new WeakMap<Howl, number>()
const duckingReasons = new Set<DuckingReason>()
let musicDuckingLevel = 1

function applyPoolVolume(soundPool: SoundPool, fadeMs = 0) {
  const level = soundPool.volume * (soundPool.type === 'music' ? musicDuckingLevel : 1)
  for (const sound of soundPool.pool) {
    if (fadeMs && sound.playing() && sound.volume() !== level) sound.fade(sound.volume(), level, fadeMs)
    else sound.volume(level)
  }
}

export function setMusicDucking(reason: DuckingReason, active: boolean, fadeMs = active ? 80 : 750) {
  if (active) duckingReasons.add(reason)
  else duckingReasons.delete(reason)
  const level = Math.min(1, ...Array.from(duckingReasons, reason => duckingLevels[reason]))
  if (level === musicDuckingLevel) return
  musicDuckingLevel = level
  setCreditsDialogueLevel(level, fadeMs / 1000)
  for (const soundPool of Object.values(useAudioStore.getState().sounds)) {
    if (soundPool.type === 'music') applyPoolVolume(soundPool, fadeMs)
  }
}

// 初始化音效
const initializeSoundsWithPool = (): Record<string, SoundPool> => {
  const sounds: Record<string, SoundPool> = {}
  const audioList: {
    name: string; src: string; volume?: number, sprite?: {
      [key: string]: [number, number]
    }, poolSize?: number, loop?: boolean
  }[] = [
      { name: 'buttonClick', src: 'nier/sound/sfx/buttonClick.ogg', volume: 0.3, },
      { name: 'playerShot', src: 'nier/sound/sfx/playerShot1.ogg', volume: 0.3, poolSize: 3 },
      { name: 'enemyHit', src: 'nier/sound/sfx/enemyHit.ogg', volume: 0.3, poolSize: 3 },
      { name: 'coreExplode1', src: 'nier/sound/sfx/coreExplode1.ogg', volume: 0.3 },
      { name: 'playerExplode', src: 'nier/sound/sfx/playerExplode.ogg', volume: 0.3 },
      { name: 'playerHit', src: 'nier/sound/sfx/playerHit.ogg', volume: 0.3 },
    ]

  audioList.forEach((audio) => {
    const volume = audio.volume ?? 1
    sounds[audio.name] = {
      pool: Array.from({ length: audio.poolSize || 1 }, () =>
        new Howl({
          src: [audio.src],
          volume,
          loop: audio.loop,
        })
      ),
      index: 0, // 当前池的索引
      volume,
    }
  })

  return sounds
}

// 创建 Zustand Store
const useAudioStore = create<AudioStore>((set, get) => ({
  initVolume: 0.3, // 初始音量
  sounds: initializeSoundsWithPool(), // 在 Store 初始化时加载音效

  // 播放音效
  play: (name: string, config?: { volume?: number; sprite?: string }) => {
    const soundPool = get().sounds[name]
    if (soundPool) {
      const { pool, index } = soundPool
      // 从池中取出当前索引的音效
      const sound = pool[index]
      const previous = lastVoice.get(sound)
      if (previous !== undefined && sound.playing(previous)) {
        if (soundPool.type === 'music') {
          sound.stop(previous)
        } else {
          // Release only the displaced voice. The next hit can start immediately.
          sound.once('fade', () => sound.stop(previous), previous)
          sound.fade(Number(sound.volume(previous)), 0, 18, previous)
        }
      }
      const voice = sound.play(config?.sprite)
      if (config?.volume !== undefined) {
        sound.volume(config.volume * (soundPool.type === 'music' ? musicDuckingLevel : 1), voice)
      }
      lastVoice.set(sound, voice)

      // 更新池的索引，循环回到头部
      soundPool.index = (index + 1) % pool.length
    } else {
      console.warn(`Audio "${name}" not found!`)
    }
  },

  // 设置音效音量
  setVolume: (name: string, volume: number) => {
    const soundPool = get().sounds[name]
    if (soundPool) {
      soundPool.volume = volume
      applyPoolVolume(soundPool)
    } else {
      console.warn(`Audio "${name}" not found!`)
    }
  },

  // 设置所有音效音量
  setAllVolume: (volume: number) => {
    set({ initVolume: volume })
    setCreditsVolume(volume)
    Object.values(get().sounds).forEach((soundPool) => {
      soundPool.volume = volume
      applyPoolVolume(soundPool)
    })
  },
  // 停止音效
  stop: (name: string) => {
    const soundPool = get().sounds[name]
    if (soundPool) {
      soundPool.pool.forEach((sound) => sound.stop())
    } else {
      console.warn(`Audio "${name}" not found!`)
    }
  },

  // 添加音效
  addSound: (name: string, src: string, config?: {
    volume?: number, sprite?: { [key: string]: [number, number] }, poolSize?: number, type?: string, loop?: boolean
  }) => {
    const soundPool = get().sounds[name]
    if (soundPool) {
      console.warn(`Audio "${name}" already exists!`)
      return
    }

    const volume = config?.volume ?? (config?.type === 'music' ? get().initVolume : 1)
    get().sounds[name] = {
      pool: Array.from({ length: config?.poolSize || 1 }, () =>
        new Howl({
          src: [src],
          volume: volume * (config?.type === 'music' ? musicDuckingLevel : 1),
          sprite: config?.sprite,
          html5: true,
          loop: config?.loop,
        })
      ),
      index: 0, // 当前池的索引
      volume,
      type: config?.type,
    }
  },

  // 移除音效
  removeSound: (name: string) => {
    const soundPool = get().sounds[name]
    if (soundPool) {
      soundPool.pool.forEach((sound) => sound.unload())
      delete get().sounds[name]
    } else {
      console.warn(`Audio "${name}" not found!`)
    }
  },

  // 移除指定类型的音效
  removeSoundByType: (type: string) => {
    Object.entries(get().sounds).forEach(([name, soundPool]) => {
      if (soundPool.type === type) {
        soundPool.pool.forEach((sound) => sound.unload())
        delete get().sounds[name]
      }
    })
  },
}))

export default useAudioStore
