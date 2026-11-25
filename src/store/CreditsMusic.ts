import { Howl } from 'howler'

// These sections share the same tempo. The recording keeps the music running
// through retries and brings in the choir on the current musical phrase.
const phrase = 25.945
const choirStart = 188
const loopLength = phrase * 3
let track: Howl | undefined
let playing: number | undefined
let choir = false
let volume = .3

function getTrack() {
  if (!track) {
    track = new Howl({
      src: ['/nier/sound/music/ending-e-credits.mp3'],
      html5: true, preload: false, volume,
      sprite: {
        opening: [0, choirStart * 1000],
        solo: [(choirStart - loopLength) * 1000, loopLength * 1000, true],
        choir: [choirStart * 1000, loopLength * 1000, true],
      },
    })
    const music = track
    music.on('playerror', id => {
      music.once('unlock', () => { if (playing === id) music.play(id) })
    })
  }
  return track
}

export function startCreditsMusic() {
  if (playing !== undefined) return
  const music = getTrack()
  if (music.state() === 'unloaded') music.load()
  choir = false
  const opening = music.play('opening')
  playing = opening
  music.volume(volume, opening)
  music.once('end', () => {
    if (playing === opening) {
      playing = music.play('solo')
      music.volume(volume, playing)
    }
  }, opening)
}

export function joinCreditsChoir() {
  if (choir) return
  const music = getTrack()
  const previous = playing
  const current = previous === undefined ? 0 : Number(music.seek(previous))
  const offset = ((current - choirStart) % phrase + phrase) % phrase
  if (previous !== undefined) fadeOut(music, previous, 1000)
  const id = music.play('choir')
  playing = id
  choir = true
  music.volume(0, id)
  music.once('seek', () => { if (playing === id && volume > 0) music.fade(0, volume, 1000, id) }, id)
  music.seek(choirStart + offset, id)
}

function fadeOut(music: Howl, id: number, duration: number) {
  const level = Number(music.volume(id))
  if (!level) { music.stop(id); return }
  music.once('fade', () => music.stop(id), id)
  music.fade(level, 0, duration, id)
}

export function stopCreditsMusic() {
  const id = playing
  playing = undefined
  choir = false
  if (track && id !== undefined) fadeOut(track, id, 650)
}

export function setCreditsVolume(next: number) {
  volume = next
  if (track && playing !== undefined) track.volume(next, playing)
}
