import { gamepadManager, type GamepadState } from '@/shared/input/GamepadManager'
import { useKeyboardControls } from '@react-three/drei'
import { useEffect } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import useGamePauseStore from './state/GamePauseStore'
import { useOverlayStore } from './state/OverlayStore'
import systemInfoStore from './state/SystemInfoStore'

export default function GamePauseSystem() {
  const [sub] = useKeyboardControls()
  const togglePause = () => {
    const system = systemInfoStore.getState()
    if (!system.gameStarted || system.systemInfo.currentPhase === 'end') return
    const overlays = useOverlayStore.getState().isShowOverlay
    if (!overlays.continueOverlay && !overlays.requestPlayerInfoOverlay && !overlays.requestPlayerInfoPhase3Overlay) {
      useGamePauseStore.getState().togglePause()
    }
  }

  const debouncedGamePadStateUpdate = useDebouncedCallback((gamepadState: GamepadState) => {
    if (gamepadState.buttons['Start'] ||
      gamepadState.buttons['Options']) {
      togglePause()
    }
  }, 100)

  const handleGamePadStateUpdate = (gamepadState: GamepadState) => {
    if (gamepadState.buttons['Start'] ||
      gamepadState.buttons['Options']) {
      debouncedGamePadStateUpdate(gamepadState)
    }
  }

  useEffect(() => {
    return sub(
      (state) => state.escape,
      (pressed) => {
        if (pressed) {
          togglePause()
        }
      }
    )
  }, [])

  useEffect(() => {
    gamepadManager.on('update', handleGamePadStateUpdate)
    return () => {
      // 清理订阅
      gamepadManager.off('update', handleGamePadStateUpdate)
    }
  }, [])

  return (null)
}
