import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const initialOverlayState = {
  mainTitleOverlay: true,
  resumeBattle: false,
  continueOverlay: false,
  titleScreenOverlay: false,
  scoreTransition: false,
  onlineResultOverlay: false,
  playerSummaryOverlay: false,
  requestPlayerInfoOverlay: false,
  requestPlayerInfoPhase3Overlay: false,
}

interface OverlayStore {
  isShowOverlay: typeof initialOverlayState
  setShowOverlay: (key: keyof typeof initialOverlayState, value: boolean) => void
}

export const useOverlayStore = create<OverlayStore>()(
  subscribeWithSelector((set) => ({
    isShowOverlay: initialOverlayState,
    setShowOverlay: (key, value) =>
      set((state) => ({
        isShowOverlay: { ...state.isShowOverlay, [key]: value },
      })),
  }))
)
