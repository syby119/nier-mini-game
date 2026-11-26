import { EnemyData } from '../data/EnemyData'
import { joinCreditsChoir, startCreditsMusic } from '../store/CreditsMusic'
import { getRescuePilots } from '../store/NetworkStore'
import { useOverlayStore } from '../store/OverlayStore'
import usePlayerStore from '../store/PlayerStore'
import systemInfoStore from '../store/SystemInfoStore'

export const stageNames = new Map<string, string>()
for (const enemy of EnemyData) {
  if (!stageNames.has(enemy.phase)) stageNames.set(enemy.phase, enemy.text)
}
stageNames.set('end', '結算')

interface StagePreview {
  stage: string
  support: boolean
}

export function readStagePreview(search: string): StagePreview | null {
  const params = new URLSearchParams(search)
  const stage = params.get('stage')
  if (!stage || !stageNames.has(stage)) return null
  return { stage, support: stage !== 'end' && params.get('support') === '1' }
}

export function navigateToStage(stage: string, support: boolean) {
  const url = new URL(window.location.href)
  url.searchParams.set('stage', stage)
  if (support && stage !== 'end') url.searchParams.set('support', '1')
  else url.searchParams.delete('support')
  // A fresh run also discards pending enemy spawns, shots and dialogue timers.
  if (url.href === window.location.href) window.location.reload()
  else window.location.assign(url.href)
}

export function startStagePreview({ stage, support }: StagePreview) {
  const system = systemInfoStore.getState()
  const overlay = useOverlayStore.getState()
  const effects = localStorage.getItem('gpu_setting_post_effects')
  if (effects !== null) system.setPostEffects(effects === 'true')
  system.updateSystemInfo({ mainOverlayShowed: true, titleScreenShowed: true, currentPhase: stage })
  overlay.setShowOverlay('mainTitleOverlay', false)
  system.doneInitRes()

  if (stage === 'end') {
    overlay.setShowOverlay('playerSummaryOverlay', true)
    return
  }
  system.setImportantPhaseRecord(stage)
  if (support) {
    usePlayerStore.getState().updatePlayerInfo({ needOtherPlayerHelp: true, rescuePilots: getRescuePilots() })
    joinCreditsChoir()
  } else {
    startCreditsMusic()
  }
  // Late-stage enemies can spawn at the center of the field.
  system.setGameStarted(true, -0.7)
}
