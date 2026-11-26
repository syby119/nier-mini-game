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
type RefrainCue = { when: number, offset: number, blend: number }
type Playback = {
  output: GainNode
  dialogue: GainNode
  sources: Set<AudioBufferSourceNode>
  arrangement: Arrangement
  offset: number
  solo?: Voice
  refrain?: { backing: Voice, voices?: Voice }
  joined?: boolean
}

let context: AudioContext | undefined
let recording: Score | undefined
let loading = false
let playback: Playback | undefined
let volume = .3
let dialogueLevel = 1
let musicBus: GainNode | undefined
const dialogueFaders = new Set<GainNode>()

export function getGameAudioContext() {
  return context ??= new AudioContext()
}

export function rampGain(node: GainNode, level: number, seconds: number) {
  const now = node.context.currentTime
  const gain = node.gain
  const current = gain.value
  gain.cancelScheduledValues(now)
  gain.setValueAtTime(current, now)
  gain.linearRampToValueAtTime(level, now + seconds)
}

export function setCreditsDialogueLevel(level: number, seconds: number) {
  dialogueLevel = level
  dialogueFaders.forEach(node => {
    // Once a run is fading to silence, a Pod line ending must not lift its tail.
    if (node === playback?.dialogue || level < node.gain.value) rampGain(node, level, seconds)
  })
}

function disconnectOutput(run: Playback) {
  run.output.disconnect()
  run.dialogue.disconnect()
  dialogueFaders.delete(run.dialogue)
}

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
  const edge = Math.round(.012 * music.sampleRate)
  for (let ch = 0; ch < music.numberOfChannels; ch++) {
    const backing = music.getChannelData(ch)
    const ensemble = voices.getChannelData(ch)
    // The isolated voices have no pre-roll. Give the seam to the continuous master so it
    // stays smooth at every choir level. The two layers still sum to the original mix.
    for (let i = 0; i < edge; i++) {
      const gain = (1 - Math.cos(Math.PI * i / (edge - 1))) / 2
      ensemble[i] *= gain
      ensemble[length - 1 - i] *= gain
    }
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
    if (run.solo?.source === source) run.solo = undefined
    if (run.sources.size === 0) disconnectOutput(run)
  }
  source.start(when, offset)
  return { source, gain, startedAt: when }
}

function refrainCue(run: Playback, now: number): RefrainCue {
  const solo = run.solo
  if (!solo) return { when: now, offset: choirEntry, blend: 0 }

  const earliest = now + .02
  const elapsed = run.offset + earliest - solo.startedAt
  const loop = { start: solo.source.loopStart, end: solo.source.loopEnd }
  const position = elapsed < loop.end ? elapsed : wrap(elapsed, loop)
  const downbeat = position < loop.start ? loop.start : loop.end
  const natural = { when: earliest + downbeat - position, offset: choirEntry, blend: bar }
  // A retry arms the next complete refrain. The solo keeps its own melody up to that downbeat.
  if (run.arrangement !== 'choir' || downbeat - position <= 2 * beat) return natural

  const inRefrain = position - loop.start
  if (inRefrain >= 0 && inRefrain < 8 * bar - beat) {
    return { when: earliest, offset: choirEntry + inRefrain, blend: Math.min(bar, 8 * bar - inRefrain) }
  }
  // An early rescue can use the pickup after the current vocal line. Enter on the first
  // words of the recorded refrain even when the player accepted halfway through a verse.
  const line = 2 * bar
  const pickup = downbeat + Math.ceil((position + beat - downbeat) / line) * line - beat
  return { when: earliest + pickup - position, offset: choirEntry - beat, blend: 2 * beat }
}

