import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { isSupportMessageText } from './supportMessageText'

export interface SupportMessage {
  name: string
  content: string
  region?: string
}

interface OnlineResult { name: string; score: number }

interface NetworkStore {
  onlineData: OnlineResult[]
  isConnectedToNetwork: boolean
  notEnablePlayerNameList: string[]
  supportMessages: SupportMessage[]
  fetchOnlineData: () => Promise<void>
}

async function readList<T>(url: string): Promise<T[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to load ' + url)
  const { data } = await response.json()
  if (!Array.isArray(data)) throw new Error('Expected a list from ' + url)
  return data
}

// Offline pilot names visible in the finale's rescue and loss messages.
const recordedPilots = ['Honoka', 'Chrysalis', 'Jared', 'Sirix', 'Ayphos', 'Colton', 'Jan', 'RoksAtlas', 'SYEDAHMEDPS', 'Fbb', 'Bran']

export function getRescuePilots() {
  return Array.from(new Set([...useNetworkStore.getState().notEnablePlayerNameList, ...recordedPilots]))
}

export const useNetworkStore = create<NetworkStore>()(
  subscribeWithSelector((set) => {
    let loading = false
    return {
      onlineData: [],
      isConnectedToNetwork: false,
      notEnablePlayerNameList: [],
      supportMessages: [],
      fetchOnlineData: async () => {
        if (loading) return
        loading = true
        try {
          const [scores, helpers, messages] = await Promise.allSettled([
            readList<OnlineResult>('/api/getOnlineResult'),
            readList<{ name: string }>('/api/getNotEnablePlayerNameList'),
            readList<SupportMessage>('/api/getContent'),
          ])
          if (scores.status === 'fulfilled') set({ onlineData: scores.value })
          if (helpers.status === 'fulfilled') {
            const names = helpers.value.map(row => row.name).filter(name => typeof name === 'string' && name.trim())
            set({ notEnablePlayerNameList: names.sort(() => Math.random() - .5) })
          }
          if (messages.status === 'fulfilled') {
            set({ supportMessages: messages.value.filter(row => isSupportMessageText(row?.content)) })
          }
          set({ isConnectedToNetwork: [scores, helpers, messages].every(result => result.status === 'fulfilled') })
        } finally {
          loading = false
        }
      },
    }
  })
)
