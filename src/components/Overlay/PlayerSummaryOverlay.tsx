import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { keepEndingSave } from '../../lib/endingSave'
import { stopCreditsMusic } from '../../store/CreditsMusic'
import { useOverlayStore } from '../../store/OverlayStore'
import usePlayerStore from '../../store/PlayerStore'
import { NieRCustomBox } from './NieRCustomBox'

export default function PlayerSummaryOverlay() {
  const t = useTranslations()
  const run = usePlayerStore(state => state.playerShareInfo)
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'closing' | 'failed'>('idle')
  const busy = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    stopCreditsMusic()
    return () => window.clearTimeout(timer.current)
  }, [])

  async function save() {
    if (busy.current || !name.trim()) return
    busy.current = true
    setStatus('saving')
    try {
      const response = await fetch('/api/saveResult', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), score: run.points }) })
      if (!response.ok) throw new Error(String(response.status))
      usePlayerStore.getState().setPlayerShareInfo({ name: name.trim() })
      keepEndingSave(usePlayerStore.getState().playerShareInfo)
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
    [t('score'), run.points - run.onHitCount - run.retryCount], [t('time'), minutes + ':' + seconds],
    [t('shootCount'), run.shootCount], [t('shootHitCount'), run.shootHitCount],
    [t('onHitCount'), run.onHitCount], [t('reTryCount'), run.retryCount],
  ]
  return (
    <NieRCustomBox disableGamePad buttonDisabled={status === 'saving' || status === 'closing'}
      startCloseAnimation={status === 'closing'} buttonsConfigs={[{ text: t('finish'), onClick: save, isNeedAnimationFinish: false }]}>
      <div className="text-2xl text-[#DAD4BB] bg-[#4E4B42] px-4 py-2">{t('notice')}</div>
      <div className="p-4 flex flex-col gap-4 text-[#4E4B42] max-h-full overflow-y-auto custom-scrollbar">
        <p className="text-xl">{t('congratulations')}!<br />{t('youCompleteThisGame')}!</p>
        <dl>{stats.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <form onSubmit={event => { event.preventDefault(); void save() }}>
          <label className="block font-semibold">{t('enterYourNameToSave')}
            <input className="block w-full bg-[#eeeada] p-2 mt-2" maxLength={15} value={name}
              disabled={busy.current} onChange={event => setName(event.target.value)} placeholder="Player" />
          </label>
          {status === 'failed' && <p role="alert">{t('finale.saveError')}</p>}
        </form>
      </div>
    </NieRCustomBox>
  )
}
