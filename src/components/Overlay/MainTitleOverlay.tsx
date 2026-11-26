'use client'

import { useEffect, useRef, useState } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { useDetectGPU } from '@react-three/drei'
import { useTranslations } from 'next-intl'
import { useMenuGamepad } from '../../hook/useMenuGamepad'
import { selectPlayer, startShooting } from '../../lib/battleSession'
import type { PlayerProfile } from '../../lib/profileSaves'
import useAudioStore from '../../store/AudioStore'
import { prepareCreditsMusic, startCreditsMusic } from '../../store/CreditsMusic'
import { useOverlayStore } from '../../store/OverlayStore'
import systemInfoStore from '../../store/SystemInfoStore'
import NierCoverScene from './NierCoverScene'
import SaveMenu from './SaveMenu'
import cover from './MainTitleOverlay.module.css'

const AnimatedDiv = animated('div')
type Mode = 'new' | 'load'

export default function MainTitleOverlay() {
  const t = useTranslations('saves')
  const [mode, setMode] = useState<Mode | null>(null)
  const [selected, setSelected] = useState<Mode>('new')
  const menu = useRef<HTMLElement>(null)
  const starting = useRef(false)
  const { tier } = useDetectGPU()
  const [styles, api] = useSpring(() => ({
    from: { mainTitle: 0 }, to: { mainTitle: 1 }, config: { duration: 1000 },
  }))

  useEffect(() => {
    let enabled = tier > 2
    try {
      const saved = localStorage.getItem('gpu_setting_post_effects')
      if (saved === null) localStorage.setItem('gpu_setting_post_effects', String(enabled))
      else enabled = saved === 'true' || (saved !== 'false' && enabled)
    } catch { /* The menu can still show the storage error if the browser blocks saves. */ }
    systemInfoStore.getState().setPostEffects(enabled)
  }, [tier])

  function open(item: Mode) {
    if (starting.current) return
    useAudioStore.getState().play('buttonClick')
    setSelected(item)
    setMode(item)
  }
  function move() {
    const next = selected === 'new' ? 'load' : 'new'
    setSelected(next)
    menu.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus()
  }
  useMenuGamepad(!mode, command => {
    if (document.querySelector('dialog[open]')) return
    if (command === 'up' || command === 'down') move()
    if (command === 'confirm') open(selected)
  })
  useEffect(() => {
    if (mode) return
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector('dialog[open]') || event.repeat) return
      if (event.target !== document.body && !menu.current?.contains(event.target as Node)) return
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)) {
        event.preventDefault()
        move()
      } else if ((event.code === 'Enter' || event.code === 'Space') && event.target === document.body) {
        event.preventDefault()
        open(selected)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [mode, selected])

  function launch(profile: PlayerProfile) {
    if (starting.current || !mode) return
    starting.current = true
    const resume = mode === 'load'
    selectPlayer(profile)
    prepareCreditsMusic()
    useAudioStore.getState().play('buttonClick')
    api.start({ to: { mainTitle: 0 }, config: { duration: 450 }, onRest: () => {
      const overlay = useOverlayStore.getState()
      systemInfoStore.getState().updateSystemInfo({ mainOverlayShowed: true })
      if (resume) { startCreditsMusic(); startShooting() }
      overlay.setShowOverlay('resumeBattle', resume)
      overlay.setShowOverlay('mainTitleOverlay', false)
      overlay.setShowOverlay('titleScreenOverlay', true)
    } })
  }

  return (
    <AnimatedDiv className="absolute inset-0 overflow-hidden pointer-events-auto" style={{ opacity: styles.mainTitle }}>
      <NierCoverScene />
      <h1 className={cover.title} aria-label="NieR:Automata">
        <span className={cover.ink} aria-hidden="true" />
        <span className={cover.gear} aria-hidden="true" />
      </h1>
      <nav ref={menu} className={cover.menu} aria-label={t('mainMenu')}>
        {(['new', 'load'] as const).map(item =>
          <button key={item} type="button" data-mode={item} data-selected={selected === item}
            onFocus={() => setSelected(item)} onPointerMove={() => setSelected(item)} onClick={() => open(item)}>
            {t(item)}
          </button>)}
      </nav>
      {mode && <SaveMenu mode={mode} onLaunch={launch} onBack={() => {
        if (starting.current) return
        setMode(null)
        requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>(`[data-mode="${selected}"]`)?.focus())
      }} />}
    </AnimatedDiv>
  )
}
