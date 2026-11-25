import type usePlayerStore from '../store/PlayerStore'

export type EndingSave = ReturnType<typeof usePlayerStore.getState>['playerShareInfo']
const activeKey = 'nier.endingSave'
const pendingKey = 'nier.pendingSaveDonation'

function persist(key: string, run: EndingSave | null) {
  try {
    if (run) localStorage.setItem(key, JSON.stringify(run))
    else localStorage.removeItem(key)
  } catch { /* Private browsing can limit storage. The run also lives in the player store. */ }
}

export function keepEndingSave(run: EndingSave | null) { persist(activeKey, run) }
export function rememberDonation(run: EndingSave | null) { persist(pendingKey, run) }

export function pendingDonation(): EndingSave | null {
  try {
    const value = JSON.parse(localStorage.getItem(pendingKey) || 'null')
    return value && typeof value.name === 'string' && typeof value.points === 'number' ? value : null
  } catch { return null }
}
