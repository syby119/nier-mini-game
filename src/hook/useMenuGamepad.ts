import { useEffect, useRef } from 'react'
import { menuGamepad, type GamepadState } from '../modules/GamepadManager'

type Command = 'up' | 'down' | 'confirm' | 'back'

function buttons({ buttons, axes }: GamepadState) {
  return {
    up: buttons['D-Pad Up'] || axes['Left Stick Vertical'] < -.55,
    down: buttons['D-Pad Down'] || axes['Left Stick Vertical'] > .55,
    confirm: buttons.A || buttons.Cross,
    back: buttons.B || buttons.Circle,
  }
}

export function useMenuGamepad(enabled: boolean, handle: (command: Command) => void) {
  const latest = useRef(handle)
  latest.current = handle
  useEffect(() => {
    if (!enabled) return
    let previous = buttons(menuGamepad.getState())
    const update = (state: GamepadState) => {
      const next = buttons(state)
      for (const key of Object.keys(next) as Command[]) {
        if (next[key] && !previous[key]) { latest.current(key); break }
      }
      previous = next
    }
    menuGamepad.on('update', update)
    return () => { menuGamepad.off('update', update) }
  }, [enabled])
}