function enterRefrain(run: Playback, score: Score, cue: RefrainCue) {
  const { offset, blend } = cue
  const rate = score.music.sampleRate
  const when = Math.round(cue.when * rate) / rate
  const solo = run.solo
  if (run.refrain) {
    // Early acceptance can replace a future cue. Both of these sources are still silent.
    run.refrain.backing.source.stop()
    run.refrain.voices?.source.stop()
    solo?.gain.gain.cancelScheduledValues(run.output.context.currentTime)
  }
  const start = Math.round(choirLoop.start * rate)
  const length = Math.round(choirLoop.end * rate) - start
  const frame = (Math.round(offset * rate) - start) % length
  const backing = playLoop(run, score.music, choirLoop, (start + frame) / rate, when, solo ? 0 : 1)
  if (solo) {
    const end = when + blend
    backing.gain.gain.setValueAtTime(0, when)
    backing.gain.gain.linearRampToValueAtTime(1, end)
    solo.gain.gain.setValueAtTime(1, when)
    solo.gain.gain.linearRampToValueAtTime(0, end)
    solo.source.stop(end)
  }
  const voices = score.voices && playLoop(run, score.voices, { start: 0, end: length / rate },
    frame / rate, when, 0, backing.gain)
  run.refrain = { backing, voices }
}

function syncPlayback() {
  const run = playback
  if (!context || context.state !== 'running' || !recording) return
  removeUnlockListeners()
  if (!run) return
  const now = context.currentTime
  if (!run.solo && !run.refrain && run.arrangement !== 'choir') {
    run.solo = playLoop(run, recording.music, soloLoop, run.offset, now, 1)
  }
  if (run.arrangement === 'solo' || run.joined || (run.arrangement === 'refrain' && !recording.voices)) return
  const scheduled = run.refrain?.backing.startedAt
  if (scheduled === undefined || (run.arrangement === 'choir' && scheduled > now)) {
    const cue = refrainCue(run, now)
    if (scheduled === undefined || cue.when < scheduled - .02) enterRefrain(run, recording, cue)
  }
  if (run.arrangement === 'choir' && run.refrain) {
    const start = Math.max(now, run.refrain.backing.startedAt)
    const gain = run.refrain.voices?.gain.gain
    gain?.setValueAtTime(0, start)
    gain?.linearRampToValueAtTime(1, start + 1)
    run.joined = true
  }
}

function removeUnlockListeners() {
  window.removeEventListener('pointerup', prepareCreditsMusic)
  window.removeEventListener('keydown', prepareCreditsMusic)
}

export function prepareCreditsMusic() {
  const audio = getGameAudioContext()
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

function requestMusic(arrangement: Arrangement, offset = 0) {
  const audio = getGameAudioContext()
  if (!playback) {
    if (!musicBus) {
      musicBus = audio.createGain()
      musicBus.gain.value = volume
      musicBus.connect(audio.destination)
    }
    const output = audio.createGain()
    const dialogue = audio.createGain()
    dialogue.gain.value = dialogueLevel
    output.connect(dialogue).connect(musicBus)
    dialogueFaders.add(dialogue)
    playback = { output, dialogue, sources: new Set(), arrangement, offset }
  } else if (arrangement === 'choir' || (arrangement === 'refrain' && playback.arrangement === 'solo')) {
    playback.arrangement = arrangement
  }
  prepareCreditsMusic()
}

export function startCreditsMusic(offset = 0) { requestMusic('solo', offset) }
export function prepareRescueRefrain() { if (playback) requestMusic('refrain') }
export function joinCreditsChoir() { requestMusic('choir') }

export function stopCreditsMusic(duration = .65) {
  const run = playback
  playback = undefined
  removeUnlockListeners()
  if (!run) return
  const now = run.output.context.currentTime
  if (run.dialogue.gain.value < dialogueLevel) {
    rampGain(run.dialogue, run.dialogue.gain.value, .005)
  }
  const end = now + duration
  const level = run.output.gain.value
  const release = Float32Array.from({ length: 33 }, (_, i) => level * (1 - i / 32) ** 2)
  run.output.gain.cancelScheduledValues(now)
  run.output.gain.setValueCurveAtTime(release, now, duration)
  run.sources.forEach(source => source.stop(end))
  if (!run.sources.size) disconnectOutput(run)
}

export function setCreditsVolume(next: number) {
  volume = next
  if (musicBus) rampGain(musicBus, next, .025)
}
