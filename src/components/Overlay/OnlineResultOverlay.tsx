import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PixelArtUser } from '../PixelArtUser'
import { useNetworkStore } from '../../store/NetworkStore'
import { useOverlayStore } from '../../store/OverlayStore'
import usePlayerStore from '../../store/PlayerStore'
import { NieRCustomBox } from './NieRCustomBox'

export default function OnlineResultOverlay() {
  const t = useTranslations()
  const run = usePlayerStore(state => state.playerShareInfo)
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const [online, setOnline] = useState(() => useNetworkStore.getState().onlineData)
  const [closing, setClosing] = useState(false)
  const me = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/getOnlineResult', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return
        const { data } = await response.json()
        if (Array.isArray(data) && !controller.signal.aborted) setOnline(data)
      }).catch(() => {})
    return () => controller.abort()
  }, [])

  const rows = useMemo(() => [
    ...online.map(({ name, score }) => ({ name, score, own: false })),
    { name: run.name, score: run.points, own: true },
  ].sort((a, b) => b.score - a.score), [online, run.name, run.points])

  useEffect(() => { me.current?.scrollIntoView({ block: 'nearest' }) }, [rows])
  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => {
      setOverlay('onlineResultOverlay', false)
      setOverlay('requestPlayerInfoOverlay', true)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [closing, setOverlay])

  return (
    <NieRCustomBox startCloseAnimation={closing} buttonDisabled={closing}
      buttonsConfigs={[{ text: t('finish'), onClick: () => setClosing(true), isNeedAnimationFinish: false }]}>
      <div className="text-2xl text-[#DAD4BB] bg-[#4E4B42] px-4 py-2">{t('score')}</div>
      <div className="py-1 px-2 flex flex-col gap-1 max-h-80 overflow-y-auto custom-scrollbar">
        {rows.map(({ name, score, own }, index) =>
          <div key={index} ref={own ? me : undefined} className={'p-2 flex justify-between gap-4 ' + (own ? 'bg-[#4E4B42] text-[#DAD4BB]' : 'text-[#4E4B42]')}>
            <div className="flex items-center gap-2">{index + 1}<PixelArtUser textColor={own ? '#DAD4BB' : '#4E4B42'} /><span className="text-xl truncate">{name}</span></div>
            <span>{score}</span>
          </div>)}
      </div>
    </NieRCustomBox>
  )
}
