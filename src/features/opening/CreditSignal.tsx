import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import styles from './OpeningCredits.module.css'

export type CreditMotion = 'roll' | 'hold' | 'rewind'
export type CreditNoise = 'clean' | 'onset' | 'weak' | 'strong'

type Span = [first: number, end: number]
type Block = [first: number, end: number, sheet: number, top: number]
type CreditInk = {
  name: string
  y: number
  x: number
  width: number
  spans: Span[]
  blocks: Block[]
}
type Props = {
  strip: RefObject<HTMLDivElement | null>
  motion: CreditMotion
  noise: CreditNoise
  endInset: number
  rollSpeed: number
}

// Source-frame coordinates in the 640 × 360, 30 fps recording.
const assets = '/images/opening-credits'
const firstFrame = 1644
const holdFrame = 2139
const rewindFrame = 2764
const lastFrame = 2801
const fps = 30
const framesPerSheet = 60
const cellHeight = 17
const sheetWidth = 1536
const canvasLeft = 128
const canvasWidth = 416
const sheetForFrame = (frame: number) => Math.floor((frame - firstFrame) / framesPerSheet)
const rewindStep = 64.4
const rewindMargin = 34
const rewindHeight = 360 + 2 * rewindMargin
const rewindSheet = (frame: number) => sheetForFrame(lastFrame) + 1 + Math.floor((frame - rewindFrame) / 12)

// A line can pass behind the recorded dialogue or leave the frame. Play its
// nearest unobscured samples back and forth while it is still visible in the game.
function sampleFrame(frame: number, spans: Span[], rewind: boolean) {
  let nearest = spans[0]
  let distance = Infinity
  for (const span of spans) {
    const [first, end] = span
    if ((first >= rewindFrame) !== rewind) continue
    if (first <= frame && frame < end) return frame
    const gap = Math.max(first - frame, frame - end + 1)
    if (gap < distance) { nearest = span; distance = gap }
  }
  const [first, end] = nearest
  const length = end - first - 1
  if (length === 0) return first
  const phase = Math.abs(frame - first) % (2 * length)
  return first + Math.min(phase, 2 * length - phase)
}

