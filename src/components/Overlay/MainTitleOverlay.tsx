'use client'

import { useCallback, useEffect, useRef } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { useDetectGPU } from '@react-three/drei'
import { menuGamepad, type GamepadState } from '../../modules/GamepadManager'
import useAudioStore from '../../store/AudioStore'
import { prepareCreditsMusic } from '../../store/CreditsMusic'
import { useOverlayStore } from '../../store/OverlayStore'
import systemInfoStore from '../../store/SystemInfoStore'
import NierCoverScene from './NierCoverScene'
import cover from './MainTitleOverlay.module.css'

const AnimatedDiv = animated('div')

function confirmPressed({ buttons }: GamepadState) {
  return buttons.A || buttons.Cross || buttons.Circle
}

export default function MainTitleOverlay() {
  const updateSystemInfo = systemInfoStore(state => state.updateSystemInfo)
  const setShowOverlay = useOverlayStore(state => state.setShowOverlay)
  const setPostEffects = systemInfoStore(state => state.setPostEffects)
  const playAudio = useAudioStore(state => state.play)
  const { tier } = useDetectGPU()
  const starting = useRef(false)
  const [styles, api] = useSpring(() => ({
    from: { mainTitle: 0 },
    to: { mainTitle: 1 },
    config: { duration: 1000 },
  }))

  useEffect(() => {
    const saved = localStorage.getItem('gpu_setting_post_effects')
    if (saved === 'true' || saved === 'false') {
      setPostEffects(saved === 'true')
      return
    }
    const enabled = tier > 2
    setPostEffects(enabled)
    localStorage.setItem('gpu_setting_post_effects', String(enabled))
  }, [tier, setPostEffects])

  const startGame = useCallback(() => {
    if (starting.current) return
    starting.current = true
    prepareCreditsMusic()
    playAudio('buttonClick')
    api.start({
      to: { mainTitle: 0 },
      config: { duration: 500 },
      onRest: () => {
        updateSystemInfo({ mainOverlayShowed: true })
        setShowOverlay('mainTitleOverlay', false)
        setShowOverlay('titleScreenOverlay', true)
      },
    })
  }, [api, playAudio, setShowOverlay, updateSystemInfo])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.target !== document.body) return
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      startGame()
    }

    let wasPressed = confirmPressed(menuGamepad.getState())
    function onGamepadUpdate(state: GamepadState) {
      const pressed = confirmPressed(state)
      if (pressed && !wasPressed && !document.querySelector('dialog[open]')) startGame()
      wasPressed = pressed
    }

    window.addEventListener('keydown', onKeyDown)
    menuGamepad.on('update', onGamepadUpdate)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      menuGamepad.off('update', onGamepadUpdate)
    }
  }, [startGame])

  return (
    <AnimatedDiv className="absolute inset-0 overflow-hidden pointer-events-auto" style={{ opacity: styles.mainTitle }}>
      <NierCoverScene />
      <h1 className={cover.title} aria-label="NieR:Automata">
        <span className={cover.ink} aria-hidden="true" />
        <span className={cover.gear} aria-hidden="true" />
      </h1>
      <button
        type="button"
        className="absolute left-1/2 top-[68%] z-10 w-[90%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 bg-transparent py-2 text-center text-[#fffdf6]"
        onClick={startGame}
      >
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-px w-[78%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#f4efdf] to-transparent" />
        <span className="relative inline-flex items-center gap-2 font-mono text-[clamp(1.5rem,2.8vw,2.2rem)]">
          <span aria-hidden="true" className="text-xs">◄</span>
          New Game
        </span>
      </button>
    </AnimatedDiv>
  )
}
