import useAudioStore from '@/features/audio/AudioStore'
import { stopCreditsMusic } from '@/features/audio/CreditsMusic'
import { EnemyData } from '@/features/combat/enemies/waves/EnemyData'
import usePlayerStore from '@/features/combat/player/PlayerStore'
import { useNotificationStore } from '@/game/state/NotificationStore'
import systemInfoStore from '@/game/state/SystemInfoStore'
import { button, useControls } from 'leva'
import { filePicker } from 'leva-file-picker'
import { Schema } from 'leva/dist/declarations/src/types/public'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { navigateToStage } from './developerStages'

export default function CustomLevaPanel() {
  const setCurrentPhase = systemInfoStore(state => state.setCurrentPhase)
  const currentPhase = systemInfoStore(state => state.systemInfo.currentPhase)
  const updatePlayerInfo = usePlayerStore(state => state.updatePlayerInfo)
  const respawnPlayer = usePlayerStore(state => state.respawnPlayer)
  const resetPlayerInfo = usePlayerStore(state => state.resetPlayerInfo)
  const needOtherPlayerHelp = usePlayerStore(state => state.playerInfo.needOtherPlayerHelp)
  const { initVolume, play: playAudio, setAllVolume, stop: stopAudio, addSound, removeSound, removeSoundByType, sounds } = useAudioStore()
  const addNotification = useNotificationStore(state => state.addNotification)
  const firstLoad = useRef(true)
  const phaseData = useMemo(() => {
    return Array.from(new Set(EnemyData.map(e => e.phase)))
  }, [])

  function onFileChange(file: File) {
    if (!file) {
      // 如果 file 为 null 或 undefined，进入移除逻辑
      removeSoundByType('music')
      return
    }
    stopCreditsMusic()
    if (sounds[file.name]) {
      stopAudio(file.name)
      removeSoundByType('music')
    }
    addSound(file.name, URL.createObjectURL(file), {
      type: 'music',
      loop: true,
    })
    playAudio(file.name)
  }


  const accept = {
    'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a']
  }

  const systemOptions = useCallback(() => {
    const value: Schema = {
      'Music': filePicker({ onChange: onFileChange, accept }),
      // 'Music Volume': filePicker({ onChange, accept }),
      effectVolume: {
        label: 'Effect Volume',
        value: initVolume,
        min: 0,
        max: 1,
        onChange: (v) => {
          setAllVolume(v)
        }
      }
    }
    return value
  }, [setAllVolume, stopAudio, removeSound, addSound, playAudio, initVolume, firstLoad])

  const debugOptions = useCallback(() => {
    const value: Schema = {
      phase: {
        label: 'Phase',
        value: currentPhase,
        options: phaseData,
        onChange: (v, _path, { initial }) => {
          if (!v || initial) return
          if (process.env.NODE_ENV === 'development') {
            navigateToStage(v, usePlayerStore.getState().playerInfo.needOtherPlayerHelp)
            return
          }
          setCurrentPhase(v)
          addNotification(`Jump to ${v} phase`)
        }
      },
      'Jump To final': button((get) => {
        if (process.env.NODE_ENV === 'development') {
          navigateToStage('final', usePlayerStore.getState().playerInfo.needOtherPlayerHelp)
          return
        }
        PubSub.publish('resetEnemiesData', {
          type: 'resetPhase',
          phase: 'final'
        })
        addNotification(`Jump to final phase`)
      }),
      'Clear Enemy': button((get) => {
        PubSub.publish('resetEnemiesData', {
          type: 'empty'
        })
        addNotification(`Clear all enemies`)
      }),
      help: {
        label: 'Help',
        value: needOtherPlayerHelp,
        onChange: (v) => {
          if (firstLoad.current) return
          console.log(v)
          updatePlayerInfo({ needOtherPlayerHelp: v })
          addNotification(`Set other player to help: ${v}`)
        }
      },
      'Reset Player': button(() => {
        resetPlayerInfo()
        addNotification(`Reset player`)
      }),
      'Respawn Player': button(() => {
        respawnPlayer()
        addNotification(`Respawn player`)
      }),
    }
    return value
  }, [])

  useControls('System', systemOptions)
  useControls('Debug', debugOptions)

  useEffect(() => {
    firstLoad.current = false
  }, [])

  return (
    <></>
  )
}
