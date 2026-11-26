import { removeDonatedProfile, runScore } from '@/features/saves/profileSaves'
import type { EndingSave } from '@/features/saves/saveTypes'
import DialoguePage from '@/shared/ui/DialoguePage'
import GameDialog from '@/shared/ui/GameDialog'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import styles from './FinaleSaveOverlay.module.css'

interface TransferProps {
  run: EndingSave
  onComplete: () => void
  onKeep: () => void
}

export default function SaveTransfer({ run, onComplete, onKeep }: TransferProps) {
  const t = useTranslations()
  const [transfer, setTransfer] = useState<'sending' | 'confirmed' | 'failed'>('sending')
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function upload() {
      try {
        const res = await fetch('/api/donateSave', {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run)
        })
        if (!res.ok || (await res.json()).uploaded !== true) throw new Error('Upload incomplete')
        if (!controller.signal.aborted) {
          if (run.profileId) removeDonatedProfile(run.profileId)
          setTransfer('confirmed')
        }
      } catch {
        if (!controller.signal.aborted) setTransfer('failed')
      }
    }
    void upload()
    return () => controller.abort()
  }, [attempt, run])

  useEffect(() => {
    if (transfer !== 'confirmed') return
    const timer = window.setTimeout(() => {
      if (page === 3) onComplete()
      else setPage(page + 1)
    }, page === 3 ? 3600 : 2600)
    return () => window.clearTimeout(timer)
  }, [transfer, page, onComplete])

  const sections = ['records', 'battle', 'messages', 'slots']
  const rows = [
    [[t('score'), runScore(run)], [t('time'), Math.floor(run.playerTime / 60) + ':' + String(Math.floor(run.playerTime % 60)).padStart(2, '0')], [t('reTryCount'), run.retryCount]],
    [[t('shootCount'), run.shootCount], [t('shootHitCount'), run.shootHitCount], [t('onHitCount'), run.onHitCount]],
    [[t('message'), run.content || '—'], [t('region'), run.region || '—']],
    [[run.name, 'Ending E'], [t('finale.empty'), ''], [t('finale.empty'), '']],
  ]
  const label = t(transfer === 'failed' ? 'finale.failed' : transfer === 'confirmed' ? 'finale.saved' : 'finale.sending')
  return (
    <GameDialog className={styles.finale} data-finale="upload" aria-label={label}>
      {transfer !== 'failed' && (
        <div className={styles.archive} key={page} data-confirmed={transfer === 'confirmed'}>
          <div className={styles.tabs}>{sections.map((s, i) => <span key={s} data-active={page === i}>{t('finale.' + s)}</span>)}</div>
          <h2>{page === 3 ? 'LOAD GAME' : t('finale.' + sections[page])}</h2>
          <div className={styles.entries}>{rows[page].map(([label, value], i) => <div key={i} style={{ animationDelay: (850 + i * 400) + 'ms' }}><span>{label}</span><span>{value}</span></div>)}</div>
          <div className={styles.transferStatus} role="status">{t(transfer === 'sending' ? 'finale.sending' : 'finale.saved')}</div>
        </div>
      )}
      {transfer === 'failed' && <DialoguePage line={t('finale.failed')} duration={400}
        choices={[t('finale.retry'), t('finale.keep')]} onConfirm={index => {
          if (index === 1) onKeep()
          else { setTransfer('sending'); setAttempt(value => value + 1) }
        }} />}
    </GameDialog>
  )
}
