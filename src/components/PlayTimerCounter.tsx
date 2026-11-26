import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import usePlayerStore from '../store/PlayerStore'
import systemInfoStore from '../store/SystemInfoStore'
import useGamePauseStore from '../store/GamePauseStore'

export default function PlayTimerCounter() {
  const remainder = useRef(0)
  useFrame((_, delta) => {
    const { gameStarted, systemInfo } = systemInfoStore.getState()
    if (!gameStarted) { remainder.current = 0; return }
    const player = usePlayerStore.getState()
    if (systemInfo.currentPhase === 'end' || player.playerInfo.playerHealth <= 0 ||
      useGamePauseStore.getState().isPaused || document.hidden) return
    remainder.current += Math.min(delta, 1)
    const seconds = Math.floor(remainder.current)
    if (seconds) {
      remainder.current -= seconds
      player.setPlayerShareInfo({ playerTime: player.playerShareInfo.playerTime + seconds })
    }
  })
  return null
}
