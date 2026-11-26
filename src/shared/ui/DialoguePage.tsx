import useAudioStore from '@/features/audio/AudioStore'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GamepadState, gamepadManager } from '../input/GamepadManager'
import styles from './GameDialogue.module.css'

interface DialogueProps {
  line: string
  speaker?: string
  duration: number
  choices?: readonly [string, string]
  onConfirmStart?: (index: number) => void
  onConfirm: (index: number) => void
  onChangeDisplay?: () => void
  allowEarlyAdvance?: boolean
}

function padKeys({ buttons, axes }: GamepadState) {
  return {
    up: buttons['D-Pad Up'] || axes['Left Stick Vertical'] < -0.65,
    down: buttons['D-Pad Down'] || axes['Left Stick Vertical'] > 0.65,
    confirm: buttons.A || buttons.Cross || buttons.Circle,
    display: buttons.Y || buttons.Triangle,
  }
}

export default function DialoguePage({ line, speaker, duration, choices, onConfirmStart, onConfirm, onChangeDisplay, allowEarlyAdvance = false }: DialogueProps) {
  const t = useTranslations()
  const [length, setLength] = useState(0)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const confirmed = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const letters = Array.from(line)
  const notice = !choices
  const canConfirm = ready || (notice && allowEarlyAdvance)

  useEffect(() => {
    root.current?.focus({ preventScroll: true })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let frame: number
    function reveal(now: number) {
      const elapsed = now - start
      setLength(reduced ? letters.length : Math.min(letters.length, Math.ceil(elapsed / duration * letters.length)))
      if (reduced || elapsed >= duration + 70) setReady(true)
      else frame = requestAnimationFrame(reveal)
    }
    frame = requestAnimationFrame(reveal)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer.current)
    }
  }, [line, letters.length, duration])

  const confirm = useCallback((index: number) => {
    if (!canConfirm || confirmed.current) return
    confirmed.current = true
    setSelected(index)
    setConfirming(true)
    onConfirmStart?.(index)
    useAudioStore.getState().play('buttonClick')
    timer.current = window.setTimeout(() => onConfirm(index), notice ? 50 : 300)
  }, [canConfirm, notice, onConfirmStart, onConfirm])

  useEffect(() => {
    function move(direction: number) {
      if (!ready || notice || confirmed.current) return
      root.current?.focus({ preventScroll: true })
      setSelected(index => index === null ? (direction < 0 ? 0 : 1) : 1 - index)
    }
    function keydown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const { code } = event
      if (code === 'KeyY' && onChangeDisplay && !event.repeat) {
        event.preventDefault()
        onChangeDisplay()
      } else if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(code)) {
        event.preventDefault()
        if (!event.repeat) move(code === 'ArrowUp' || code === 'KeyW' ? -1 : 1)
      } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
        if (event.target instanceof Element && event.target.closest('[aria-keyshortcuts="Y"]')) return
        event.preventDefault()
        if (!event.repeat) confirm(selected ?? 0)
      }
    }
    let previous = padKeys(gamepadManager.getState())
    function gamepad(state: GamepadState) {
      const next = padKeys(state)
      if (!root.current?.closest('dialog')?.contains(document.activeElement)) {
        previous = next
        return
      }
      if (next.up && !previous.up) move(-1)
      if (next.down && !previous.down) move(1)
      if (next.display && !previous.display) onChangeDisplay?.()
      if (next.confirm && !previous.confirm) confirm(selected ?? 0)
      previous = next
    }
    window.addEventListener('keydown', keydown)
    gamepadManager.on('update', gamepad)
    return () => {
      window.removeEventListener('keydown', keydown)
      gamepadManager.off('update', gamepad)
    }
  }, [ready, notice, selected, confirm, onChangeDisplay])

  const text = <span className={styles.line} aria-hidden="true">{letters.slice(0, length).join('')}</span>
  return (
    <div className={styles.dialogue} ref={root} tabIndex={-1} data-confirming={confirming}>
      {speaker && <div className={styles.speaker}>{speaker}</div>}
      <div className={styles.band}>
        <div className={styles.ornament} />
        {notice ? (
          <button type="button" className={styles.advance} aria-label={line + ' ' + t('advanceDialogue')}
            disabled={!canConfirm} onClick={() => confirm(0)}>{text}</button>
        ) : text}
      </div>
      {choices && ready && <div className={styles.choices}>
        {choices.map((label, index) => (
          <button type="button" key={label} className={styles.choice}
            data-selected={selected === index}
            aria-disabled={confirming} onFocus={() => !confirmed.current && setSelected(index)}
            onPointerMove={() => !confirmed.current && setSelected(index)} onClick={() => confirm(index)}>
            <svg className={styles.cursor} aria-hidden="true" viewBox="0 0 18 14" fill="none">
              <path d="M1 7Q6 1.3 13.3 7Q6 12.7 1 7ZM4 7Q7 4.4 10 7Q7 9.6 4 7Z" stroke="currentColor" strokeWidth=".85" />
              <path d="m7 5.6 2 1.4L7 8.4 5.3 7zM14 1h3v3h-3zm0 9.3h3v3h-3z" fill="currentColor" />
            </svg>
            <span className={styles.square} aria-hidden="true" />{label}
          </button>
        ))}
      </div>}
    </div>
  )
}
