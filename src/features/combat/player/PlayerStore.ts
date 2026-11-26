import type { EndingSave } from '@/features/saves/saveTypes'
import systemInfoStore from '@/game/state/SystemInfoStore'
import PubSub from 'pubsub-js'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware' // 如果需要订阅特定状态变化

interface PlayerInfo {
  playerHealth: number
  needOtherPlayerHelp: boolean
  rescuePilots?: string[]
}

interface PlayerStore {
  playerInfo: PlayerInfo
  playerShareInfo: EndingSave
  setPlayerHealth: (newHealth: number) => void
  resetPlayerInfo: () => void
  resetPlayerShareInfo: () => void
  updatePlayerInfo: (updates: Partial<PlayerInfo>) => void
  setPlayerToDeath: () => void
  addCombatStats: (delta: Partial<Record<CombatCounter, number>>) => void
  respawnPlayer: () => void
  setPlayerShareInfo: (newShareInfo: Partial<EndingSave>) => void
}

type CombatCounter = 'points' | 'enemiesDefeated' | 'shootCount' | 'shootHitCount' | 'onHitCount'

const initValue: PlayerInfo = {
  playerHealth: 3,
  needOtherPlayerHelp: false,
}

const initShareValue: EndingSave = {
  name: 'player',
  content: '',
  region: '',
  points: 0,
  enemiesDefeated: 0,
  playerTime: 0,
  deathCount: 0,
  shootCount: 0,
  shootHitCount: 0,
  onHitCount: 0,
  retryCount: 0,
}

const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set, get) => ({
    playerInfo: initValue,
    playerShareInfo: initShareValue,

    setPlayerHealth: (newHealth: number) => {
      set((state) => ({
        playerInfo: { ...state.playerInfo, playerHealth: newHealth },
      }))
    },

    resetPlayerInfo: () => {
      set(() => ({ playerInfo: initValue }))
      PubSub.publish('resetPlayerModel')
      PubSub.publish('resetPlayerPosition')
      PubSub.publish('setDisablePlayerMove', false)
    },

    resetPlayerShareInfo: () => {
      set(() => ({ playerShareInfo: initShareValue }))
    },

    updatePlayerInfo: (updates: Partial<PlayerInfo>) => {
      set((state) => ({
        playerInfo: { ...state.playerInfo, ...updates },
      }))
    },

    setPlayerToDeath: () => {
      const currentDeathCount = get().playerShareInfo.deathCount
      set((state) => ({
        playerInfo: {
          ...state.playerInfo,
          playerHealth: 0,
        },
        playerShareInfo: {
          ...state.playerShareInfo,
          deathCount: currentDeathCount + 1,
        },
      }))
    },

    respawnPlayer: () => {
      PubSub.publish('resetPlayerModel')
      PubSub.publish('resetPlayerPosition')
      PubSub.publish('setDisablePlayerMove', false)
      PubSub.publish('setPlayerVisibleModel', true)
      set((state) => ({
        playerInfo: { ...state.playerInfo, playerHealth: 3 },
      }))
    },

    addCombatStats: (delta) => {
      const system = systemInfoStore.getState()
      if (!system.gameStarted || system.systemInfo.currentPhase === 'end') return
      set(state => {
        const stats = { ...state.playerShareInfo }
        for (const key of Object.keys(delta) as CombatCounter[]) stats[key] += delta[key]!
        return { playerShareInfo: stats }
      })
    },

    setPlayerShareInfo: (newShareInfo: Partial<EndingSave>) => {
      set((state) => ({
        playerShareInfo: { ...state.playerShareInfo, ...newShareInfo },
      }))
    }
  }))
)

export default usePlayerStore
