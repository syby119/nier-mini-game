'use client'

import React, { useEffect, useRef, useState } from 'react'
import { animated, useSpring } from '@react-spring/web'
import systemInfoStore from '../../store/SystemInfoStore'
import { useTranslations } from 'next-intl'
import useAudioStore from '../../store/AudioStore'
import { GamepadManager } from '../../modules/GamepadManager'
import { useDetectGPU } from '@react-three/drei'
import { useOverlayStore } from '../../store/OverlayStore'
import { useNotificationStore } from '../../store/NotificationStore'
import NierCoverScene from './NierCoverScene'

const gamepadManager = new GamepadManager()
const AnimatedDiv = animated('div')
const MENU_ITEMS = ['new-game', 'settings'] as const

const getMenuLabel = (item: (typeof MENU_ITEMS)[number]) => {
  switch (item) {
    case 'new-game':
      return 'New Game'
    case 'settings':
      return 'Setting'
    default:
      return ''
  }
}

export default function MainTitleOverlay() {
  const updateSystemInfo = systemInfoStore((state) => state.updateSystemInfo)
  const setShowOverlay = useOverlayStore((state) => state.setShowOverlay)
  const isButtonClickedRef = useRef(false)
  const navLockRef = useRef({ up: false, down: false, confirm: false })
  const { play: playAudio } = useAudioStore()
  const [isGamePadMoved, setIsGamePadMoved] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const postEffects = systemInfoStore((state) => state.postEffects)
  const setPostEffects = systemInfoStore((state) => state.setPostEffects)
  const addNotification = useNotificationStore((state) => state.addNotification)
  const t = useTranslations()
  const [styles, api] = useSpring(() => ({
    from: { mainTitle: 0 },
    to: async (next) => {
      await next({ mainTitle: 1 })
    },
    config: { duration: 1000 },
  }))
  const GPUTier = useDetectGPU()

  const handleClickStart = () => {
    if (isButtonClickedRef.current) return

    isButtonClickedRef.current = true
    playAudio('buttonClick')
    api.start({
      from: { mainTitle: 1 },
      to: async (next) => {
        await next({ mainTitle: 0 })
      },
      config: { duration: 500 },
      onRest: () => {
        updateSystemInfo({
          mainOverlayShowed: true,
        })
        setShowOverlay('mainTitleOverlay', false)
        setTimeout(() => {
          setShowOverlay('titleScreenOverlay', true)
        }, 1000)
      },
    })
  }

  const handleGPUSetting = () => {
    const initSetting = localStorage.getItem('initSetting')
    if (!initSetting || initSetting === 'false') {
      localStorage.setItem('initSetting', 'true')
      if (GPUTier.tier <= 2) {
        addNotification('建議關閉後處理特效以改善效能')
        setPostEffects(false)
        localStorage.setItem('gpu_setting_post_effects', 'false')
        return
      }
      setPostEffects(true)
      localStorage.setItem('gpu_setting_post_effects', 'true')
      return
    }

    localStorage.setItem('initSetting', 'true')
    const gpuSettingPostEffects = localStorage.getItem('gpu_setting_post_effects')
    if (gpuSettingPostEffects === 'true') {
      setPostEffects(true)
    } else if (gpuSettingPostEffects === 'false') {
      setPostEffects(false)
    }
  }

  const moveSelection = (delta: number) => {
    setIsGamePadMoved(true)
    setSelectedIndex((prev) => (prev + delta + MENU_ITEMS.length) % MENU_ITEMS.length)
    playAudio('buttonClick')
  }

  const handleTogglePostEffects = () => {
    const nextValue = !postEffects
    setPostEffects(nextValue)
    localStorage.setItem('gpu_setting_post_effects', String(nextValue))
    playAudio('buttonClick')
  }

  const handleActivate = (index: number) => {
    const item = MENU_ITEMS[index]

    if (item === 'new-game') {
      handleClickStart()
      return
    }

    if (item === 'settings') {
      setShowSettings((prev) => !prev)
      playAudio('buttonClick')
      return
    }
  }

  useEffect(() => {
    const handleGamepadUpdate = (gamepadState: any) => {
      if (!gamepadManager.isConnected()) return

      setIsGamePadMoved(true)

      const upPressed =
        gamepadState.buttons['D-Pad Up'] ||
        (gamepadState.axes['Left Stick Vertical'] ?? 0) < -0.65
      const downPressed =
        gamepadState.buttons['D-Pad Down'] ||
        (gamepadState.axes['Left Stick Vertical'] ?? 0) > 0.65
      const confirmPressed =
        gamepadState.buttons['A'] ||
        gamepadState.buttons['Cross'] ||
        gamepadState.buttons['Circle']

      if (upPressed && !navLockRef.current.up) {
        moveSelection(-1)
      }
      if (downPressed && !navLockRef.current.down) {
        moveSelection(1)
      }
      if (confirmPressed && !navLockRef.current.confirm) {
        handleActivate(selectedIndex)
      }

      navLockRef.current = {
        up: !!upPressed,
        down: !!downPressed,
        confirm: !!confirmPressed,
      }
    }

    gamepadManager.on('update', handleGamepadUpdate)
    return () => {
      gamepadManager.off('update', handleGamepadUpdate)
    }
  }, [selectedIndex, postEffects])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault()
        moveSelection(-1)
      }
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault()
        moveSelection(1)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleActivate(selectedIndex)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedIndex, postEffects])

  useEffect(() => {
    handleGPUSetting()
  }, [GPUTier])

  return (
    <AnimatedDiv className="absolute inset-0 overflow-hidden pointer-events-auto" style={{ opacity: styles.mainTitle }}>
      <NierCoverScene />
      <div className="relative z-10 flex h-full flex-col items-center justify-end px-6 pb-[7vh] pt-24 text-[#f2efdf]">
        <div className="w-full max-w-[980px]">
          <div className="flex flex-col items-center text-center">
            <div className="w-full max-w-[620px] aspect-[6.4/1] overflow-hidden">
              <img
                src="/images/nier-automata-logo.jpg"
                alt="NieR:Automata"
                width={700}
                height={420}
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>

          <div className="mt-[20vh] flex flex-col items-center">
            {MENU_ITEMS.map((item, index) => {
              const selected = selectedIndex === index
              const label = getMenuLabel(item)

              return (
                <button
                  key={item}
                  type="button"
                  className="group relative w-full max-w-[420px] bg-transparent py-2 text-center"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleActivate(index)}
                >
                  <span
                    className={`absolute left-1/2 top-1/2 h-px w-[78%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#f4efdf] to-transparent transition-opacity ${
                      selected ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span
                    className={`relative inline-flex items-center gap-2 font-mono text-[clamp(1.5rem,2.8vw,2.2rem)] ${
                      selected ? 'text-[#fffdf6]' : 'text-[#d6cfbd] opacity-80'
                    }`}
                  >
                    {selected && <span className="text-xs">◄</span>}
                    <span>{label}</span>
                  </span>
                </button>
              )
            })}

            <div
              className={`mt-5 w-full max-w-[460px] overflow-hidden border border-white/10 bg-black/20 backdrop-blur-sm transition-all duration-300 ${
                showSettings ? 'max-h-40 p-4 opacity-100' : 'max-h-0 p-0 opacity-0'
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-left">
                <div>
                  <div className="text-xs uppercase tracking-[0.35em] text-white/45">Post Effects</div>
                  <div className="mt-2 text-sm text-[#cbc4b2]">低效能裝置建議關閉，以獲得更穩定畫面。</div>
                </div>
                <button
                  type="button"
                  aria-pressed={postEffects}
                  onClick={handleTogglePostEffects}
                  className={`relative h-8 w-16 rounded-full border transition-colors ${
                    postEffects ? 'border-[#f2ecde] bg-[#f2ecde]/20' : 'border-white/20 bg-white/5'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-[#f6f2e7] transition-all ${
                      postEffects ? 'left-9' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-[#dad2bf] md:flex-row md:justify-between md:text-left">
            <div className="max-w-[360px]">
              <div>{t('control1')}</div>
              <div>{t('control2')}</div>
            </div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/40">
              {isGamePadMoved ? 'Gamepad Connected' : 'Keyboard / Mouse Ready'}
            </div>
          </div>
        </div>
      </div>
    </AnimatedDiv>
  )
}
