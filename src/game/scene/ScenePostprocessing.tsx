import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector2 } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'

export function ScenePostprocessing() {
  const { camera, gl, scene } = useThree()
  const composer = useRef<EffectComposer>(null)

  useEffect(() => {
    const { innerWidth: width, innerHeight: height } = window
    const pipeline = new EffectComposer(gl)
    pipeline.addPass(new RenderPass(scene, camera))
    pipeline.addPass(new UnrealBloomPass(new Vector2(width, height), 0.5, 0.4, 0.85))
    pipeline.addPass(new SSAOPass(scene, camera, width, height))
    pipeline.addPass(new SMAAPass(width, height))
    pipeline.addPass(new OutputPass())
    pipeline.setSize(width, height)
    composer.current = pipeline
    return () => {
      composer.current = null
      pipeline.passes.forEach(pass => pass.dispose())
      pipeline.dispose()
    }
  }, [gl, scene, camera])

  useFrame(() => composer.current?.render(), 1)
  return null
}
