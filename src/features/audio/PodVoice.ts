import useAudioStore, { setDialogueMusicLevel } from './AudioStore'
import { getGameAudioContext, rampGain } from './CreditsMusic'
import type { PodLanguage } from './podLanguage'

const speaking = new Set<HTMLAudioElement>()
let restoreTimer: number | undefined

type VoiceEvents = { onPlaying?: () => void, onWaiting?: () => void, onEnded?: () => void, onError?: () => void }

export function playPodVoice(language: PodLanguage, file: string, { onPlaying, onWaiting, onEnded, onError }: VoiceEvents = {}) {
  const root = language === 'ja' ? '/nier/sound/dialogue/ja/' : '/nier/sound/dialogue/'
  const audio = new Audio(root + file)
  audio.lang = language
  // The Japanese masters are a little quieter than the English recordings.
  const voiceGain = language === 'ja' ? 2.25 : 1.9
  const events = new AbortController()
  const { signal } = events
  const context = typeof AudioContext === 'undefined' ? undefined : getGameAudioContext()
  let source: MediaElementAudioSourceNode | undefined
  let gain: GainNode | undefined

  function setVolume(volume: number) {
    if (gain) rampGain(gain, volume * voiceGain, .025)
    else audio.volume = Math.min(1, volume * voiceGain)
  }
  function connectVoice() {
    // A standalone finale can start before Web Audio unlocks. The media element can still play.
    if (source || context?.state !== 'running') return
    source = context.createMediaElementSource(audio)
    gain = context.createGain()
    gain.gain.value = useAudioStore.getState().initVolume * voiceGain
    source.connect(gain).connect(context.destination)
    audio.volume = 1
  }
  function releaseMusic() {
    if (!speaking.delete(audio) || speaking.size) return
    // Keep the music down over the gaps between consecutive Pod lines.
    restoreTimer = window.setTimeout(() => setDialogueMusicLevel(1, 750), 600)
  }
  function failed() {
    if (signal.aborted) return
    releaseMusic()
    onError?.()
  }

  setVolume(useAudioStore.getState().initVolume)
  connectVoice()
  if (!source) context?.addEventListener('statechange', connectVoice, { signal })
  const unsubscribe = useAudioStore.subscribe((state, previous) => {
    if (state.initVolume !== previous.initVolume) setVolume(state.initVolume)
  })
  audio.addEventListener('playing', () => {
    connectVoice()
    // The ellipsis clips are authored silence with subtitle timing.
    if (!file.endsWith('_ellipsis.ogg')) {
      window.clearTimeout(restoreTimer)
      speaking.add(audio)
      setDialogueMusicLevel(.1, 80)
    }
    onPlaying?.()
  }, { signal })
  audio.addEventListener('ended', () => {
    releaseMusic()
    onEnded?.()
  }, { signal })
  audio.addEventListener('pause', releaseMusic, { signal })
  audio.addEventListener('waiting', () => {
    releaseMusic()
    onWaiting?.()
  }, { signal })
  audio.addEventListener('error', failed, { signal })
  void audio.play().catch(failed)

  return () => {
    events.abort()
    unsubscribe()
    releaseMusic()
    audio.pause()
    source?.disconnect()
    gain?.disconnect()
  }
}
