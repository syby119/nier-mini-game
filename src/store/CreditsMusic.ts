const beat = 60 / 74
const bar = 4 * beat

// Cues in ending-e-credits.mp3, aligned to the downbeat in the finale recording.
const choirDownbeat = 188.73
const soloLoop = { start: choirDownbeat - 33 * bar, end: choirDownbeat }
const choirLoop = { start: choirDownbeat, end: choirDownbeat + 24 * bar }
const choirEntry = choirDownbeat + 16 * bar
type Loop = typeof soloLoop

type Voice = { source: AudioBufferSourceNode, gain: GainNode, startedAt: number }
type Playback = {
  output: GainNode
  sources: Set<AudioBufferSourceNode>
  choir: boolean
  solo?: Voice
}

let context: AudioContext | undefined
let recording: AudioBuffer | undefined
let loading = false
let playback: Playback | undefined
let volume = .3

function wrap(position: number, loop: Loop) {
  const length = loop.end - loop.start
  return loop.start + ((position - loop.start) % length + length) % length
}

function blendLoopTail(buffer: AudioBuffer, loop: Loop) {
  const start = Math.round(loop.start * buffer.sampleRate)
  const end = Math.round(loop.end * buffer.sampleRate)
  const count = Math.round(.08 * buffer.sampleRate)
  // Blend into the audio immediately BEFORE the incoming beat to keep the full loop length.
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const samples = buffer.getChannelData(ch)
    for (let i = 0; i < count; i++) {
      const mix = (1 - Math.cos(Math.PI * i / (count - 1))) / 2
      const tail = end - count + i
      samples[tail] += mix * (samples[start - count + i] - samples[tail])
    }
  }
}

async function loadRecording(audio: AudioContext) {
  const response = await fetch('/nier/sound/music/ending-e-credits.mp3')
  if (!response.ok) throw new Error(`Credits music: HTTP ${response.status}`)
  const buffer = await audio.decodeAudioData(await response.arrayBuffer())
  // The choir's incoming pre-roll shares the solo tail. Read it before editing that tail.
  blendLoopTail(buffer, choirLoop)
  blendLoopTail(buffer, soloLoop)
  return buffer
}

function playLoop(run: Playback, buffer: AudioBuffer, loop: Loop, offset: number, when: number, level: number): Voice {
  const audio = run.output.context
  const source = audio.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.loopStart = Math.round(loop.start * buffer.sampleRate) / buffer.sampleRate
  source.loopEnd = Math.round(loop.end * buffer.sampleRate) / buffer.sampleRate
  const gain = audio.createGain()
  gain.gain.value = level
  source.connect(gain).connect(run.output)
  run.sources.add(source)
  source.onended = () => {
    source.disconnect()
    gain.disconnect()
    run.sources.delete(source)
    if (run.sources.size === 0) run.output.disconnect()
  }
  source.start(when, offset)
  return { source, gain, startedAt: when }
}

function syncPlayback() {
  const run = playback
  if (!context || context.state !== 'running' || !recording) return
  removeUnlockListeners()
  if (!run) return
  const now = context.currentTime
  if (run.sources.size === 0) {
    if (run.choir) playLoop(run, recording, choirLoop, choirEntry, now, 1)
    else run.solo = playLoop(run, recording, soloLoop, 0, now, 1)
    return
  }
  const solo = run.solo
  if (!run.choir || !solo) return

  // Schedule both voices on the same beat, including after any number of solo loops.
  const elapsed = now + .02 - solo.startedAt
  const nextBeat = soloLoop.start + Math.ceil((elapsed - soloLoop.start) / beat) * beat
  const when = solo.startedAt + nextBeat
  const position = nextBeat < soloLoop.end ? nextBeat : wrap(nextBeat, soloLoop)
  const offset = wrap(choirEntry + position - soloLoop.start, choirLoop)
  const incoming = playLoop(run, recording, choirLoop, offset, when, 0)
  const fadeEnd = when + beat / 2
  incoming.gain.gain.setValueAtTime(0, when)
  incoming.gain.gain.linearRampToValueAtTime(1, fadeEnd)
  solo.gain.gain.setValueAtTime(1, when)
  solo.gain.gain.linearRampToValueAtTime(0, fadeEnd)
  solo.source.stop(fadeEnd)
  run.solo = undefined
}

function removeUnlockListeners() {
  window.removeEventListener('pointerup', prepareCreditsMusic)
  window.removeEventListener('keydown', prepareCreditsMusic)
}

export function prepareCreditsMusic() {
  const audio = context ??= new AudioContext()
  if (audio.state !== 'running' || !recording) {
    window.addEventListener('pointerup', prepareCreditsMusic)
    window.addEventListener('keydown', prepareCreditsMusic)
  }
  if (audio.state !== 'running') void audio.resume().then(syncPlayback, () => {})
  if (!recording && !loading) {
    loading = true
    void loadRecording(audio).then(buffer => {
      recording = buffer
      syncPlayback()
    }).catch(error => console.warn('Could not load credits music', error)).finally(() => { loading = false })
  }
  syncPlayback()
}

function requestMusic(choir: boolean) {
  const audio = context ??= new AudioContext()
  if (!playback) {
    const output = audio.createGain()
    output.gain.value = volume
    output.connect(audio.destination)
    playback = { output, sources: new Set(), choir }
  }
  if (choir) playback.choir = true
  prepareCreditsMusic()
}

export function startCreditsMusic() { requestMusic(false) }
export function joinCreditsChoir() { requestMusic(true) }

export function stopCreditsMusic() {
  const run = playback
  playback = undefined
  removeUnlockListeners()
  if (!run) return
  const now = run.output.context.currentTime
  const end = now + .65
  run.output.gain.setValueAtTime(run.output.gain.value, now)
  run.output.gain.linearRampToValueAtTime(0, end)
  run.sources.forEach(source => source.stop(end))
  if (!run.sources.size) run.output.disconnect()
}

export function setCreditsVolume(next: number) {
  volume = next
  if (playback) playback.output.gain.value = next
}
