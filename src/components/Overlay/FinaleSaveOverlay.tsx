import { keepEndingSave, pendingDonation, rememberDonation } from '../../lib/endingSave'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { finaleClips, finaleQuestions } from '../../data/FinaleDialogue'
import useAudioStore from '../../store/AudioStore'
import { useOverlayStore } from '../../store/OverlayStore'
import usePlayerStore from '../../store/PlayerStore'
import systemInfoStore from '../../store/SystemInfoStore'
import DeathDialogue from './DeathDialogue'
import dialogueStyles from './ContinueOverlay.module.css'
import styles from './FinaleSaveOverlay.module.css'

type Screen = 'dialogue' | 'upload' | 'saving'

export default function FinaleSaveOverlay({ message = false }: { message?: boolean }) {
  const t = useTranslations()
  const [pending] = useState(pendingDonation)
  const [run] = useState(() => pending || usePlayerStore.getState().playerShareInfo)
  const [screen, setScreen] = useState<Screen>(pending ? 'upload' : 'dialogue')
  const [line, setLine] = useState(message ? 41 : 46)
  const [transfer, setTransfer] = useState<'sending' | 'confirmed' | 'failed'>('sending')
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const overlay = message ? 'requestPlayerInfoOverlay' : 'requestPlayerInfoPhase3Overlay'
  const question = finaleQuestions.has(line)
  const text = t('finale.' + line, { name: run.name })
  const clip = finaleClips[line - 41]
  const speaker = clip.includes('and_pod153') ? 'Pod 042 / Pod 153' : clip.includes('pod153') ? 'Pod 153' : 'Pod 042'

  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  const finish = useCallback(() => {
    rememberDonation(null)
    usePlayerStore.getState().resetPlayerShareInfo()
    usePlayerStore.getState().resetPlayerInfo()
    systemInfoStore.getState().setGameStarted(false)
    setOverlay(overlay, false)
    setOverlay('mainTitleOverlay', true)
  }, [setOverlay, overlay])

  const advance = useCallback(() => {
    if (line === 69) {
      keepEndingSave(run)
      rememberDonation(run)
      setScreen('upload')
    } else if (line === 79) setScreen('saving')
    else setLine(current => current === line ? current + 1 : current)
  }, [line, run])

  useEffect(() => {
    if (screen !== 'dialogue') return
    const audio = new Audio('/nier/sound/dialogue/' + clip)
    audio.volume = useAudioStore.getState().initVolume
    let timer: number
    let active = true
    function next(delay: number) {
      if (active && !question) {
        window.clearTimeout(timer)
        timer = window.setTimeout(advance, delay)
      }
    }
    audio.onended = () => next(420)
    audio.onerror = () => next(Math.max(1400, Array.from(text).length * 90))
    audio.play().catch(() => next(Math.max(1400, Array.from(text).length * 90)))
    return () => {
      active = false
      window.clearTimeout(timer)
      audio.onended = null
      audio.onerror = null
      audio.pause()
    }
  }, [clip, screen, question, advance, text])

  useEffect(() => {
    if (screen !== 'upload') return
    const controller = new AbortController()
    async function upload() {
      try {
        const res = await fetch('/api/donateSave', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) })
        if (!res.ok || (await res.json()).uploaded !== true) throw new Error('Upload incomplete')
        if (!controller.signal.aborted) {
          keepEndingSave(null)
          setTransfer('confirmed')
        }
      } catch {
        if (!controller.signal.aborted) setTransfer('failed')
      }
    }
    void upload()
    return () => controller.abort()
  }, [screen, attempt, run])

  useEffect(() => {
    if (screen !== 'upload' || transfer !== 'confirmed') return
    const timer = window.setTimeout(() => {
      if (page === 3) {
        setLine(70)
        setScreen('dialogue')
      } else setPage(page + 1)
    }, page === 3 ? 3600 : 2600)
    return () => window.clearTimeout(timer)
  }, [screen, transfer, page])

  useEffect(() => {
    if (screen !== 'saving') return
    const timer = window.setTimeout(finish, 2800)
    return () => window.clearTimeout(timer)
  }, [screen, finish])

  function answer(index: number) {
    if (question && line === 45 && index === 0) {
      setOverlay(overlay, false)
      setOverlay('requestPlayerInfoPhase2Overlay', true)
    } else if (question && line !== 45 && index === 1) finish()
    else advance()
  }

  const sections = ['records', 'battle', 'messages', 'slots']
  const rows = [
    [[t('score'), run.points], [t('time'), Math.floor(run.playerTime / 60) + ':' + String(Math.floor(run.playerTime % 60)).padStart(2, '0')], [t('reTryCount'), run.retryCount]],
    [[t('shootCount'), run.shootCount], [t('shootHitCount'), run.shootHitCount], [t('onHitCount'), run.onHitCount]],
    [[t('message'), run.content || '—'], [t('region'), run.region || '—']],
    [[run.name, 'Ending E'], [t('finale.empty'), ''], [t('finale.empty'), '']],
  ]
  const light = screen === 'saving' || (screen === 'dialogue' && line >= 70)
  const transferLabel = transfer === 'failed' ? t('finale.failed') :
    transfer === 'confirmed' ? t('finale.saved') : t('finale.sending')
  return (
    <dialog ref={dialog} className={dialogueStyles.scene + ' ' + styles.finale} data-light={light}
      data-finale={screen} aria-label={screen === 'dialogue' ? text : transferLabel}
      onCancel={event => event.preventDefault()}>
      {screen === 'dialogue' && <>
        <div className={styles.speaker}>{speaker}</div>
        <DeathDialogue key={line} line={text} duration={Math.min(1650, Array.from(text).length * 51)}
          firstIsYes notice={!question} onConfirm={answer} labels={line === 45 ? [t('iHaveSomethingIWantToSay'), t('nopeNothingAtAll')] : undefined} />
      </>}
      {screen === 'upload' && transfer !== 'failed' && (
        <div className={styles.archive} key={page} data-confirmed={transfer === 'confirmed'}>
          <div className={styles.tabs}>{sections.map((s, i) => <span key={s} data-active={page === i}>{t('finale.' + s)}</span>)}</div>
          <h2>{page === 3 ? 'LOAD GAME' : t('finale.' + sections[page])}</h2>
          <div className={styles.entries}>{rows[page].map(([label, value], i) => <div key={i} style={{ animationDelay: (850 + i * 400) + 'ms' }}><span>{label}</span><span>{value}</span></div>)}</div>
          <div className={styles.transferStatus} role="status">{t(transfer === 'sending' ? 'finale.sending' : 'finale.saved')}</div>
        </div>
      )}
      {screen === 'upload' && transfer === 'failed' && <DeathDialogue line={t('finale.failed')} duration={400}
        notice={false} firstIsYes labels={[t('finale.retry'), t('finale.keep')]} onConfirm={index => {
          if (index === 1) finish()
          else { setTransfer('sending'); setAttempt(value => value + 1) }
        }} />}
      {screen === 'saving' && <div className={styles.saving} role="status" aria-label={t('finale.saved')}>SAVING<span aria-hidden="true">◇</span></div>}
    </dialog>
  )
}
