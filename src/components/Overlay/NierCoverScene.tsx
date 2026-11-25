'use client'

import { Canvas, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import CoverParticleField from './CoverParticleField'

function BackgroundPlane() {
  const texture = useLoader(THREE.TextureLoader, '/images/nier_flower_field_4K.png')
  const { viewport, size } = useThree()
  const imageAspect = texture.image.width / texture.image.height
  const viewportAspect = size.width / size.height
  const coverScale =
    imageAspect > viewportAspect
      ? [imageAspect / viewportAspect, 1]
      : [1, viewportAspect / imageAspect]

  return (
    <mesh
      scale={[viewport.width * coverScale[0], viewport.height * coverScale[1], 1]}
      position={[0, 0, -4]}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

export default function NierCoverScene() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <BackgroundPlane />
        <CoverParticleField />
      </Canvas>
    </div>
  )
}
