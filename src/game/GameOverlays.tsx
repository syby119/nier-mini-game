import MainTitleOverlay from '@/features/cover/MainTitleOverlay'
import DeveloperStagePicker from '@/features/developer/DeveloperStagePicker'
import { readStagePreview, startStagePreview } from '@/features/developer/developerStages'
import FinaleSaveOverlay from '@/features/ending/FinaleSaveOverlay'
import ResultOverlay from '@/features/ending/OnlineResultOverlay'
import PlayerSummaryOverlay from '@/features/ending/PlayerSummaryOverlay'
import OpeningSequence from '@/features/opening/OpeningSequence'
import ContinueOverlay from '@/features/rescue/ContinueOverlay'
import { pendingDonation } from '@/features/saves/endingSave'
import { useEffect, useRef } from 'react'
import CutsceneOverlay from './CutsceneOverlay'
import GamePauseOverlay from './GamePauseOverlay'
import NotificationOverlay from './NotificationOverlay'
import PreLoadAssetsOverlay from './PreLoadAssetsOverlay'
import { useOverlayStore } from './state/OverlayStore'
import systemInfoStore from './state/SystemInfoStore'

export default function GameOverlays() {
  const booted = useRef(false)
  const isInitRes = systemInfoStore((state) => state.initRes)
  const screens = useOverlayStore(state => state.isShowOverlay)
  useEffect(() => {
    if (booted.current) return
    if (process.env.NODE_ENV === 'development') {
      const preview = readStagePreview(window.location.search)
      if (preview) {
        booted.current = true
        startStagePreview(preview)
        return
      }
    }
    if (!isInitRes) return
    booted.current = true
    if (!pendingDonation()) return
    const { setShowOverlay } = useOverlayStore.getState()
    setShowOverlay('mainTitleOverlay', false)
    setShowOverlay('requestPlayerInfoPhase3Overlay', true)
  }, [isInitRes])
  return (
    <div className="w-full h-full absolute top-0 left-0 flex items-center justify-center select-none flex-col pointer-events-none">
      {process.env.NODE_ENV === 'development' && <DeveloperStagePicker />}
      {!isInitRes && <PreLoadAssetsOverlay />}
      {isInitRes && <>
        <NotificationOverlay />
        <GamePauseOverlay />
        {screens.mainTitleOverlay && <MainTitleOverlay />}
        {screens.titleScreenOverlay && <OpeningSequence fromSave={screens.resumeBattle} />}
        {screens.continueOverlay && <ContinueOverlay />}
        {screens.scoreTransition && <CutsceneOverlay />}
        {screens.onlineResultOverlay && <ResultOverlay />}
        {screens.playerSummaryOverlay && <PlayerSummaryOverlay />}
        {screens.requestPlayerInfoOverlay && <FinaleSaveOverlay message />}
        {screens.requestPlayerInfoPhase3Overlay && <FinaleSaveOverlay />}
      </>}
    </div>
  )
};
