import usePlayerStore from '@/features/combat/player/PlayerStore'
import useGamePauseStore from '@/game/state/GamePauseStore'
import systemInfoStore from '@/game/state/SystemInfoStore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { navigateToStage, stageNames } from './developerStages'

export default function DeveloperStagePicker() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState('0')
  const [support, setSupport] = useState(false)
  const [unknownStage, setUnknownStage] = useState('')

  const openPicker = useCallback(() => {
    const current = systemInfoStore.getState().systemInfo.currentPhase
    setStage(stageNames.has(current) ? current : '0')
    setSupport(usePlayerStore.getState().playerInfo.needOtherPlayerHelp)
    setOpen(true)
  }, [])

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('stage')
    if (requested !== null && !stageNames.has(requested)) {
      setUnknownStage(requested)
      openPicker()
    }
    function shortcut(event: KeyboardEvent) {
      if (event.key === 'Escape' && dialog.current?.open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        return
      }
      if (event.key !== 'F2' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      event.preventDefault()
      if (event.repeat) return
      if (dialog.current?.open) setOpen(false)
      else openPicker()
    }
    window.addEventListener('keydown', shortcut, true)
    return () => window.removeEventListener('keydown', shortcut, true)
  }, [openPicker])

  useEffect(() => {
    if (!open) return
    const modal = dialog.current!
    const pause = useGamePauseStore.getState()
    const resume = systemInfoStore.getState().gameStarted && !pause.isPaused
    if (resume) pause.togglePause()
    modal.showModal()
    return () => {
      modal.close()
      if (resume && useGamePauseStore.getState().isPaused) pause.togglePause()
    }
  }, [open])

  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-keyshortcuts="F2"
        className="pointer-events-auto fixed bottom-3 right-3 z-50 border border-[#d6cfbd]/40 bg-[#22201c] px-3 py-1 text-xs text-[#e5dfce]"
        onMouseDown={event => event.stopPropagation()} onClick={openPicker}>
        選關 <kbd>F2</kbd>
      </button>
      {open && <dialog ref={dialog} aria-labelledby="dev-stage-title"
        className="pointer-events-auto fixed inset-0 m-auto w-80 max-w-[92vw] border border-[#58564b] bg-[#dad4bb] p-5 text-[#423f37] shadow-xl backdrop:bg-black/50"
        onKeyDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
        onCancel={event => { event.preventDefault(); setOpen(false) }}>
        <form className="grid gap-4" onSubmit={event => {
          event.preventDefault()
          const values = new FormData(event.currentTarget)
          const selected = values.get('stage')
          if (typeof selected === 'string') navigateToStage(selected, values.has('support'))
        }}>
          <h2 id="dev-stage-title" className="text-lg font-semibold">開發者選關</h2>
          {unknownStage && <p role="status">找不到關卡「{unknownStage}」。</p>}
          <label className="grid min-w-0 gap-1 text-sm">關卡
            <select name="stage" autoFocus value={stage} onChange={event => { setStage(event.target.value); setUnknownStage('') }}
              className="w-full border border-[#787463] bg-[#eeeada] p-2">
              {Array.from(stageNames, ([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="support" type="checkbox" checked={stage !== 'end' && support} disabled={stage === 'end'}
              onChange={event => setSupport(event.target.checked)} /> 啟用支援機編隊
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" className="px-3 py-1" onClick={() => setOpen(false)}>取消</button>
            <button type="submit" className="bg-[#4e4b42] px-4 py-1 text-[#eeeada]">進入關卡</button>
          </div>
        </form>
      </dialog>}
    </>
  )
}
