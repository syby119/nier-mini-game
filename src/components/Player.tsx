import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useGraph } from '@react-three/fiber'
import { Html, useKeyboardControls } from '@react-three/drei';
import { playerShipScale, usePlayerShip } from './PlayerShip';
import { BallCollider, interactionGroups, quat, RapierRigidBody, RigidBody, vec3 } from '@react-three/rapier';
import * as THREE from 'three';
import PubSub from 'pubsub-js';
import { PlayerOnHitExpandingRingEffect } from './PlayerOnHitEffects';
import OtherPlayerContainer, { type SupportFormation } from './OtherPlayerContainer';
import { GamepadManager } from '../modules/GamepadManager';
import usePlayerStore from '../store/PlayerStore';
import systemInfoStore from '../store/SystemInfoStore';
import useAudioStore from '../store/AudioStore';
import { PlayerMoveEffects } from './PlayerMoveEffects';
import { useTranslations } from 'next-intl';
import { useFixedFrameUpdate } from '../hook/useFixedFrameUpdate';
import { useNotificationStore } from '../store/NotificationStore';
import { useOverlayStore } from '../store/OverlayStore';
import { useControls } from 'leva';
import { Schema } from 'leva/plugin';
import useGamePauseStore from '../store/GamePauseStore';

const normalizeAngle = (angle: number) => {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
};

const lerpAngle = (start: number, end: number, t: number) => {
    start = normalizeAngle(start);
    end = normalizeAngle(end);

    if (Math.abs(end - start) > Math.PI) {
        if (end > start) {
            start += 2 * Math.PI;
        } else {
            end += 2 * Math.PI;
        }
    }

    return normalizeAngle(start + (end - start) * t);
};

const gamepadManager = new GamepadManager(0.3);

// In the 360p recording a formation shot first appears 15 px from its ship
// and travels 32 px between volleys. The 0.15-unit orbit measures 26.3 px.
const formationMuzzleOffset = 0.085
const formationShotSpeed = 1.82

