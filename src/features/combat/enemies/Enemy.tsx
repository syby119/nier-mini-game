import useAudioStore from '@/features/audio/AudioStore'
import useGamePauseStore from '@/game/state/GamePauseStore'
import { useFixedFrameUpdate } from '@/shared/three/useFixedFrameUpdate'
import { Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CollisionTarget, CuboidCollider, interactionGroups, RigidBody, vec3 } from '@react-three/rapier'
import PubSub from 'pubsub-js'
import { useEffect, useRef, useState } from 'react'
import { useTimeout } from 'react-use'
import * as THREE from 'three'
import usePlayerRigidBodyInfo from '../player/usePlayerRigidBodyInfo'
import { EnemyProps, StrongType } from './enemyTypes'

import { fireEnemyVolley, gunPorts } from './enemyWeapons'
import { GunPortMesh } from './GunPortMesh'

export const Enemy = ({
  id,
  type,
  initPosition,
  text,
  phase,
  nextPhase,
  isImportantPhase,
  isNeedChidAllDead,
  childrenIds,
  shootIntervalTime = 0.6,
  enableShoot = true,
  strongType,
  health,
  points,
  spawnDelay,
  castCredit,
  onLeave,
  onDeath = () => { }
}: EnemyProps) => {
  const [spawnDelayReady, spawnDelayCancel] = useTimeout(castCredit ? 0 : (spawnDelay || 0) * 1000)
  const playAudio = useAudioStore(state => state.play)
  const enemyRef = useRef<any>(null)
  const textRef = useRef<any>(null)
  const cuboidColliderRef = useRef<any>(null)
  const [cuboidSize, setCuboidSize] = useState<[number, number, number]>([0, 0, 0])
  const changeTextColorTime = useRef<{ value: number, enable: boolean }>({
    value: 0,
    enable: false
  })
  const shakeIntensity = useRef<number>(0)
  const shootInterval = useRef<number>(0)
  const moveToInitPositionIRef = useRef<{
    startMoveToInitPosition: boolean,
    movedToTopPosition: boolean
  }>({
    startMoveToInitPosition: false,
    movedToTopPosition: false
  })
  const moveToInitPositionSpeed = 0.02
  const movedToInitPosition = useRef<boolean>(false)
  const easyEnemyRandomOffset = {
    x: Math.random() * 2 - 1, // 随机生成 -1 到 1 的偏移量
    z: Math.random() * 2 - 1, // 随机生成 -1 到 1 的偏移量
    timeOffset: Math.random() * Math.PI * 2, // 随机时间偏移，范围 [0, 2π]
  }
  const healthRef = useRef<number>(health)
  const scrolling = castCredit === 'role' || castCredit === 'performer'
  const castTime = useRef(-(spawnDelay || 0))
  const { viewport, size } = useThree()
  const spawnEffect = useRef<boolean>(false)
  const isPause = useGamePauseStore(state => state.isPaused)
  const tempTimerRef = useRef<{
    accumulativeTime: number,
    pauseAtTime: number,
    timer: any
  }>({
    accumulativeTime: 0,
    pauseAtTime: 0,
    timer: null
  })
  const fontSize = castCredit === 'role' ? 0.03 : castCredit === 'performer' ? 0.045 :
    strongType === StrongType.EASY || strongType === StrongType.VERY_EASY ? 0.04 : 0.06
  const movedDistance = useRef<number>(0)
  //相反x轴
  let reverseX = -(initPosition.x)
  const selfMoveTargetPosition = vec3({ x: reverseX, y: 0, z: initPosition.z })

  const ports = gunPorts[strongType]
  const portMeshes = useRef<(THREE.Mesh | null)[]>([])
  const { playerInfo } = usePlayerRigidBodyInfo()

  const TextBoundingUpdate = (e: any) => {
    if (e.geometry) {
      e.geometry.computeBoundingBox()
      const size = vec3()
      e.geometry.boundingBox.getSize(size)
      // 每次都减少 size.x 的一半，是因为文字的锚点是在中心的
      size.x = size.x / 2 + 0.02
      size.y = size.y / 2 + 0.02
      setCuboidSize([size.x, size.y, 0.01])
    }
  }

  function positionGunPorts() {
    const center = enemyRef.current.translation()
    const geometry = textRef.current.geometry
    geometry.computeBoundingBox()
    const halfWidth = geometry.boundingBox.getSize(new THREE.Vector3()).x / 2
    ports.forEach(({ mount }, index) => {
      const offset = mount === 'Left' ? -halfWidth : mount === 'Right' ? halfWidth : 0
      portMeshes.current[index]?.position.set(center.x + offset, center.y, center.z)
    })
  }

  const handleTextChangeColor = () => {
    textRef.current.color = '#B9A186'
    changeTextColorTime.current.enable = true
    //抖动效果
    shakeIntensity.current = 0.018
  }

  const changeEnemyColliderGroup = (groups: number[]) => {
    enemyRef.current.collider().setCollisionGroups(interactionGroups(1, groups))
    cuboidColliderRef.current.setCollisionGroups(interactionGroups(1, groups))
  }

  const handleOnHitPlayAudio = () => {
    if (healthRef.current <= 0) return
    playAudio('enemyHit')
  }

  const enemyOnHit = (target: CollisionTarget, other: CollisionTarget) => {
    if (healthRef.current <= 0) return

    //如果是玩家则不处理
    if (other.colliderObject?.name == 'player_collider') {
      return
    }
    handleTextChangeColor()
    handleOnHitPlayAudio()
    if (other.rigidBodyObject?.userData?.type == 'player_projectile') {
      healthRef.current -= 1
      if (healthRef.current <= 0) {
        PubSub.publish('startEnemyExplosionParticle', {
          position: vec3(cuboidColliderRef.current.translation()),
          x: cuboidSize[0] * 2,
          y: cuboidSize[1],
        })
        onDeath(id, phase, nextPhase, isImportantPhase, isNeedChidAllDead, childrenIds, points)
      }
    }
    if (other.colliderObject?.name == 'player_on_hit_expanding_ring_hit_box') {
      //直接死亡
      PubSub.publish('startEnemyExplosionParticle', {
        position: vec3(cuboidColliderRef.current.translation()),
        x: cuboidSize[0] * 2,
        y: cuboidSize[1],
      })
      onDeath(id, phase, nextPhase, isImportantPhase, isNeedChidAllDead, childrenIds, points)
    }
  }

  const enableMoveToInitPositionAndShootingPortScript = () => {
    positionGunPorts()
    moveToInitPositionIRef.current.startMoveToInitPosition = true
    moveToInitPositionIRef.current.movedToTopPosition = true
  }

  const moveToInitPosition = () => {
    //获取initPosition.z的位置，并且+屏幕最顶部距离世界的位置，模拟从屏幕外进入
    const totalHight = initPosition.z + size.height / 1024
    enemyRef.current.setTranslation(vec3({ x: initPosition.x, y: initPosition.y, z: totalHight }))
    textRef.current.visible = true
    if (castCredit || spawnDelayReady()) {
      enableMoveToInitPositionAndShootingPortScript()
    }
  }

  const subCheckSpawnTime = (isPaused: boolean) => {
    if (isPaused) {
      tempTimerRef.current.timer && clearTimeout(tempTimerRef.current.timer)
      //累加暂停时间，让每次setTimeout的时间减去暂停时间
      tempTimerRef.current.pauseAtTime += tempTimerRef.current.accumulativeTime
      if (!spawnDelayReady()) {
        //clear timeout
        spawnDelayCancel()
      }
    } else {
      const _spawnDelay = spawnDelay || 0
      tempTimerRef.current.accumulativeTime = 0
      //restart timeout
      if (tempTimerRef.current.pauseAtTime > 0 && _spawnDelay > tempTimerRef.current.pauseAtTime) {
        tempTimerRef.current.timer = setTimeout(() => {
          enableMoveToInitPositionAndShootingPortScript()
          clearTimeout(tempTimerRef.current.timer)
        }, (_spawnDelay - tempTimerRef.current.pauseAtTime) * 1000)
      }
    }
  }

  const handleUpdateColorOnFrame = (delta: number) => {
    if (changeTextColorTime.current.value > 250) {
      textRef.current.color = '#E7E2DF'
      changeTextColorTime.current.value = 0
      changeTextColorTime.current.enable = false
    }
    if (changeTextColorTime.current.enable) {
      changeTextColorTime.current.value += delta * 1000
    }
  }

  const handleShakeTextOnFrame = () => {
    if (shakeIntensity.current > 0) {
      textRef.current.position.x = (Math.random() - 0.5) * shakeIntensity.current
      textRef.current.position.y = (Math.random() - 0.5) * shakeIntensity.current
      textRef.current.position.z = (Math.random() - 0.5) * shakeIntensity.current
      shakeIntensity.current *= 0.9 // 每帧减弱抖动
      if (shakeIntensity.current < 0.01) shakeIntensity.current = 0 // 停止抖动
    }
  }
  const handleShootingOnFrame = (delta: number) => {
    //射击间隔
    if (movedToInitPosition.current) {
      if (shootInterval.current > (shootIntervalTime * 1000)) {
        shootInterval.current = 0
        if (enableShoot) {
          fireEnemyVolley(strongType, portMeshes.current, playerInfo.position)
        }
      } else {
        shootInterval.current += delta * 1000
      }
    }
  }

  const handleStartMoveToInitPosition = () => {
    if (moveToInitPositionIRef.current.startMoveToInitPosition) {
      const currentPosition = vec3(enemyRef.current.translation())
      const distance = currentPosition.distanceTo(initPosition) // 计算当前位置与目标位置的距离
      if (distance > 0.1) { // 如果距离大于阈值
        const lerpedPosition = currentPosition.lerp(initPosition, moveToInitPositionSpeed)
        enemyRef.current.setTranslation(lerpedPosition)
      } else {
        const lerpedPosition = currentPosition.lerp(initPosition, 0.045)
        enemyRef.current.setTranslation(lerpedPosition)
        if (spawnEffect.current == false) {
          const spawnPosition = currentPosition.clone()
          spawnPosition.z = spawnPosition.z - 0.02
          PubSub.publish('enemySpawnEffect', {
            position: vec3(spawnPosition)
          })
          spawnEffect.current = true
          //设置碰撞组
          changeEnemyColliderGroup([0])
        }
        if (distance <= 0.1) {
          positionGunPorts()
          movedToInitPosition.current = true
        }
        if (distance <= 0.001) {
          enemyRef.current.setTranslation(initPosition)
          moveToInitPositionIRef.current.startMoveToInitPosition = false
        }
      }
    }
  }
  const tempTime = useRef<number>(0)
  const handleRandomMoveOnFrame = (delta: number) => {
    if (movedToInitPosition.current) {
      const currentPosition = vec3(enemyRef.current.translation())
      const screenTop = viewport.height / 2 // 视口顶部
      const screenBottom = 0 // 视口底部
      const screenRight = viewport.width / 2 // 视口右侧
      const screenLeft = -viewport.width / 2 // 视口左侧
      if ([StrongType.VERY_EASY, StrongType.EASY].includes(strongType)) {
        tempTime.current += delta
        const time = tempTime.current * 0.5 + easyEnemyRandomOffset.timeOffset // 使用状态中的时钟
        // 目标位置：x 和 z 轴生成无限 "∞" 的轨迹，y 始终为 0
        const targetPosition = vec3({
          x: Math.sin(time + easyEnemyRandomOffset.x) * (screenRight * 3), // x 轴加上随机偏移
          y: 0, // y 始终为 0
          z: Math.sin(time * 2 + easyEnemyRandomOffset.z) * (screenTop * 3) // z 轴加上随机偏移
        })

        // 确保目标位置不会超出屏幕范围
        targetPosition.x = Math.max(screenLeft, Math.min(screenRight, targetPosition.x)) // 限制 x 轴范围
        targetPosition.z = Math.max(screenBottom, Math.min(screenTop, targetPosition.z)) // 限制 z 轴范围

        // 平滑插值到目标位置
        const lerpedPosition = currentPosition.lerp(targetPosition, 0.01)
        enemyRef.current.setTranslation(lerpedPosition)
        positionGunPorts()
      } else if ([StrongType.MEDIUM, StrongType.HARD, StrongType.EXTREME].includes(strongType)) {
        //move to screen center
        if (selfMoveTargetPosition.x == 0) return
        const distance = currentPosition.distanceTo(selfMoveTargetPosition) // 计算当前位置与目标位置的距离
        movedDistance.current += distance
        if (movedDistance.current < 400) { // 如果距离大于阈值
          let lerpFactor = 0.0001 * movedDistance.current // 动态调整插值比例
          const lerpedPosition = currentPosition.lerp(selfMoveTargetPosition, lerpFactor)
          enemyRef.current.setTranslation(lerpedPosition)
          positionGunPorts()
        } else {
          //返回到初始位置
          movedDistance.current = 0
        }
      }
    }
  }

  useEffect(() => {
    if (cuboidSize.some((e) => e == 0)) return
    if (type == 'DEBUG' || castCredit) return
    if (enemyRef.current && textRef.current) {
      changeEnemyColliderGroup([])
      moveToInitPosition()
    }
  }, [cuboidSize, spawnDelayReady()])

  useEffect(() => {
    if (castCredit) return
    const unsubscribe = useGamePauseStore.subscribe(state => state.isPaused, subCheckSpawnTime)
    const timer = tempTimerRef.current
    return () => {
      unsubscribe()
      clearTimeout(timer.timer)
    }
  }, [])

  // Optional cast entries cross the picture in about nine seconds in the recording.
  const moveCastCredit = (age: number) => {
    if (age >= 9) {
      healthRef.current = 0
      textRef.current.visible = false
      changeEnemyColliderGroup([])
      onLeave?.(id)
      return
    }
    if (!textRef.current.visible) {
      textRef.current.visible = true
      changeEnemyColliderGroup([0])
    }
    const edge = Math.max(0, viewport.width / 2 - cuboidSize[0])
    const x = THREE.MathUtils.clamp(initPosition.x + 0.14 * Math.sin(age + initPosition.x), -edge, edge)
    enemyRef.current.setTranslation({ x, y: 0, z: viewport.height * (0.55 - 1.1 * age / 9) }, true)
  }

  useFixedFrameUpdate((state, delta) => {
    tempTimerRef.current.accumulativeTime += delta
    if (isPause) return
    if (type == 'DEBUG') return
    if (!enemyRef.current || !textRef.current) return
    if (castCredit) {
      const age = castTime.current += delta
      if (age < 0 || !cuboidSize[0] || healthRef.current <= 0) return
      if (scrolling) {
        moveCastCredit(age)
        return
      }
      if (!textRef.current.visible) moveToInitPosition()
    }
    handleUpdateColorOnFrame(delta)
    handleShakeTextOnFrame()
    handleShootingOnFrame(delta)
    ports.forEach((port, index) => {
      const mesh = portMeshes.current[index]
      if (mesh) mesh.rotation.z += port.turnPerTick
    })
    handleStartMoveToInitPosition()
    handleRandomMoveOnFrame(delta)
  })

  return (
    <group>
      <RigidBody
        ref={enemyRef}
        position={[0, 0, 2]}
        gravityScale={0}
        type="kinematicPosition"
        collisionGroups={interactionGroups(1, [])}

        onCollisionEnter={({ manifold, target, other }) => {
          enemyOnHit(target, other)
        }}
        friction={0}
        userData={{ type: 'enemy_rigidbody' }}
        rotation={[Math.PI / -2, 0, Math.PI]}
      >
        <CuboidCollider args={cuboidSize} ref={cuboidColliderRef} collisionGroups={interactionGroups(1, [])} />
        <Text
          font={'./nier/fonts/Manrope-Light.ttf'}
          color="#E7E2DF"
          anchorX="center"
          anchorY="middle"
          fontSize={fontSize}
          textAlign="center"
          ref={textRef}
          onSync={TextBoundingUpdate}
          sdfGlyphSize={128}
          visible={false}
        >
          {text}
        </Text>
      </RigidBody>
      <group name={`${strongType.toLowerCase()}EnemyShootingPort`}>
        {ports.map((port, index) => (
          <GunPortMesh key={port.name} port={port} meshRef={mesh => { portMeshes.current[index] = mesh }} />
        ))}
      </group>
    </group>
  )
}
