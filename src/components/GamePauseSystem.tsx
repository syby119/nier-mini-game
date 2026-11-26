import { useKeyboardControls } from '@react-three/drei';
import React, { useEffect } from 'react'
import useGamePauseStore from '../store/GamePauseStore';
import systemInfoStore from '../store/SystemInfoStore';
import { useOverlayStore } from '../store/OverlayStore';
import { GamepadManager } from '../modules/GamepadManager';
import { useDebouncedCallback } from 'use-debounce';

const gamepadManager = new GamepadManager();
export default function GamePauseSystem() {
    const [sub, get] = useKeyboardControls()
    const togglePause = () => {
        const system = systemInfoStore.getState()
        if (!system.gameStarted || system.systemInfo.currentPhase === 'end') return
        const overlays = useOverlayStore.getState().isShowOverlay
        if (!overlays.continueOverlay && !overlays.requestPlayerInfoOverlay && !overlays.requestPlayerInfoPhase3Overlay) {
            useGamePauseStore.getState().togglePause()
        }
    };

    const debouncedGamePadStateUpdate = useDebouncedCallback((gamepadState: any) => {
        if (gamepadState.buttons['Start'] ||
            gamepadState.buttons['Options']) {
            togglePause()
        }
    }, 100)

    const handleGamePadStateUpdate = (gamepadState: any) => {
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
            gamepadManager.off("update", handleGamePadStateUpdate);
        };
    }, [])

    return (null)
}
