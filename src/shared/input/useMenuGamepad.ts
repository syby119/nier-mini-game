import { useEffect, useRef } from 'react'
import { gamepadManager, type GamepadState } from './GamepadManager'

type Command = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back'

function buttons({ buttons, axes }: GamepadState) {
  return {
    up: buttons['D-Pad Up'] || axes['Left Stick Vertical'] < -.55,
    down: buttons['D-Pad Down'] || axes['Left Stick Vertical'] > .55,
    left: buttons['D-Pad Left'] || axes['Left Stick Horizontal'] < -.55,
    right: buttons['D-Pad Right'] || axes['Left Stick Horizontal'] > .55,
    confirm: buttons.A || buttons.Cross,
    back: buttons.B || buttons.Circle,
  }
}

export function useMenuGamepad(enabled: boolean, handle: (command: Command) => void, repeatVertical = false) {
  const latest = useRef(handle)
  latest.current = handle
  useEffect(() => {
    if (!enabled) return
    let previous = buttons(gamepadManager.getState())
    let repeat: number | undefined
    function cancelRepeat() { window.clearTimeout(repeat) }
    function startRepeat(key: 'up' | 'down') {
      function again() {
        latest.current(key)
        repeat = window.setTimeout(again, 95)
      }
      repeat = window.setTimeout(again, 360)
    }
    const update = (state: GamepadState) => {
      const next = buttons(state)
      if ((previous.up && !next.up) || (previous.down && !next.down)) cancelRepeat()
      for (const key of Object.keys(next) as Command[]) {
        if (next[key] && !previous[key]) {
          latest.current(key)
          if (repeatVertical && (key === 'up' || key === 'down')) {
            cancelRepeat()
            startRepeat(key)
          }
          break
        }
      }
      previous = next
    }
    gamepadManager.on('update', update)
    gamepadManager.on('disconnected', cancelRepeat)
    return () => {
      cancelRepeat()
      gamepadManager.off('update', update)
      gamepadManager.off('disconnected', cancelRepeat)
    }
  }, [enabled, repeatVertical])
}
