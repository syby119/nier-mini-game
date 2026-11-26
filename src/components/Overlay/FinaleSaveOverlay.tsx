import { forgetDonation, pendingDonation, rememberDonation } from '../../lib/endingSave'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { finaleClips, finaleQuestions } from '../../data/FinaleDialogue'
import { useOverlayStore } from '../../store/OverlayStore'
import { playPodVoice } from '../../store/PodVoice'
import usePlayerStore from '../../store/PlayerStore'
import systemInfoStore from '../../store/SystemInfoStore'
import DialoguePage from './DialoguePage'
import GameDialog from './GameDialog'
import SaveTransfer from './SaveTransfer'
import styles from './FinaleSaveOverlay.module.css'

type Screen = 'dialogue' | 'upload' | 'saving'

export default function FinaleSaveOverlay({ message = false }: { message?: boolean }) {
  const t = useTranslations()
  const [pending] = useState(() => pendingDonation(usePlayerStore.getState().playerShareInfo.profileId))
  const [run] = useState(() => pending || usePlayerStore.getState().playerShareInfo)
  const [screen, setScreen] = useState<Screen>(pending ? 'upload' : 'dialogue')
  const [line, setLine] = useState(message ? 41 : 46)
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const overlay = message ? 'requestPlayerInfoOverlay' : 'requestPlayerInfoPhase3Overlay'
  const question = finaleQuestions.has(line)
  const text = t('finale.' + line, { name: run.name })
  const clip = finaleClips[line - 41]
  const speaker = clip.includes('and_pod153') ? 'Pod 042 / Pod 153' : clip.includes('pod153') ? 'Pod 153' : 'Pod 042'

  const finish = useCallback(() => {
    forgetDonation(run)
    usePlayerStore.getState().resetPlayerShareInfo()
    usePlayerStore.getState().resetPlayerInfo()
    systemInfoStore.getState().setGameStarted(false)
    setOverlay(overlay, false)
    setOverlay('mainTitleOverlay', true)
  }, [setOverlay, overlay, run])

  const advance = useCallback(() => {
    if (line === 69) {
      rememberDonation(run)
      setScreen('upload')
    } else if (line === 79) setScreen('saving')
    else setLine(current => current === line ? current + 1 : current)
  }, [line, run])

  useEffect(() => {
    if (screen !== 'dialogue') return
    let timer: number
    function next(delay: number) {
      if (!question) {
        window.clearTimeout(timer)
        timer = window.setTimeout(advance, delay)
      }
    }
    const stopVoice = playPodVoice('/nier/sound/dialogue/' + clip, {
      onEnded: () => next(420),
      onError: () => next(Math.max(1400, Array.from(text).length * 90)),
    })
    return () => {
      window.clearTimeout(timer)
      stopVoice()
    }
  }, [clip, screen, question, advance, text])

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

  const light = screen === 'saving' || (screen === 'dialogue' && line >= 70)
  const uploaded = useCallback(() => { setLine(70); setScreen('dialogue') }, [])
  if (screen === 'upload') return <SaveTransfer run={run} onComplete={uploaded} onKeep={finish} />

  return (
    <GameDialog className={styles.finale} data-light={light} data-finale={screen}
      aria-label={screen === 'dialogue' ? text : t('finale.saved')}>
      {screen === 'dialogue' &&
        <DialoguePage key={line} line={text} speaker={speaker} duration={Math.min(1650, Array.from(text).length * 51)}
          onConfirm={answer} choices={line === 45 ? [t('iHaveSomethingIWantToSay'), t('nopeNothingAtAll')] :
            question ? [t('yes'), t('no')] : undefined} />}
      {screen === 'saving' && <div className={styles.saving} role="status" aria-label={t('finale.saved')}>SAVING<span aria-hidden="true">◇</span></div>}
    </GameDialog>
  )
}
