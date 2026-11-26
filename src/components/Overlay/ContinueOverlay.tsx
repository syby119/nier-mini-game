import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import PubSub from 'pubsub-js'
import { joinCreditsChoir, prepareRescueRefrain, stopCreditsMusic } from '../../store/CreditsMusic'
import { getRescuePilots, useNetworkStore } from '../../store/NetworkStore'
import { useOverlayStore } from '../../store/OverlayStore'
import usePlayerStore from '../../store/PlayerStore'
import systemInfoStore from '../../store/SystemInfoStore'
import DialoguePage from './DialoguePage'
import GameDialog from './GameDialog'
import DeathMessages from './DeathMessages'
import styles from './GameDialogue.module.css'

const questions = [
  { key: 'giveUpMsg1', duration: 400 },
  { key: 'giveUpMsg2', duration: 650 },
  { key: 'giveUpMsg3', duration: 600 },
  { key: 'giveUpMsg4', duration: 1350 },
  { key: 'giveUpMsg5', duration: 1450 },
] as const

type Stage = 'burst' | 'received' | 'question' | 'offer' | 'accept' | 'leaving' | 'returning'
type Outcome = 'retry' | 'rescue' | 'giveUp'

export default function ContinueOverlay() {
  const t = useTranslations()
  const [deathCount] = useState(() => Math.max(1, usePlayerStore.getState().playerShareInfo.deathCount))
  const [stage, setStage] = useState<Stage>('burst')
  const [showMessages, setShowMessages] = useState(true)
  const [rescuer, setRescuer] = useState('')
  const pilots = useRef<string[]>([])
  const outcome = useRef<Outcome>('retry')
  const setShowOverlay = useOverlayStore(state => state.setShowOverlay)
  const question = questions[(deathCount - 1) % questions.length]
  const isDialogue = stage === 'question' || stage === 'offer' || stage === 'accept'
  const hasMessages = deathCount >= 2 && stage !== 'burst' && stage !== 'received'

  useEffect(() => {
    const network = useNetworkStore.getState()
    if (!network.isConnectedToNetwork) void network.fetchOnlineData()
  }, [])

  useEffect(() => {
    let timer: number
    if (stage === 'burst') {
      timer = window.setTimeout(() => {
        systemInfoStore.getState().resetSystemInfo()
        setStage(deathCount === 2 ? 'received' : 'question')
      }, 650)
    } else if (stage === 'received') {
      timer = window.setTimeout(() => setStage('question'), 3000)
    } else if (stage === 'leaving') {
      timer = window.setTimeout(() => {
        const player = usePlayerStore.getState()
        const system = systemInfoStore.getState()
        if (outcome.current === 'giveUp') {
          stopCreditsMusic()
          player.resetPlayerInfo()
          player.resetPlayerShareInfo()
          system.setGameStarted(false)
          system.setImportantPhaseRecord('')
          setShowOverlay('mainTitleOverlay', true)
        } else {
          const hasHelp = outcome.current === 'rescue'
          player.updatePlayerInfo({ needOtherPlayerHelp: hasHelp, rescuePilots: hasHelp ? pilots.current : undefined })
          player.respawnPlayer()
          system.setCurrentPhase(system.importantPhaseRecord || '0')
          PubSub.publish('updateSceneEffectCount', hasHelp ? 100 : 30)
        }
        setStage('returning')
      }, 1900)
    } else if (stage === 'returning') {
      timer = window.setTimeout(() => setShowOverlay('continueOverlay', false), 500)
    }
    return () => window.clearTimeout(timer)
  }, [stage, deathCount, setShowOverlay])

  function answer(index: number) {
    if (stage === 'offer') {
      setStage('accept')
      return
    }
    if (stage === 'question' && index === 0) {
      const player = usePlayerStore.getState()
      player.setPlayerShareInfo({ retryCount: player.playerShareInfo.retryCount + 1 })
      // By the rescue prompt the recording is already on the refrain, with its lead vocal alone.
      if (deathCount >= questions.length - 1) prepareRescueRefrain()
      if (deathCount > questions.length && !player.playerInfo.needOtherPlayerHelp) {
        pilots.current = getRescuePilots()
        setRescuer(useNetworkStore.getState().notEnablePlayerNameList[0] || 'Honoka(honoka_rey)')
        setStage('offer')
        return
      }
    }
    if (stage === 'question' && index === 1) outcome.current = 'giveUp'
    if (stage === 'accept' && index === 0) outcome.current = 'rescue'
    setStage('leaving')
  }

  const offer = t('rescueOfferReceived', { name: rescuer })
  const line = stage === 'offer' ? offer : stage === 'accept' ? t('acceptOffer?') : t(question.key)
  const duration = stage === 'offer' ? (28 + Array.from(rescuer).length) * 32
    : stage === 'accept' ? 400 : question.duration

  return (
    <GameDialog data-stage={stage} aria-label={isDialogue ? line : t('notice')}>
      {hasMessages && <DeathMessages deathCount={deathCount} visible={showMessages} />}
      {stage === 'received' && (
        <div className={styles.received} role="status">
          <div className={styles.ornament} />
          <span>{t('messageReceived')}</span>
        </div>
      )}
      {hasMessages && stage !== 'returning' && <div className={styles.header}>
        <button type="button" className={styles.display} aria-pressed={showMessages}
          disabled={!isDialogue} onClick={() => setShowMessages(value => !value)} aria-keyshortcuts="Y">
          <span className={styles.triangle} aria-hidden="true">△</span>{t('changeDisplay')}
        </button>
      </div>}
      {isDialogue &&
        <DialoguePage key={stage} line={line} duration={duration} onConfirm={answer}
          onConfirmStart={stage === 'accept' ? index => { if (index === 0) joinCreditsChoir() } : undefined}
          choices={stage === 'offer' ? undefined : stage === 'accept' ? [t('yes'), t('no')] : [t('no'), t('yes')]}
          onChangeDisplay={hasMessages ? () => setShowMessages(value => !value) : undefined} />
      }
    </GameDialog>
  )
}
