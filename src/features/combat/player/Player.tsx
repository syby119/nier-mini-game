import useAudioStore from '@/features/audio/AudioStore'
import useGamePauseStore from '@/game/state/GamePauseStore'
import { useNotificationStore } from '@/game/state/NotificationStore'
import { useOverlayStore } from '@/game/state/OverlayStore'
import systemInfoStore from '@/game/state/SystemInfoStore'
import { gamepadManager } from '@/shared/input/GamepadManager'
import { useFixedFrameUpdate } from '@/shared/three/useFixedFrameUpdate'
import { Html } from '@react-three/drei'
import { useFrame, useGraph } from '@react-three/fiber'
import { BallCollider, interactionGroups, RapierRigidBody, RigidBody, vec3 } from '@react-three/rapier'
import { useControls } from 'leva'
import { Schema } from 'leva/plugin'
import { useTranslations } from 'next-intl'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PlayerMoveEffects } from '../effects/PlayerMoveEffects'
import { PlayerOnHitExpandingRingEffect } from '../effects/PlayerOnHitEffects'
import { playerShipScale, usePlayerShip } from './PlayerShip'
import usePlayerStore from './PlayerStore'
import SupportWingmen, { type SupportFormation } from './SupportWingmen'

import { shootVolley } from './shootVolley'
import { lerpAngle } from './heading'
import { useFlightControls } from './useFlightControls'

