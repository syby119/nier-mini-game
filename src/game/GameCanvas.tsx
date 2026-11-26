import { CombatObjects } from '@/features/combat/CombatObjects'
import { EnemySystem } from '@/features/combat/enemies/EnemySystem'
import { Player } from '@/features/combat/player/Player'
import CustomLevaPanel from '@/features/developer/CustomLevaPanel'
import { isGameClear } from '@/features/saves/isGameClear'
import { KeyboardControls, OrbitControls, PerformanceMonitor, Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Leva, useControls } from 'leva'
import { Schema } from 'leva/dist/declarations/src/types/public'
import { Perf } from 'r3f-perf'
import { useMemo, useState } from 'react'
import { NoToneMapping } from 'three'
import GamePauseSystem from './GamePauseSystem'
import PlayTimerCounter from './PlayTimerCounter'
import AirWall from './scene/AirWall'
import CameraEffectsSystem from './scene/CameraEffectsSystem'
import { FontPreloader } from './scene/FontPreloader'
import { SceneEffects } from './scene/SceneEffects'
import { ScenePostprocessing } from './scene/ScenePostprocessing'
import systemInfoStore from './state/SystemInfoStore'

const keyboardMap = [
  { name: 'forward', keys: ['KeyW'] },
  { name: 'backward', keys: ['KeyS'] },
  { name: 'left', keys: ['KeyA'] },
  { name: 'right', keys: ['KeyD'] },
  { name: 'escape', keys: ['Escape'] },
]

export default function GameCanvas() {
  const gameStarted = systemInfoStore((state) => state.gameStarted)
  const postEffects = systemInfoStore((state) => state.postEffects)
  const setPostEffects = systemInfoStore((state) => state.setPostEffects)
  const [dpr, setDpr] = useState(1)

  const sceneOptions = useMemo(() => {
    const sceneDebugOption: Schema = {
      bgColor: {
        label: 'Background Color',
        value: '#22201C',
      },
      postEffects: {
        label: 'Post Effects',
        value: postEffects,
        onChange: (value: boolean) => {
          setPostEffects(value)
        }
      },
    }
    return sceneDebugOption
  }, [])
  const debugOptions = useMemo(() => {
    const value: Schema = {
      r3f_perf: {
        label: 'r3f-perf',
        value: process.env.NODE_ENV === 'development',
      },
      threeStats: {
        label: 'Stats',
        value: process.env.NODE_ENV === 'development',
      },
      freeCamera: {
        label: 'Free Camera',
        value: false,
      },
      hitBoxDebug: {
        label: 'Hit Box Debug',
        value: false,
      }
    }
    return value
  }, [])

  const pScene: any = useControls('Scene', sceneOptions)
  const pDebug: any = useControls('Debug', debugOptions)

  return (
    <KeyboardControls map={keyboardMap}>
      <Leva collapsed={true} hidden={!isGameClear()} />
      <Canvas

        dpr={dpr}
        camera={{ position: [0, 2.2, 0], fov: 50, rotation: [-Math.PI / 2, 0, Math.PI], near: 0.1, far: 1000 }}
        gl={{
          toneMapping: NoToneMapping,
          powerPreference: 'high-performance',
        }}
      >
        <PerformanceMonitor onIncline={() => setDpr(1)} onDecline={() => setDpr(0.75)} />
        <CustomLevaPanel />
        <ambientLight intensity={4.1} color={'#E1DECE'} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={1} />
        <color attach="background" args={[pScene.bgColor]} />
        <FontPreloader />
        <Physics debug={pDebug.hitBoxDebug} timeStep={'vary'}>
          {/* timeStep = vary 是为了避免当前帧率低于设置的值，可能会导致物理更新滞后，影响流畅性 */}
          <AirWall />
          {gameStarted && <Player showHitControls={pDebug.hitBoxDebug} />}
          {gameStarted && <EnemySystem />}
          {gameStarted && <CombatObjects />}
        </Physics>
        <CameraEffectsSystem />
        <PlayTimerCounter />
        {pDebug.freeCamera && <OrbitControls />}
        <SceneEffects />
        {postEffects && <ScenePostprocessing />}
        {pDebug.r3f_perf && <Perf position="top-left" style={{ marginTop: '3rem' }} />}
        {pDebug.threeStats && <Stats />}
      </Canvas>
      <GamePauseSystem />
    </KeyboardControls >
  )
}
