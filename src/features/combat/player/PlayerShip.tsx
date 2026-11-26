import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { SkinnedMesh } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

const modelPath = './nier/player.glb'
export const playerShipScale: [number, number, number] = [2, 3, 2]

export function usePlayerShip() {
  const { scene } = useGLTF(modelPath)
  const ship = useMemo(() => clone(scene), [scene])
  useEffect(() => () => {
    ship.traverse(part => {
      if (part instanceof SkinnedMesh) part.skeleton.dispose()
    })
  }, [ship])
  return ship
}

export function PlayerShip() {
  const ship = usePlayerShip()
  return <primitive object={ship} scale={playerShipScale} />
}

useGLTF.preload(modelPath)
