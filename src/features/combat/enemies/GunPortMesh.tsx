import type { Ref } from 'react'
import type { Mesh } from 'three'
import type { GunPort } from './enemyWeapons'

export function GunPortMesh({ port, meshRef }: { port: GunPort, meshRef: Ref<Mesh> }) {
  const aimed = port.turnPerTick === 0
  return (
    <mesh ref={meshRef} name={port.name} visible={false}
      rotation={aimed ? [0, 0, 0] : [-Math.PI / 2, 0, port.diagonal ? Math.PI / 4 : 0]}>
      {aimed ? <boxGeometry args={[0.05, 0.05, 0.05]} /> : <planeGeometry args={[0.05, 0.05]} />}
      <meshStandardMaterial color="white" transparent opacity={0.2} />
    </mesh>
  )
}
