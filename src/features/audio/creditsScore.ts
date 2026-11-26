export const beat = 60 / 74
export const bar = 4 * beat

// Cues in ending-e-credits.mp3, aligned to the downbeat in the finale recording.
const choirDownbeat = 188.73
export const soloLoop = { start: choirDownbeat - 33 * bar, end: choirDownbeat }
export const choirLoop = { start: choirDownbeat, end: choirDownbeat + 24 * bar }
export const choirEntry = choirDownbeat + 16 * bar
export type Loop = typeof soloLoop
export type Score = { music: AudioBuffer, voices?: AudioBuffer }

export function wrap(position: number, loop: Loop) {
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

export async function loadRecording(audio: AudioContext): Promise<Score> {
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
