import { startCreditsMusic, stopCreditsMusic } from '@/features/audio/CreditsMusic'
import { playPodVoice } from '@/features/audio/PodVoice'
import usePlayerStore from '@/features/combat/player/PlayerStore'
import { startShooting } from '@/game/battleSession'
import { useOverlayStore } from '@/game/state/OverlayStore'
import DialoguePage from '@/shared/ui/DialoguePage'
import GameDialog from '@/shared/ui/GameDialog'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import OpeningCredits from './OpeningCredits'
import styles from './OpeningCredits.module.css'
import { openingVoices } from './OpeningDialogue'

type Scene = 'credits' | 'ending' | 'declined' | 'battle'
type Cue = 'lead' | 'silence' | 'request' | 'contact' | number

// Pod 153's first seven transmissions follow the scrolling staff roll.
const reportDurations = [4900, 4050, 2970, 2500, 3050, 2240, 3700]
const skipCards = process.env.NODE_ENV === 'development' && process.env.SKIP_TITLE_ANIMATION === 'true'

function EndingCard({ ending }: { ending: 'C' | 'E' }) {
  return <div className={styles.card} data-ending={ending}>
    <h1>NieR:Automata</h1>
    <p>{ending === 'C' ? 'meaningless [C]ode' : 'the [E]nd of YoRHa'}</p>
  </div>
}

export default function OpeningSequence({ fromSave = false }: { fromSave?: boolean }) {
  const t = useTranslations()
  const [scene, setScene] = useState<Scene>(fromSave ? 'battle' : skipCards ? 'ending' : 'credits')
  const [cue, setCue] = useState<Cue>('lead')
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const inDeathDialogue = useOverlayStore(state => state.isShowOverlay.continueOverlay)
  const frozen = cue === 'contact' || (typeof cue === 'number' && cue >= 8)
  const noise = cue === 'request' || frozen || (typeof cue === 'number' && cue >= 6)
  const rollMusic = scene === 'credits' && !frozen
  const voice = typeof cue === 'number' ? openingVoices[cue - 1] : undefined
  const question = cue === 'request' || cue === 31

  const advance = useCallback(() => {
    setCue(current => {
      if (current !== cue) return current
      if (current === 4) return 'silence'
      if (current === 7) return 'request'
      if (typeof current === 'number' && current < 31) return current + 1
      return current
    })
  }, [cue])

  useEffect(() => {
    if (!rollMusic) return
    // The footage opens in the vocal verse, then cuts the music for the data check.
    startCreditsMusic(128.3)
    return stopCreditsMusic
  }, [rollMusic])

  useEffect(() => {
    if (scene !== 'credits') return
    let timer: number
    if (cue === 'lead') timer = window.setTimeout(() => setCue(1), 38250)
    if (cue === 'silence') timer = window.setTimeout(() => setCue(5), 5650)
    if (cue === 'contact') timer = window.setTimeout(() => setCue(8), 1080)
    return () => window.clearTimeout(timer)
  }, [cue, scene])

  useEffect(() => {
    if (!voice || typeof cue !== 'number' || (scene !== 'credits' && scene !== 'battle')) return
    let timer: number
    const next = cue === 32 ? () => setOverlay('titleScreenOverlay', false) : advance
    function schedule(delay: number) {
      if (question) return
      window.clearTimeout(timer)
      timer = window.setTimeout(next, delay)
    }
    const timedReport = cue <= 7
    schedule(timedReport ? reportDurations[cue - 1] : voice.duration + 1600)
    const stopVoice = playPodVoice(voice.src, timedReport ? {} : {
      onPlaying: () => schedule(voice.duration + 600),
      onEnded: () => schedule(220),
    })
    return () => {
      window.clearTimeout(timer)
      stopVoice()
    }
  }, [cue, scene, voice, question, advance, setOverlay])

  useEffect(() => {
    if (scene === 'declined') {
      const timer = window.setTimeout(() => {
        setOverlay('titleScreenOverlay', false)
        setOverlay('mainTitleOverlay', true)
      }, 1200)
      return () => window.clearTimeout(timer)
    }
    if (scene !== 'ending') return
    const music = window.setTimeout(() => startCreditsMusic(), skipCards ? 0 : 3650)
    const launch = window.setTimeout(() => {
      startShooting()
      setCue('lead')
      setScene('battle')
    }, skipCards ? 0 : 17100)
    return () => {
      window.clearTimeout(music)
      window.clearTimeout(launch)
    }
  }, [scene, setOverlay])

  useEffect(() => {
    if (scene !== 'battle') return
    if (inDeathDialogue) {
      setOverlay('titleScreenOverlay', false)
      return
    }
    const reset = window.setTimeout(usePlayerStore.getState().respawnPlayer, 200)
    const radio = window.setTimeout(() => setCue(32), 4050)
    return () => { window.clearTimeout(reset); window.clearTimeout(radio) }
  }, [scene, inDeathDialogue, setOverlay])

  function answer(index: number) {
    if (!question) advance()
    else if (index === 1) setScene('declined')
    else if (cue === 'request') setCue('contact')
    else setScene('ending')
  }

  if (scene === 'battle') {
    return cue === 32 && <p className={styles.radio} role="status">{t('opening.32')}</p>
  }
  const line = cue === 'request' || typeof cue === 'number' ? t('opening.' + cue) : ''
  return (
    <GameDialog className={styles.opening} data-opening={scene} aria-label={line || 'NieR:Automata'}>
      <OpeningCredits frozen={frozen} noise={noise} />
      {scene === 'credits' && cue === 'lead' && <EndingCard ending="C" />}
      {scene === 'ending' && <EndingCard ending="E" />}
      {scene === 'credits' && line &&
        <DialoguePage key={cue} line={line} speaker={voice?.speaker} duration={Math.min(1050, Array.from(line).length * 39)}
          allowEarlyAdvance choices={question ? [t('yes'), t('no')] : undefined} onConfirm={answer} />}
    </GameDialog>
  )
}
