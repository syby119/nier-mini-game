import { v4 as uuid } from 'uuid'
import { stopCreditsMusic } from '../store/CreditsMusic'
import useGamePauseStore from '../store/GamePauseStore'
import { useOverlayStore } from '../store/OverlayStore'
import usePlayerStore from '../store/PlayerStore'
import systemInfoStore from '../store/SystemInfoStore'
import { recordStats, writeRun, type PlayerProfile, type RunOutcome } from './profileSaves'

type Session = { profileId: string, id: string, startedAt: number }
let session: Session | undefined
let timer: number | undefined

export function selectPlayer(profile: PlayerProfile) {
  const player = usePlayerStore.getState()
  player.resetPlayerInfo()
  player.resetPlayerShareInfo()
  player.setPlayerShareInfo({ profileId: profile.id, name: profile.name })
}

function checkpoint(outcome: RunOutcome = 'unfinished') {
  if (!session) return
  const stats = usePlayerStore.getState().playerShareInfo
  writeRun(session.profileId, session.id, recordStats(stats, session.startedAt, outcome))
}

function saveCheckpoint() { checkpoint() }
function saveWhenHidden() { if (document.hidden) saveCheckpoint() }

export function startShooting() {
  const system = systemInfoStore.getState()
  if (system.gameStarted) return
  const { profileId } = usePlayerStore.getState().playerShareInfo
  if (profileId) {
    session = { profileId, id: uuid(), startedAt: Date.now() }
    saveCheckpoint()
    timer = window.setInterval(saveCheckpoint, 5000)
    window.addEventListener('pagehide', saveCheckpoint)
    document.addEventListener('visibilitychange', saveWhenHidden)
  }
  system.setImportantPhaseRecord('0')
  system.updateSystemInfo({ mainOverlayShowed: true, titleScreenShowed: true, currentPhase: '0' })
  system.setGameStarted(true)
}

export function finishBattle(outcome: 'retired' | 'cleared') {
  if (!session) return
  checkpoint(outcome)
  session = undefined
  window.clearInterval(timer)
  window.removeEventListener('pagehide', saveCheckpoint)
  document.removeEventListener('visibilitychange', saveWhenHidden)
}

export function returnToCover() {
  finishBattle('retired')
  stopCreditsMusic()
  const system = systemInfoStore.getState()
  system.setGameStarted(false)
  system.setImportantPhaseRecord('')
  system.resetSystemInfo()
  const player = usePlayerStore.getState()
  player.resetPlayerInfo()
  player.resetPlayerShareInfo()
  if (useGamePauseStore.getState().isPaused) useGamePauseStore.getState().togglePause()
  const overlay = useOverlayStore.getState()
  overlay.setShowOverlay('titleScreenOverlay', false)
  overlay.setShowOverlay('mainTitleOverlay', true)
}
