import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useMenuGamepad } from '../../hook/useMenuGamepad'
import { createProfile, formatPlayTime, hasUnsavedRuns, loadProfiles, profileExists, profileTotals, type PlayerProfile, type ProfileHistory } from '../../lib/profileSaves'
import GameDialog from './GameDialog'
import styles from './SaveMenu.module.css'

type Props = { mode: 'new' | 'load', onBack: () => void, onLaunch: (profile: PlayerProfile) => void }

const dateFormat = new Intl.DateTimeFormat('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' })

export default function SaveMenu({ mode, onBack, onLaunch }: Props) {
  const t = useTranslations('saves')
  const [profiles, setProfiles] = useState<ProfileHistory[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(false)
  const [launching, setLaunching] = useState(false)
  const locked = useRef(false)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const focusedList = useRef(false)
  const selected = profiles.find(p => p.id === selectedId) || profiles[0]
  const totals = selected && profileTotals(selected.runs)

  const refresh = useCallback(() => {
    try { setProfiles(loadProfiles()); setError(hasUnsavedRuns()) }
    catch { setError(true) }
  }, [])
  useEffect(() => {
    if (mode === 'new') { input.current?.focus(); return }
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [mode, refresh])

  useEffect(() => {
    if (mode === 'load' && profiles.length && !focusedList.current) {
      focusedList.current = true
      list.current?.querySelector('button')?.focus()
    }
  }, [mode, profiles.length])

  function confirm() {
    if (locked.current || (mode === 'new' ? !name.trim() : !selected)) return
    try {
      if (mode === 'load' && !profileExists(selected.id)) { refresh(); return }
      const profile = mode === 'new' ? createProfile(name) : selected
      locked.current = true
      setLaunching(true)
      onLaunch(profile)
    } catch { locked.current = false; setLaunching(false); setError(true) }
  }
  function move(step: number) {
    if (!selected || launching) return
    const index = profiles.indexOf(selected)
    const next = (index + step + profiles.length) % profiles.length
    setSelectedId(profiles[next].id)
    list.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }
  function keydown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Escape') {
      event.preventDefault()
      if (!locked.current) onBack()
    } else if (mode === 'new' && event.key === 'Enter' && event.target === input.current) {
      event.preventDefault()
      if (!event.repeat) confirm()
    } else if (mode === 'load' && ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(event.code)) {
      if ((event.target as HTMLElement).closest('[data-history]')) return
      event.preventDefault()
      move(event.code === 'ArrowUp' || event.code === 'KeyW' ? -1 : 1)
    } else if (mode === 'load' && event.key === 'Enter' &&
      !(event.target as HTMLElement).closest('footer')) {
      event.preventDefault()
      if (!event.repeat) confirm()
    }
  }
  useMenuGamepad(!launching, command => {
    if (!document.activeElement?.closest('dialog[data-save-menu]')) return
    if (command === 'back') onBack()
    if (command === 'confirm') confirm()
    if (mode === 'load' && (command === 'up' || command === 'down')) move(command === 'up' ? -1 : 1)
  })

  const rows = Math.max(3, profiles.length)
  return (
    <GameDialog className={styles.screen} data-save-menu={mode} data-launching={launching}
      aria-labelledby="save-screen-title" onKeyDown={keydown}>
      <div className={styles.ornaments} aria-hidden="true" />
      <header><h2 id="save-screen-title">{t(mode === 'new' ? 'enterName' : 'selectSave')}</h2></header>
      {mode === 'new' ? (
        <form id="profile-name-form" className={styles.nameForm} onSubmit={event => { event.preventDefault(); confirm() }}>
          <label htmlFor="profile-name">{t('playerName')}</label>
          <div className={styles.nameLine}>
            <span className={styles.cursor} aria-hidden="true" />
            <input ref={input} id="profile-name" autoComplete="off" autoFocus maxLength={16}
              value={name} onChange={event => setName(event.target.value)} disabled={launching} />
            <span className={styles.counter}>{name.length} / 16</span>
          </div>
        </form>
      ) : (
        <div className={styles.archive}>
          <div className={styles.slots} ref={list} aria-label={t('selectSave')}>
            {Array.from({ length: rows }, (_, index) => {
              const profile = profiles[index]
              const number = String(index + 1).padStart(2, '0')
              if (!profile) return <div key={'empty-' + number} className={styles.slot} data-empty="true">
                <span className={styles.thumb} />
                <div className={styles.slotBody}>
                  <div className={styles.slotBar}><span>{t('empty')}</span><small>— / — / —</small></div>
                  <div className={styles.meta}>{t('slot', { number })}</div>
                </div>
              </div>
              const last = profile.runs[0]
              const date = last?.updatedAt || profile.createdAt
              return <button type="button" key={profile.id} className={styles.slot}
                aria-pressed={selected?.id === profile.id} disabled={launching}
                onFocus={() => setSelectedId(profile.id)} onClick={() => setSelectedId(profile.id)}
                onDoubleClick={confirm}>
                <span className={styles.thumb} />
                <span className={styles.slotBody}>
                  <span className={styles.slotBar}><strong>{profile.name}</strong><small>{date ? dateFormat.format(date) : '—'}</small></span>
                  <span className={styles.meta}><span>{t('slot', { number })}</span>
                    <span>{t('playTime')}　{formatPlayTime(profileTotals(profile.runs).time)}</span></span>
                </span>
              </button>
            })}
          </div>
          {selected && totals && <section className={styles.details} aria-label={t('record')}>
            <h3>{t('record')}</h3>
            <dl className={styles.stats}>
              {([['played', selected.runs.length], ['clears', totals.cleared], ['best', totals.best], ['kills', totals.kills]] as const)
                .map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>
                  {key === 'kills' && totals.missingKills
                    ? (value ? '≥ ' + value.toLocaleString('zh-HK') : '—') : value.toLocaleString('zh-HK')}
                </dd></div>)}
            </dl>
            <h4>{t('history')}</h4>
            {selected.runs.length ? <div className={styles.history} data-history tabIndex={0}>
              <table><thead><tr><th>{t('round')}</th><th>{t('outcome')}</th><th>{t('score')}</th><th>{t('defeated')}</th><th>{t('duration')}</th></tr></thead>
                <tbody>{selected.runs.map((run, i) => <tr key={selected.runs.length - i}>
                  <td>{String(selected.runs.length - i).padStart(2, '0')}</td><td>{t(run.outcome)}</td>
                  <td>{run.score.toLocaleString('zh-HK')}</td><td>{run.enemiesDefeated?.toLocaleString('zh-HK') ?? '—'}</td>
                  <td>{formatPlayTime(run.playerTime).replace(/^00:/, '')}</td>
                </tr>)}</tbody></table>
            </div> : <p className={styles.noHistory}>{t('noHistory')}</p>}
          </section>}
        </div>
      )}
      <footer className={styles.footer}>
        <p role={error ? 'alert' : undefined}>{error ? t('error') : mode === 'new' ? t('nameHint') : t(selected ? 'loadHint' : 'noSaves')}</p>
        <div className={styles.actions}>
          {mode === 'new'
            ? <button type="submit" form="profile-name-form" disabled={!name.trim() || launching}><kbd>Enter</kbd>{t('create')}</button>
            : <button type="button" onClick={confirm} disabled={!selected || launching}><kbd>Enter</kbd>{t('startBattle')}</button>}
          <button type="button" onClick={onBack} disabled={launching}><kbd>Esc</kbd>{t('back')}</button>
        </div>
      </footer>
    </GameDialog>
  )
}
