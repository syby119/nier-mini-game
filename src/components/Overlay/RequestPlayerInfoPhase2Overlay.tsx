import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supportPhrases } from '../../data/SupportPhrases'
import { useMenuGamepad } from '../../hook/useMenuGamepad'
import useAudioStore from '../../store/AudioStore'
import usePlayerStore from '../../store/PlayerStore'
import GameDialog from './GameDialog'
import styles from './SupportMessageEditor.module.css'

const fields = ['openings', 'connections', 'endings', 'regions'] as const
const done = fields.length
const wrap = (value: number, length: number) => (value + length) % length

export default function RequestPlayerInfoPhase2Overlay({ onBack, onSent }: { onBack: () => void, onSent: () => void }) {
  const t = useTranslations()
  const player = usePlayerStore(state => state.playerShareInfo)
  const [values, setValues] = useState([0, 0, 0, 0])
  const [active, setActive] = useState(0)
  const [editing, setEditing] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const lastField = useRef(0)
  const controls = useRef<(HTMLButtonElement | null)[]>([])
  const list = useRef<HTMLDivElement>(null)
  const request = useRef<AbortController | null>(null)
  const options: readonly string[] = active < done ? supportPhrases[fields[active]] : []
  const segments = fields.map((field, i) => supportPhrases[field][values[i]])
  const playClick = () => useAudioStore.getState().play('buttonClick')

  useLayoutEffect(() => {
    if (editing) list.current?.focus({ preventScroll: true })
    else controls.current[active]?.focus({ preventScroll: true })
  }, [active, editing])
  useLayoutEffect(() => {
    if (editing) list.current?.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor, editing])
  useEffect(() => () => request.current?.abort(), [])

  function focusField(index: number) {
    setActive(index)
    if (index < done) lastField.current = index
  }
  function open(index: number) {
    if (request.current) return
    focusField(index)
    setCursor(values[index])
    setEditing(true)
    playClick()
  }
  function choose(index: number) {
    setValues(current => current.map((value, i) => i === active ? index : value))
    setEditing(false)
    setFailed(false)
    playClick()
  }
  async function send() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setFailed(false)
    setSaving(true)
    playClick()
    const message = { content: segments.slice(0, 3).join(''), region: segments[3] }
    try {
      const response = await fetch('/api/createShareInfo', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: player.profileId, ...message }) })
      if (!response.ok) throw new Error(String(response.status))
      if (controller.signal.aborted) return
      usePlayerStore.getState().setPlayerShareInfo(message)
      onSent()
    } catch {
      if (controller.signal.aborted) return
      request.current = null
      setSaving(false)
      setFailed(true)
    }
  }
  function confirm() {
    if (editing) choose(cursor)
    else if (active === done) void send()
    else open(active)
  }
  function back() {
    if (request.current) return
    playClick()
    if (editing) setEditing(false)
    else onBack()
  }
  function move(vertical: boolean, step: number) {
    if (editing) {
      if (vertical) setCursor(i => wrap(i + step, options.length))
    } else if (vertical) focusField(active === done ? lastField.current : done)
    else focusField(wrap((active === done ? lastField.current : active) + step, done))
  }
  function keydown(event: KeyboardEvent<HTMLDialogElement>) {
    if (saving || event.altKey || event.ctrlKey || event.metaKey) return
    const key = event.key
    if (key === 'Escape' || key === 'Backspace') { event.preventDefault(); if (!event.repeat) back(); return }
    if (key === 'Enter' || key === ' ') { event.preventDefault(); if (!event.repeat) confirm(); return }
    if (['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's'].includes(key)) {
      event.preventDefault()
      move(['ArrowUp', 'w', 'ArrowDown', 's'].includes(key), ['ArrowLeft', 'a', 'ArrowUp', 'w'].includes(key) ? -1 : 1)
    } else if (editing && ['PageUp', 'PageDown', 'Home', 'End'].includes(key)) {
      event.preventDefault()
      setCursor(i => key === 'Home' ? 0 : key === 'End' ? options.length - 1 :
        Math.max(0, Math.min(options.length - 1, i + (key === 'PageUp' ? -8 : 8))))
    }
  }
  useMenuGamepad(!saving, command => {
    if (command === 'confirm') confirm()
    else if (command === 'back') back()
    else move(command === 'up' || command === 'down', command === 'up' || command === 'left' ? -1 : 1)
  }, editing)

  function fieldButton(index: number) {
    const field = fields[index]
    return <button key={field} ref={node => { controls.current[index] = node }}
      type="button" disabled={saving} tabIndex={editing ? -1 : 0} aria-haspopup="listbox"
      aria-expanded={editing && active === index} aria-label={t('composer.' + field) + ' ' + segments[index]}
      data-selected={active === index} onFocus={() => { if (!editing) focusField(index) }}
      onClick={() => open(index)}>【 {segments[index]} 】</button>
  }

  const hint = failed ? t('finale.saveError') : editing ? t(active === 3 ? 'composer.selectRegion'
    : active === 1 ? 'composer.selectConnection' : 'composer.selectPhrase')
    : t(active === done ? 'composer.ready' : 'composer.selectPart')
  return <GameDialog className={styles.editor} data-finale="message" aria-label={t('composer.title')} onKeyDown={keydown}>
    <div className={styles.preview} aria-label={t('composer.title')}>
      <span className={styles.name}>{player.name}</span><span aria-hidden="true">「</span>
      <div className={styles.sentence}>{fields.slice(0, 3).map((_, i) => fieldButton(i))}</div>
      <span aria-hidden="true">」</span><div className={styles.location}>{fieldButton(3)}</div>
    </div>
    {editing && <div className={styles.menu}>
      <span className={styles.rail} aria-hidden="true" />
      <div ref={list} role="listbox" aria-label={t('composer.' + fields[active])}
        tabIndex={0} aria-activedescendant={'message-option-' + cursor} className={styles.options}>
        {options.map((option, i) => <div key={i} id={'message-option-' + i} role="option"
          aria-selected={cursor === i} onPointerMove={event => { if (event.pointerType === 'mouse') setCursor(i) }}
          onClick={() => choose(i)}>{option}</div>)}
      </div>
    </div>}
    <div className={styles.completion}>
      <span className={styles.rail} aria-hidden="true" />
      <button type="button" ref={node => { controls.current[done] = node }} disabled={editing || saving}
        data-selected={active === done} onFocus={() => focusField(done)} onClick={send}>{t('finish')}</button>
    </div>
    <p className={styles.hint} role={failed ? 'alert' : 'status'}>{hint}</p>
    <footer className={styles.legend}>
      <span><b aria-hidden="true">✥</b>{t('composer.select')}</span>
      <button type="button" disabled={saving} tabIndex={-1} onClick={confirm}><b>A</b>{t('composer.confirm')}</button>
      <button type="button" disabled={saving} tabIndex={-1} onClick={back}><b>B</b>{t('saves.back')}</button>
    </footer>
  </GameDialog>
}
