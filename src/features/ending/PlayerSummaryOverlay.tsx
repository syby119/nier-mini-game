import { stopCreditsMusic } from '@/features/audio/CreditsMusic'
import usePlayerStore from '@/features/combat/player/PlayerStore'
import { runScore } from '@/features/saves/profileSaves'
import { useOverlayStore } from '@/game/state/OverlayStore'
import { NieRCustomBox } from '@/shared/ui/NieRCustomBox'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

export default function PlayerSummaryOverlay() {
  const t = useTranslations()
  const run = usePlayerStore(state => state.playerShareInfo)
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const [status, setStatus] = useState<'idle' | 'saving' | 'closing' | 'failed'>('idle')
  const busy = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    stopCreditsMusic()
    return () => window.clearTimeout(timer.current)
  }, [])

  async function save() {
    if (busy.current) return
    busy.current = true
    setStatus('saving')
    try {
      const response = await fetch('/api/saveResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: run.profileId, name: run.name, score: runScore(run) })
      })
      if (!response.ok) throw new Error(String(response.status))
      setStatus('closing')
      timer.current = window.setTimeout(() => {
        setOverlay('playerSummaryOverlay', false)
        setOverlay('onlineResultOverlay', true)
      }, 1500)
    } catch {
      busy.current = false
      setStatus('failed')
    }
  }

  const minutes = String(Math.floor(run.playerTime / 60)).padStart(2, '0')
  const seconds = String(Math.floor(run.playerTime % 60)).padStart(2, '0')
  const stats = [
    [t('score'), runScore(run)], [t('time'), minutes + ':' + seconds],
    [t('saves.defeated'), run.enemiesDefeated],
    [t('shootCount'), run.shootCount], [t('shootHitCount'), run.shootHitCount],
    [t('onHitCount'), run.onHitCount], [t('reTryCount'), run.retryCount],
  ]
  return (
    <NieRCustomBox disableGamePad buttonDisabled={status === 'saving' || status === 'closing'}
      startCloseAnimation={status === 'closing'} buttonsConfigs={[{ text: t('finish'), onClick: save, isNeedAnimationFinish: false }]}>
      <div className="text-2xl text-[#DAD4BB] bg-[#4E4B42] px-4 py-2">{t('notice')}</div>
      <div className="p-4 flex flex-col gap-4 text-[#4E4B42] max-h-full overflow-y-auto custom-scrollbar">
        <p className="text-xl">{t('congratulations')}!<br />{t('youCompleteThisGame')}!</p>
        <p className="font-semibold">{run.name}</p>
        <dl>{stats.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {status === 'failed' && <p role="alert">{t('finale.saveError')}</p>}
      </div>
    </NieRCustomBox>
  )
}
