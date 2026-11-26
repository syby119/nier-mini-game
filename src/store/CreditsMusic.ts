const beat = 60 / 74
const bar = 4 * beat

// Cues in ending-e-credits.mp3, aligned to the downbeat in the finale recording.
const choirDownbeat = 188.73
const soloLoop = { start: choirDownbeat - 33 * bar, end: choirDownbeat }
const choirLoop = { start: choirDownbeat, end: choirDownbeat + 24 * bar }
const choirEntry = choirDownbeat + 16 * bar
type Loop = typeof soloLoop
type Score = { music: AudioBuffer, voices?: AudioBuffer }
type Arrangement = 'solo' | 'refrain' | 'choir'

type Voice = { source: AudioBufferSourceNode, gain: GainNode, startedAt: number }
type Playback = {
  output: GainNode
  sources: Set<AudioBufferSourceNode>
  arrangement: Arrangement
  solo?: Voice
  choirFader?: AudioParam
}

let context: AudioContext | undefined
let recording: Score | undefined
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

async function loadAudio(audio: AudioContext, file: string) {
  const response = await fetch('/nier/sound/music/' + file)
  if (!response.ok) throw new Error(`Credits music: HTTP ${response.status}`)
  return audio.decodeAudioData(await response.arrayBuffer())
}

async function loadRecording(audio: AudioContext): Promise<Score> {
  const [music, layer] = await Promise.all([
    loadAudio(audio, 'ending-e-credits.mp3'),
    loadAudio(audio, 'ending-e-choir-layer.ogg').catch(error => {
      console.warn('Could not load the choir layer', error)
      return undefined
    }),
  ])
  // The choir's incoming pre-roll shares the solo tail. Read it before editing that tail.
  blendLoopTail(music, choirLoop)
  blendLoopTail(music, soloLoop)
  if (!layer) return { music }

  const start = Math.round(choirLoop.start * music.sampleRate)
  const length = Math.round(choirLoop.end * music.sampleRate) - start
  // Resampling the two files separately can differ by one frame. Both loops must have the same period.
  let voices = layer
  if (voices.length !== length) {
    voices = audio.createBuffer(layer.numberOfChannels, length, music.sampleRate)
    for (let ch = 0; ch < layer.numberOfChannels; ch++) {
      voices.copyToChannel(layer.getChannelData(ch).subarray(0, length), ch)
    }
  }
  // The layer comes from this stereo master. Their sum restores the original mix at any playhead.
  for (let ch = 0; ch < music.numberOfChannels; ch++) {
    const backing = music.getChannelData(ch)
    const ensemble = voices.getChannelData(ch)
    for (let i = 0; i < length; i++) backing[start + i] -= ensemble[i]
  }
  return { music, voices }
}

function playLoop(run: Playback, buffer: AudioBuffer, loop: Loop, offset: number, when: number, level: number,
  destination: GainNode = run.output): Voice {
  const audio = run.output.context
  const source = audio.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.loopStart = Math.round(loop.start * buffer.sampleRate) / buffer.sampleRate
  source.loopEnd = Math.round(loop.end * buffer.sampleRate) / buffer.sampleRate
  const gain = audio.createGain()
  gain.gain.value = level
  source.connect(gain).connect(destination)
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

function enterRefrain(run: Playback, score: Score, now: number) {
  const solo = run.solo
  let when = now
  let offset = choirEntry
  if (solo) {
    const earliest = now + .02
    const elapsed = earliest - solo.startedAt
    const position = elapsed < soloLoop.end ? elapsed : wrap(elapsed, soloLoop)
    const atFirstRefrain = position >= soloLoop.start && position < soloLoop.start + 8 * bar
    const downbeat = position < soloLoop.start || atFirstRefrain ? soloLoop.start : soloLoop.end
    // In the matching refrain the melody can carry straight across. In a verse, keep the
    // current line through its last beat and use the pickup to the next two-bar line.
    const nextLine = downbeat + Math.ceil((position + beat - downbeat) / (2 * bar)) * 2 * bar
    const entry = atFirstRefrain ? position : nextLine - beat
    when = earliest + (entry - position)
    offset = wrap(choirEntry + entry - downbeat, choirLoop)
  }

  const rate = score.music.sampleRate
  const start = Math.round(choirLoop.start * rate)
  const length = Math.round(choirLoop.end * rate) - start
  const frame = Math.round((offset - choirLoop.start) * rate) % length
  const backing = playLoop(run, score.music, choirLoop, (start + frame) / rate, when, solo ? 0 : 1)
  if (solo) {
    const end = when + beat
    backing.gain.gain.setValueAtTime(0, when)
    backing.gain.gain.linearRampToValueAtTime(1, end)
    solo.gain.gain.setValueAtTime(1, when)
    solo.gain.gain.linearRampToValueAtTime(0, end)
    solo.source.stop(end)
    run.solo = undefined
  }
  if (score.voices) {
    const loop = { start: 0, end: length / rate }
    run.choirFader = playLoop(run, score.voices, loop, frame / rate, when, 0, backing.gain).gain.gain
  }
}

function syncPlayback() {
  const run = playback
  if (!context || context.state !== 'running' || !recording) return
  removeUnlockListeners()
  if (!run) return
  const now = context.currentTime
  if (!run.sources.size && run.arrangement !== 'choir') {
    run.solo = playLoop(run, recording.music, soloLoop, 0, now, 1)
  }
  if (run.arrangement === 'solo' || (run.arrangement === 'refrain' && !recording.voices)) return
  if (run.solo || !run.sources.size) enterRefrain(run, recording, now)
  if (run.arrangement === 'choir' && run.choirFader) {
    // The filmed rescue adds voices during the confirmation fade, over approximately one second.
    run.choirFader.setValueAtTime(0, now)
    run.choirFader.linearRampToValueAtTime(1, now + 1)
    run.choirFader = undefined
  }
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

function requestMusic(arrangement: Arrangement) {
  const audio = context ??= new AudioContext()
  if (!playback) {
    const output = audio.createGain()
    output.gain.value = volume
    output.connect(audio.destination)
    playback = { output, sources: new Set(), arrangement }
  } else if (arrangement === 'choir' || (arrangement === 'refrain' && playback.arrangement === 'solo')) {
    playback.arrangement = arrangement
  }
  prepareCreditsMusic()
}

export function startCreditsMusic() { requestMusic('solo') }
export function prepareRescueRefrain() { if (playback) requestMusic('refrain') }
export function joinCreditsChoir() { requestMusic('choir') }

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