export const Player = ({ showHitControls }: { showHitControls: boolean }) => {
    // console.log('Player')
    const addNotification = useNotificationStore(state => state.addNotification);
    const setShowOverlay = useOverlayStore(state => state.setShowOverlay);
    const currentPhase = systemInfoStore(state => state.systemInfo.currentPhase);
    const spawnZ = systemInfoStore(state => state.playerSpawnZ);
    const playerInfo = usePlayerStore(state => state.playerInfo);
    const setPlayerShareInfo = usePlayerStore(state => state.setPlayerShareInfo)
    const setPlayerHealth = usePlayerStore(state => state.setPlayerHealth)
    const setPlayerToDeath = usePlayerStore(state => state.setPlayerToDeath)
    const player = useRef<any>(null);
    const rb = useRef<RapierRigidBody>(null);
    const formation = useRef<SupportFormation>(null);
    const playerRotationTarget = useRef<any>(0);
    const rotationTarget = useRef<any>(0);
    const [, get] = useKeyboardControls();
    const [speed, setSpeed] = useState<number>(0.6);
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
    const effectStartPosition = useRef<THREE.Vector3>(vec3({ x: 0, y: 0, z: 0 }));
    const effectTargetPosition = useRef<THREE.Vector3>(vec3({ x: 0, y: 0, z: 0 }));
    const isClicking = useRef<boolean>(false);
    const isShooting = useRef<boolean>(false);
    const isMoving = useRef<boolean>(false);
    const playerHitBoxRef = useRef<any>(null);
    const [playerOnHitExpandingRingHitBoxSize, setPlayerOnHitExpandingRingHitBoxSize] = useState<number>(0);
    const playerInvincibilityTime = 0.8
    const isPlayerOnHit = useRef<boolean>(false)
    const playerInvincibilityTimeAccumulatedTime = useRef<number>(0)
    const playerOnHitColorReturnNormal = useRef<boolean>(false)
    const [shootingInterval, setShootingInterval] = useState<number>(0.0986)
    const disableMove = useRef<boolean>(false)
    const resetPlayerPositionRef = useRef<boolean>(false)
    const playerLocalSummery = useRef<{
        onHitCount: number,
        totalShootCount: number,
    }>({
        onHitCount: 0,
        totalShootCount: 0,
    })
    const { play: playAudio, setVolume, stop: stopAudio } = useAudioStore();
    const t = useTranslations()
    const isPaused = useGamePauseStore(state => state.isPaused)

    const playerOptions = useCallback(() => {
        const value: Schema = {
            moveSpeed: {
                label: "Move Speed",
                value: speed,
                min: 0,
                max: 2,
                onChange: (v) => {
                    setSpeed(v)
                }
            },
            shootingInterval: {
                label: "Shooting Interval",
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
    const pPlayer = useControls('Player', playerOptions)


    const onMouseDown = (e: any) => {
        if (e.button === 0) {
            isClicking.current = true;
        }
        if ((e.button === 2 && isClicking.current)) {
            isShooting.current = true;
        }
    }
    const onMouseUp = (e: any) => {
        if (e.button === 0) {
            isClicking.current = false;
        }
        if (e.button === 2) {
            isShooting.current = false;
        }
    }
    const handleContextMenu = (event: any) => {
        event.preventDefault(); // 阻止默认的右键菜单
    };

    const shootVolley = (center: THREE.Vector3, heading: number, support: SupportFormation | null, age: number) => {
        playerLocalSummery.current.totalShootCount += 1
        const direction = vec3().set(Math.sin(heading), 0, Math.cos(heading))
        const modelAxis = vec3().set(1, 0, 0)
        const projectileRotation = quat().setFromUnitVectors(modelAxis, direction)
            .multiply(quat().setFromAxisAngle(modelAxis, Math.PI / 4))
        const speed = support ? formationShotSpeed : 2
        const muzzle = center.clone().addScaledVector(direction, support ? formationMuzzleOffset + speed * age : 0)

        const fireFrom = (position: THREE.Vector3) => {
            PubSub.publishSync('shootProjectile', { id: Math.random(), position, direction, speed, projectileRotation })
        }
        fireFrom(muzzle)
        support?.forEachReadyOffset(offset => fireFrom(offset.clone().add(muzzle)))
    }

    const playerEffectsSpawnTime = useRef(0); // 用于存储上次生成玩家特效的时间

    useEffect(() => {

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('contextmenu', handleContextMenu);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('contextmenu', handleContextMenu);
        }
    }, [])

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const lookBottom = new THREE.Vector3(0, 1, 0)

    useFixedFrameUpdate((state, delta) => {
        if (isPaused) return
        if (playerInfo.playerHealth <= 0) return
        if (disableMove.current) return
        if (rb.current) {
            const vel = rb.current?.linvel();
            const rbTranslation = rb.current.translation();
            const movement = {
                x: 0,
                z: 0
            }

            if (get().forward) movement.z = speed
            if (get().backward) movement.z = -speed
            if (get().left) movement.x = speed
            if (get().right) movement.x = -speed

            if (gamepadManager.isConnected()) {
                const leftStickX = gamepadManager.getState().axes["Left Stick Horizontal"] || 0; // 左摇杆水平轴
                const leftStickY = gamepadManager.getState().axes["Left Stick Vertical"] || 0;   // 左摇杆垂直轴

                movement.x += -leftStickX * speed; // 将手柄的输入映射到移动逻辑
                movement.z += -leftStickY * speed;
            }

            if (movement.x !== 0) {
                rotationTarget.current += 0.1 * movement.x;
            }

            if (movement.x !== 0 || movement.z !== 0) {
                playerRotationTarget.current = Math.atan2(movement.x, movement.z);
                vel.x = 1 * movement.x;
                vel.z = 1 * movement.z;
                isMoving.current = true
            } else {
                vel.x = 0;
                vel.z = 0;
                isMoving.current = false
            }

            let rotationSpeed = 0.2
            // 如果正在点击鼠标，更新玩家朝向
            if (isClicking.current) {
                // 计算鼠标在世界坐标中的位置
                mouse.x = state.pointer.x // 将指针坐标标准化到 -1 到 1
                mouse.y = state.pointer.y // 这里可能需要调整为正值以适应从上往下看的视角

                // 使用射线投射获取鼠标指向的世界坐标
                raycaster.setFromCamera(mouse, state.camera);

                // 假设地面是水平的，平面的法向量为 (0, 1, 0)
                const groundPlane = new THREE.Plane(lookBottom, 0); // 修改为 (0, 0, 1) 以适应从上往下的视角
                const intersect = raycaster.ray.intersectPlane(groundPlane, vec3());

                if (intersect) {
                    const targetPoint = intersect; // 获取鼠标目标点
                    // 计算玩家朝向的角度，注意这里可能需要调整 x 和 z 的顺序
                    playerRotationTarget.current = Math.atan2(targetPoint.x - rbTranslation.x, targetPoint.z - rbTranslation.z);
                    rotationSpeed = 0.8
                }
            }

            if (gamepadManager.isConnected()) {
                const rightStickX = gamepadManager.getState().axes["Right Stick Horizontal"] || 0; // 右摇杆水平轴
                const rightStickY = gamepadManager.getState().axes["Right Stick Vertical"] || 0;   // 右摇杆垂直轴

                // 如果右摇杆有输入，则更新玩家的朝向
                if (Math.abs(rightStickX) > 0.1 || Math.abs(rightStickY) > 0.1) { // 应用死区
                    playerRotationTarget.current = Math.atan2(-rightStickX, -rightStickY);
                    rotationSpeed = 0.4
                }
            }

            player.current.rotation.y = lerpAngle(
                player.current.rotation.y,
                playerRotationTarget.current,
                rotationSpeed
            );

            rb.current.setLinvel(vel, true);
            //spawn player movement particles
            const position = rb.current?.translation(); // 获取物理引擎中的位置
            if (position) {
                effectStartPosition.current.set(position.x, position.y, position.z);
                //effectTargetPosition是从effectStartPosition的位置开始
                // 随机方向
                const distance = 0.1;
                effectTargetPosition.current.set(
                    position.x + Math.random() * distance - distance / 2,
                    position.y + Math.random() * distance - distance / 2,
                    position.z + Math.random() * distance - distance / 2
                );
            }

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
            if (isMoving.current) {
                //每隔0.1秒生成一个特效
                playerEffectsSpawnTime.current += delta;
                if (playerEffectsSpawnTime.current >= (0.08 + Math.random() * 0.14)) {
                    playerEffectsSpawnTime.current = 0;
                    PubSub.publish('spawnPlayerMovementParticles', {
                        position: vec3(rb.current.translation())
                    })
                }
            }
        }
    })

    const shotCooldown = useRef(0)
    const previousCenter = useRef(new THREE.Vector3())
    const previousHeading = useRef(0)
    useFrame(({ viewport }, frameDelta) => {
        if (isPaused || disableMove.current || playerInfo.playerHealth <= 0 || !rb.current) return
        const delta = Math.min(frameDelta, 0.5) // Rapier's variable-step limit
        const center = vec3(rb.current.translation())
        const heading = player.current.rotation.y
        const support = formation.current
        // The formation fires on whole 60 Hz game ticks, six ticks per volley by default.
        const interval = support ? Math.round(shootingInterval * 60) / 60 : shootingInterval
        const buttons = gamepadManager.isConnected() ? gamepadManager.getState().buttons : undefined
        const firing = isShooting.current || buttons?.RB || buttons?.R1
        let wait = shotCooldown.current
        let remaining = delta

        if (firing && wait <= remaining) {
            playAudio('playerShot')
            if (wait === 0 || !support || interval === 0) wait = remaining
            // Sample each volley at its scheduled instant, including when a frame spans two volleys.
            do {
                remaining -= wait
                const fraction = delta > 0 ? remaining / delta : 0
                const shotCenter = center.clone().lerp(previousCenter.current, fraction)
                const shotHeading = lerpAngle(heading, previousHeading.current, fraction)
                support?.update(wait, shotCenter, shotHeading, viewport.width, viewport.height)
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
        if (playerHealth <= 0 || isPlayerOnHit.current || useGamePauseStore.getState().isPaused) return
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
        playerLocalSummery.current.onHitCount += 1
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
        playerHeader.material.color.set(0, 0, 0)
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
        if (rb.current && resetPlayerPositionRef.current) {
            const playerRb = rb.current;
            playerRb.setTranslation({ x: 0, y: 0, z: spawnZ }, true);
            playerRb.setLinvel({ x: 0, y: 0, z: 0 }, true);
            playerRb.setAngvel({ x: 0, y: 0, z: 0 }, true);
            player.current.position.set(0, 0, 0);
            player.current.rotation.y = 0;
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
        });
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
            player.current.visible = data
        })
        return () => {
            PubSub.unsubscribe(resetPlayerToken)
            PubSub.unsubscribe(resetPlayerPositionToken)
            PubSub.unsubscribe(setDisablePlayerMoveToken)
            PubSub.unsubscribe(setPlayerVisibleModelToken)
        }
    }, [])

    useEffect(() => {
        if (currentPhase === "end") {
            setPlayerShareInfo({
                shootCount: playerLocalSummery.current.totalShootCount,
                onHitCount: playerLocalSummery.current.onHitCount
            })
        }
    }, [currentPhase])

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
                name='player_rigidbody'
                position={[0, 0, spawnZ]}
                lockRotations
                enabledTranslations={[true, false, true]}//只允许在x和z轴上移动
                ref={rb}
                gravityScale={0}
                collisionGroups={interactionGroups(0, [100, 1, 2, 3])}
                colliders={false}
                userData={{ type: 'player' }}
            >
                <group ref={player} position={[0, 0, 0]} name='player_rigidbody_group'>
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
                        name='player_on_hit_expanding_ring_hit_box'
                        ref={playerHitBoxRef}
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
                    <OtherPlayerContainer ref={formation} pilots={playerInfo.rescuePilots} />}
            </RigidBody>
            <PlayerMoveEffects />
        </>
    );
};