export function CreditSignal({ strip, motion, noise, endInset, rollSpeed }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const playback = useRef({ motion, noise })
  useLayoutEffect(() => { playback.current = { motion, noise } }, [motion, noise])

  useEffect(() => {
    const surface = canvas.current!
    const list = strip.current!
    const field = list.parentElement!
    const context = surface.getContext('2d')
    if (!context) return
    const ctx = context
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const controller = new AbortController()
    const sheets = new Map<number, { image: HTMLImageElement, lastUsed: number }>()
    const elements = new Map(Array.from(list.querySelectorAll<HTMLElement>('[data-credit]'), el => [el.dataset.credit!, el]))
    let rows: CreditInk[] = []
    let request = 0
    let heldAt: number | undefined
    let unit = 1
    let height = 0
    let visible = new Set<HTMLElement>()
    let revision = 0
    let lastPaint = { frame: -1, offset: NaN, revision: -1, rewind: false }

    function sheet(index: number, now: number) {
      let entry = sheets.get(index)
      if (!entry) {
        const image = new Image()
        image.onload = () => { revision++ }
        image.src = `${assets}/${String(index).padStart(2, '0')}.webp`
        entry = { image, lastUsed: now }
        sheets.set(index, entry)
      }
      entry.lastUsed = now
      return entry.image
    }

    function show(ink: Set<HTMLElement>) {
      visible.forEach(el => { if (!ink.has(el)) el.removeAttribute('data-sampled') })
      ink.forEach(el => { if (!visible.has(el)) el.setAttribute('data-sampled', '') })
      visible = ink
    }

    function resize() {
      unit = Math.min(field.clientWidth / 640, field.clientHeight / 360)
      if (!unit) return
      height = field.clientHeight / unit
      const scale = unit * window.devicePixelRatio
      surface.width = Math.max(1, Math.round(canvasWidth * scale))
      surface.height = Math.max(1, Math.round(height * scale))
      ctx.setTransform(surface.width / canvasWidth, 0, 0, surface.height / height, 0, 0)
      ctx.imageSmoothingQuality = 'high'
      revision++
    }

    function draw(now: number) {
      request = requestAnimationFrame(draw)
      const { motion, noise } = playback.current
      if (noise === 'clean' && motion === 'roll') return
      if (!rows.length || !unit) return
      const offset = list.getBoundingClientRect().top / unit + endInset
      const rewind = motion === 'rewind'
      let frame = holdFrame + Math.round(offset * fps / rollSpeed)
      if (rewind) {
        frame = Math.min(lastFrame, rewindFrame - 1 + Math.round(-offset / rewindStep))
      } else if (motion === 'hold' || offset >= -0.5) {
        heldAt ??= now
        frame = holdFrame + Math.floor((now - heldAt) * fps / 1000) % (rewindFrame - holdFrame)
      }
      if (frame < firstFrame) return
      if (frame === lastPaint.frame && offset === lastPaint.offset && revision === lastPaint.revision && rewind === lastPaint.rewind) return
      lastPaint = { frame, offset, revision, rewind }

      const ink = new Set<HTMLElement>()
      const blend = Math.min(1, (frame - firstFrame) / 8)
      surface.style.opacity = String(blend)
      field.style.setProperty('--live-ink', String(1 - blend))
      ctx.clearRect(0, 0, canvasWidth, height)
      const plate = rewind && frame >= rewindFrame ? sheet(rewindSheet(frame), now) : undefined
      const hasPlate = plate?.complete && plate.naturalWidth > 0
      const plateY = offset + (frame - rewindFrame + 1) * rewindStep - rewindMargin
      for (const row of rows) {
        let y = row.y + offset - (cellHeight - 1) / 2
        if (y + cellHeight <= 0 || y >= height) continue
        const el = elements.get(row.name)
        if (!el) continue
        if (hasPlate && y >= plateY && y + cellHeight <= plateY + rewindHeight) {
          ink.add(el)
          continue
        }
        const n = sampleFrame(frame, row.spans, rewind)
        // Tiles were cut on integer pixels. Restore their subpixel phase while the strip moves.
        const sourceOffset = n >= rewindFrame ? -(n - rewindFrame + 1) * rewindStep : Math.min(0, (n - holdFrame) * rollSpeed / fps)
        y += Math.round(sourceOffset) - sourceOffset
        const block = row.blocks.find(([first, end]) => first <= n && n < end)!
        const [first, , index, top] = block
        const image = sheet(index, now)
        if (!image.complete || !image.naturalWidth) continue
        const columns = Math.floor(sheetWidth / row.width)
        const cell = n - first
        ctx.drawImage(image, cell % columns * row.width, top + Math.floor(cell / columns) * cellHeight, row.width, cellHeight,
          row.x - canvasLeft, y, row.width, cellHeight)
        ink.add(el)
      }
      if (plate && hasPlate) {
        const cell = (frame - rewindFrame) % 12
        ctx.clearRect(0, plateY, canvasWidth, rewindHeight)
        ctx.drawImage(plate, cell % 3 * canvasWidth, Math.floor(cell / 3) * rewindHeight, canvasWidth, rewindHeight,
          0, plateY, canvasWidth, rewindHeight)
      }
      show(ink)
      // Prefetch the following two-second sheet and the short, player-triggered rewind.
      const page = sheetForFrame(frame)
      if (page < sheetForFrame(lastFrame)) sheet(page + 1, now)
      if (motion === 'hold') {
        sheet(sheetForFrame(rewindFrame), now)
        sheet(sheetForFrame(lastFrame), now)
      }
      if (noise === 'strong') {
        for (let i = rewindSheet(rewindFrame); i <= rewindSheet(lastFrame); i++) sheet(i, now)
      }
      sheets.forEach((entry, index) => { if (now - entry.lastUsed > 2500) sheets.delete(index) })
    }

    async function start() {
      if (!rows.length) {
        const response = await fetch(`${assets}/index.json`, { signal: controller.signal })
        if (!response.ok) return
        rows = await response.json()
      }
      if (controller.signal.aborted || preference.matches || request) return
      sheet(0, performance.now())
      resize()
      request = requestAnimationFrame(draw)
    }

    function syncPreference() {
      cancelAnimationFrame(request)
      request = 0
      show(new Set())
      ctx.clearRect(0, 0, canvasWidth, height)
      revision++
      if (!preference.matches) void start().catch(() => { /* The live credits remain readable. */ })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(field)
    preference.addEventListener('change', syncPreference)
    syncPreference()
    return () => {
      controller.abort()
      cancelAnimationFrame(request)
      observer.disconnect()
      preference.removeEventListener('change', syncPreference)
      show(new Set())
      sheets.clear()
      field.style.removeProperty('--live-ink')
    }
  }, [strip, endInset, rollSpeed])

  return <canvas className={styles.signal} ref={canvas} aria-hidden="true" />
}