export const Player = ({ showHitControls }: { showHitControls: boolean }) => {
  const addNotification = useNotificationStore(state => state.addNotification)
  const setShowOverlay = useOverlayStore(state => state.setShowOverlay)
  const spawnZ = systemInfoStore(state => state.playerSpawnZ)
  const playerInfo = usePlayerStore(state => state.playerInfo)
  const addCombatStats = usePlayerStore(state => state.addCombatStats)
  const setPlayerHealth = usePlayerStore(state => state.setPlayerHealth)
  const setPlayerToDeath = usePlayerStore(state => state.setPlayerToDeath)
  const player = useRef<THREE.Group>(null)
  const rb = useRef<RapierRigidBody>(null)
  const formation = useRef<SupportFormation>(null)
  const controls = useFlightControls()
  const [speed, setSpeed] = useState<number>(0.6)
  const playerModel = usePlayerShip()
  const { nodes: playerNodes } = useGraph(playerModel)
  const playerHeader = playerNodes.Header as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  const healthyMaterial = useMemo(() => playerHeader.material, [playerHeader])
  useLayoutEffect(() => {
    // Only the player's header changes color on damage.
    playerHeader.material = healthyMaterial.clone()
    return () => {
      playerHeader.material.dispose()
      playerHeader.material = healthyMaterial
    }
  }, [playerHeader, healthyMaterial])
  const [playerOnHitExpandingRingHitBoxSize, setPlayerOnHitExpandingRingHitBoxSize] = useState<number>(0)
  const playerInvincibilityTime = 0.8
  const isPlayerOnHit = useRef<boolean>(false)
  const playerInvincibilityTimeAccumulatedTime = useRef<number>(0)
  const playerOnHitColorReturnNormal = useRef<boolean>(false)
  const [shootingInterval, setShootingInterval] = useState<number>(0.0986)
  const disableMove = useRef<boolean>(false)
  const resetPlayerPositionRef = useRef<boolean>(false)
  const playAudio = useAudioStore(state => state.play)
  const t = useTranslations()
  const isPaused = useGamePauseStore(state => state.isPaused)

  const playerOptions = useCallback(() => {
    const value: Schema = {
      moveSpeed: {
        label: 'Move Speed',
        value: speed,
        min: 0,
        max: 2,
        onChange: (v) => {
          setSpeed(v)
        }
      },
      shootingInterval: {
        label: 'Shooting Interval',
        value: shootingInterval,
        min: 0,
        max: 1,
        onChange: (v) => {
          setShootingInterval(v)
        }
      }
    }
    return value
  }, [])
  useControls('Player', playerOptions)


  const playerEffectsSpawnTime = useRef(0)

  useFixedFrameUpdate((state, delta) => {
    if (isPaused || playerInfo.playerHealth <= 0 || disableMove.current || !rb.current || !player.current) return
    const moving = controls.move(state, rb.current, player.current, speed)

    //如果玩家被击中
    if (isPlayerOnHit.current) {
      playerInvincibilityTimeAccumulatedTime.current += delta
      if (playerOnHitExpandingRingHitBoxSize < 0.4) {
        setPlayerOnHitExpandingRingHitBoxSize(prev => prev + 0.009)
      }
      if (playerInvincibilityTimeAccumulatedTime.current >= playerInvincibilityTime) {
        isPlayerOnHit.current = false
        playerInvincibilityTimeAccumulatedTime.current = 0
        setPlayerOnHitExpandingRingHitBoxSize(0)
      }
    }

    if (playerOnHitColorReturnNormal.current) {
      //如果玩家被击中后，颜色变黑色，在useFrame内逐渐恢复颜色
      const headerColor = playerHeader.material.color
      if (headerColor.r < 0.5 && headerColor.g < 0.5 && headerColor.b < 0.5) {
        headerColor.setRGB(headerColor.r + 0.002, headerColor.g + 0.002, headerColor.b + 0.002)
      } else {
        playerOnHitColorReturnNormal.current = false
      }
    }

    //如果玩家移动
    if (moving) {
      //每隔0.1秒生成一个特效
      playerEffectsSpawnTime.current += delta
      if (playerEffectsSpawnTime.current >= (0.08 + Math.random() * 0.14)) {
        playerEffectsSpawnTime.current = 0
        PubSub.publish('spawnPlayerMovementParticles', {
          position: vec3(rb.current.translation())
        })
      }
    }
  })

  const shotCooldown = useRef(0)
  const previousCenter = useRef(new THREE.Vector3())
  const previousHeading = useRef(0)
  useFrame(({ viewport }, frameDelta) => {
    if (isPaused || disableMove.current || playerInfo.playerHealth <= 0 || !rb.current || !player.current) return
    const delta = Math.min(frameDelta, 0.5) // Rapier's variable-step limit
    const center = vec3(rb.current.translation())
    const heading = player.current.rotation.y
    const support = formation.current
    // The formation fires on whole 60 Hz game ticks, six ticks per volley by default.
    const interval = support ? Math.round(shootingInterval * 60) / 60 : shootingInterval
    let wait = shotCooldown.current
    let remaining = delta

    if (controls.isFiring() && wait <= remaining) {
      playAudio('playerShot')
      if (wait === 0 || !support || interval === 0) wait = remaining
      // Sample each volley at its scheduled instant, including when a frame spans two volleys.
      do {
        remaining -= wait
        const fraction = delta > 0 ? remaining / delta : 0
        const shotCenter = center.clone().lerp(previousCenter.current, fraction)
        const shotHeading = lerpAngle(heading, previousHeading.current, fraction)
        support?.update(wait, shotCenter, shotHeading, viewport.width, viewport.height)
        addCombatStats({ shootCount: 1 })
        shootVolley(shotCenter, shotHeading, support, remaining)
        wait = interval
      } while (interval > 0 && wait <= remaining)
    }
    shotCooldown.current = Math.max(0, wait - remaining)
    if (remaining > 0) support?.update(remaining, center, heading, viewport.width, viewport.height)
    previousCenter.current.copy(center)
    previousHeading.current = heading
  })

  const onHit = () => {
    const { playerHealth, needOtherPlayerHelp } = usePlayerStore.getState().playerInfo
    if (playerHealth <= 0 || isPlayerOnHit.current || useGamePauseStore.getState().isPaused ||
      systemInfoStore.getState().systemInfo.currentPhase === 'end') return
    const loss = needOtherPlayerHelp ? formation.current?.sacrificeWingman() : undefined
    if (needOtherPlayerHelp && !loss) return
    isPlayerOnHit.current = true
    playerInvincibilityTimeAccumulatedTime.current = 0
    setPlayerOnHitExpandingRingHitBoxSize(0)
    if (gamepadManager.isVibrationSupported()) gamepadManager.vibrate(500, 0.7, 0.6)
    PubSub.publish('startOnHitCameraEffect', {})

    if (loss) {
      playAudio('playerExplode')
      PubSub.publish('startPlayerDeathEffect', { position: loss.position })
      PubSub.publish('playerOnHitEffect', { position: loss.position })
      addNotification(`${t('hasLost')}${loss.pilot}${t("'sData")}`)
      return
    }

    const position = vec3(rb.current?.translation())
    setPlayerHealth(playerHealth - 1)
    addCombatStats({ onHitCount: 1 })
    if (playerHealth === 1) {
      playerNodes.Center.visible = false
      playerNodes.Header.visible = false
      PubSub.publish('startPlayerDeathEffect', { position })
      playAudio('playerExplode')
      isPlayerOnHit.current = false
      disableMove.current = true
      rb.current?.setEnabled(false)
      setPlayerToDeath()
      setShowOverlay('continueOverlay', true)
      return
    }

    const side = playerHealth === 3 ? 'L' : 'R'
    playerNodes[side + '_MOMO_1'].visible = false
    playerNodes[side + '_ASHI'].visible = false
    PubSub.publish('playerOnHitEffect', { position })
    playAudio('playerHit')
    playerHeader.material.color.setRGB(0, 0, 0)
    playerOnHitColorReturnNormal.current = true
  }

  const resetPlayerModel = () => {
    playerHeader.material.color.copy(healthyMaterial.color)
    playerOnHitColorReturnNormal.current = false
    isPlayerOnHit.current = false
    playerInvincibilityTimeAccumulatedTime.current = 0
    setPlayerOnHitExpandingRingHitBoxSize(0)
    playerNodes['L_MOMO_1'].visible = true
    playerNodes['L_ASHI'].visible = true
    playerNodes['R_MOMO_1'].visible = true
    playerNodes['R_ASHI'].visible = true
    playerNodes['Center'].visible = true
    playerNodes['Header'].visible = true
  }
  useFixedFrameUpdate(() => {
    if (isPaused) return
    if (rb.current && player.current && resetPlayerPositionRef.current) {
      const playerRb = rb.current
      playerRb.setTranslation({ x: 0, y: 0, z: spawnZ }, true)
      playerRb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      playerRb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      player.current.position.set(0, 0, 0)
      player.current.rotation.y = 0
      shotCooldown.current = 0
      resetPlayerPositionRef.current = false
    }
  })

  useEffect(() => {
    const resetPlayerToken = PubSub.subscribe('resetPlayerModel', () => {
      resetPlayerModel()
    })
    const resetPlayerPositionToken = PubSub.subscribe('resetPlayerPosition', () => {
      resetPlayerPositionRef.current = true
    })
    const setDisablePlayerMoveToken = PubSub.subscribe('setDisablePlayerMove', (msg: any, data: boolean = true) => {
      if (data) {
        rb.current?.sleep()
      } else {
        rb.current?.wakeUp()
        rb.current?.setEnabled(true)
      }
      disableMove.current = data
    })
    const setPlayerVisibleModelToken = PubSub.subscribe('setPlayerVisibleModel', (msg: any, data: boolean = true) => {
      if (player.current) player.current.visible = data
    })
    return () => {
      PubSub.unsubscribe(resetPlayerToken)
      PubSub.unsubscribe(resetPlayerPositionToken)
      PubSub.unsubscribe(setDisablePlayerMoveToken)
      PubSub.unsubscribe(setPlayerVisibleModelToken)
    }
  }, [])

  const resetPlayerVelocity = () => {
    if (rb.current) {
      rb.current.setLinvel(vec3({ x: 0, y: 0, z: 0 }), true)
    }
  }
  useEffect(() => useGamePauseStore.subscribe(
    state => state.isPaused, resetPlayerVelocity
  ), [])

  return (
    <>
      <RigidBody
        name="player_rigidbody"
        position={[0, 0, spawnZ]}
        lockRotations
        enabledTranslations={[true, false, true]}//只允许在x和z轴上移动
        ref={rb}
        gravityScale={0}
        collisionGroups={interactionGroups(0, [100, 1, 2, 3])}
        colliders={false}
        userData={{ type: 'player' }}
      >
        <group ref={player} position={[0, 0, 0]} name="player_rigidbody_group">
          <primitive object={playerModel} scale={playerShipScale} />
          <BallCollider
            collisionGroups={interactionGroups(0, [100, 1, 2, 3])}
            name="player_collider"
            args={[0.048]} // 动态调整球体碰撞体的半径
            onCollisionEnter={({ other }) => {
              const type = other.rigidBodyObject?.userData.type
              if (type === 'enemy_normal_projectile' || type === 'enemy_unbroken_projectile') onHit()
            }}
          />
          <BallCollider
            collisionGroups={interactionGroups(0, [1, 2, 3])}//不和墙壁碰撞
            name="player_on_hit_expanding_ring_hit_box"
            args={[playerOnHitExpandingRingHitBoxSize]} // 动态调整球体碰撞体的半径
          />
          <PlayerOnHitExpandingRingEffect />
          {process.env.NODE_ENV === 'development' && showHitControls && <Html>
            <button className="text-white top-5 absolute" onClick={onHit}>
              OnHIt
            </button>
            <button className="text-white top-10 absolute" onClick={() => {
              console.log(playerInfo)
            }}>
              get player
            </button>
          </Html>}
        </group>
        {playerInfo.needOtherPlayerHelp && playerInfo.playerHealth > 0 &&
          <SupportWingmen ref={formation} pilots={playerInfo.rescuePilots} />}
      </RigidBody>
      <PlayerMoveEffects />
    </>
  )
}
