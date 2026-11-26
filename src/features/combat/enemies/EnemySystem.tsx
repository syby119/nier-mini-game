import useAudioStore from '@/features/audio/AudioStore'
import { finishBattle } from '@/game/battleSession'
import { useOverlayStore } from '@/game/state/OverlayStore'
import systemInfoStore from '@/game/state/SystemInfoStore'
import PubSub from 'pubsub-js'
import React, { useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import usePlayerStore from '../player/PlayerStore'
import { Enemy } from './Enemy'
import type { EnemyDefinition } from './enemyTypes'
import { EnemyData } from './waves/EnemyData'


export const EnemySystem = React.memo(() => {
  const currentPhase = systemInfoStore(state => state.systemInfo.currentPhase)
  const setImportantPhaseRecord = systemInfoStore(state => state.setImportantPhaseRecord)
  const setCurrentPhase = systemInfoStore(state => state.setCurrentPhase)
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const addCombatStats = usePlayerStore(state => state.addCombatStats)
  const updatePlayerInfo = usePlayerStore(state => state.updatePlayerInfo)
  const playerHealth = usePlayerStore(state => state.playerInfo.playerHealth)
  const [enemiesMap, setEnemiesMap] = useState<Map<string, EnemyDefinition>>(new Map())
  const pendingEnemies = useRef<Set<string>>(new Set())
  const timersRef = useRef<Set<number>>(new Set())
  const defeatedEnemyIds = useRef<Set<string>>(new Set())
  const { play: playAudio } = useAudioStore()

  const spawnWave = (phase: string) => {
    const wave = EnemyData.filter(enemy => enemy.phase === phase)
    if (!wave.length) return
    if (wave.some(enemy => enemy.isImportantPhase)) setImportantPhaseRecord(phase)
    setEnemiesMap(active => {
      const next = new Map(active)
      for (const enemy of wave) {
        if (!next.has(enemy.id)) next.set(enemy.id, enemy)
      }
      return next
    })
  }

  function schedule(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer)
      callback()
    }, delay)
    timersRef.current.add(timer)
  }

  function cancelTimers() {
    timersRef.current.forEach(timer => window.clearTimeout(timer))
    timersRef.current.clear()
  }

  const debouncedPhaseUpdate = useDebouncedCallback(
    spawnWave,
    500
  )

  useEffect(() => {
    if (playerHealth > 0) {
      debouncedPhaseUpdate(currentPhase)
    }
  }, [currentPhase, debouncedPhaseUpdate])

  useEffect(() => {
    const reset = PubSub.subscribe('resetEnemiesData', (_, request: { type: string, phase?: string }) => {
      cancelTimers()
      debouncedPhaseUpdate.cancel()
      defeatedEnemyIds.current.clear()
      pendingEnemies.current.clear()
      if (request?.type === 'empty' || request?.type === 'resetPhase') setEnemiesMap(new Map())
      if (request?.type === 'resetPhase') {
        const phase = request.phase ?? systemInfoStore.getState().systemInfo.currentPhase
        schedule(() => spawnWave(phase), 200)
      }
    })
    return () => {
      cancelTimers()
      debouncedPhaseUpdate.cancel()
      PubSub.unsubscribe(reset)
    }
  }, [debouncedPhaseUpdate])

  const handleFinalEnemyOnDeath = () => {
    schedule(() => {
      setOverlay('scoreTransition', true)
      updatePlayerInfo({ needOtherPlayerHelp: false })
    }, 3000)
    schedule(() => {
      PubSub.publish('setDisablePlayerMove', true)
      PubSub.publish('setPlayerVisibleModel', false)
    }, 4000)
  }

  const removeEnemy = (id: string) => {
    setEnemiesMap(prev => {
      if (!prev.has(id)) return prev
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  const enemyOnDeath = (
    id: string,
    _phase?: string,
    nextPhase?: string,
    _isImportantPhase?: boolean,
    isNeedChidAllDead?: boolean,
    childrenIds?: string[],
    points: number = 0
  ) => {
    //避免同个敌人多次死亡
    if (defeatedEnemyIds.current.has(id)) {
      removeEnemy(id)
      return
    }
    addCombatStats({ points, enemiesDefeated: 1 })
    defeatedEnemyIds.current.add(id)
    playAudio('coreExplode1')
    if (id == 'enemy_final') {
      finishBattle('cleared')
      handleFinalEnemyOnDeath()
    }
    checkPendingEnemies({
      id,
      nextPhase,
      isNeedChidAllDead,
      childrenIds
    })
    removeEnemy(id)
  }

  const checkPendingEnemies = (deadEnemy: {
    id: string,
    nextPhase?: string,
    isNeedChidAllDead?: boolean,
    childrenIds?: string[]
  }) => {
    // Several enemies can be defeated before React renders the updated map.
    const allChildrenDefeated = (ids: string[] = []) =>
      ids.every(childId => defeatedEnemyIds.current.has(childId))

    pendingEnemies.current.forEach(id => {
      const enemy = EnemyData.find(e => e.id === id)
      if (enemy?.nextPhase && allChildrenDefeated(enemy.childrenIds)) {
        pendingEnemies.current.delete(id)
        setCurrentPhase(enemy.nextPhase)
      }
    })

    if (!deadEnemy.nextPhase) return
    if (deadEnemy.isNeedChidAllDead && !allChildrenDefeated(deadEnemy.childrenIds)) {
      pendingEnemies.current.add(deadEnemy.id)
    } else {
      setCurrentPhase(deadEnemy.nextPhase)
    }
  }

  return (
    <>
      {Array.from(enemiesMap.values()).map(enemy => (
        <Enemy
          key={enemy.id}
          {...enemy}
          onDeath={enemyOnDeath}
          onLeave={removeEnemy}
        />
      ))}
    </>
  )
})
