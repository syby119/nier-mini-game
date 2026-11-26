import { createLine } from '@/shared/three/createLine'
import { useFixedFrameUpdate } from '@/shared/three/useFixedFrameUpdate'
import { euler, vec3 } from '@react-three/rapier'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BatchedMesh } from 'three'
import { HitEffectExpandingRingEffects } from './HitEffectExpandingRingEffects'

// Constants
const ANIMATION_COUNT = 5
const TOTAL_PHASES = 8
const SCALE = 1.3
const EMISSIVE_INTENSITY = 0.047
const EFFECT_UPDATE_INTERVAL = 1 // frame

// Animation configuration
interface AnimationState {
  position: THREE.Vector3
  enabled: boolean
  animationIndex: number
}


export const HitEffects = () => {
  const batchedMeshRef = useRef<BatchedMesh>(null)
  const animationsIndexRef = useRef<number>(-1)
  const animationsRef = useRef<AnimationState[]>([])

  // Reusable objects to avoid garbage collection
  const reusableMatrix4 = useMemo(() => new THREE.Matrix4(), [])
  const reusableQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const reusableEuler = useMemo(() => new THREE.Euler(), [])

  // Cached geometries and materials
  const geometries = useMemo(() => ({
    plane: new THREE.PlaneGeometry(0.02, 0.13),
    ring: new THREE.RingGeometry(0.040, 0.056, 32),
    smallPlane: new THREE.PlaneGeometry(0.04, 0.04),
  }), [])

  const materials = useMemo(() => ({
    plane: new THREE.MeshStandardMaterial({
      color: 'white',
      emissive: 'lightblue',
      emissiveIntensity: EMISSIVE_INTENSITY,
    }),
    ring: new THREE.MeshStandardMaterial({
      color: 'white',
      emissive: 'lightblue',
      emissiveIntensity: EMISSIVE_INTENSITY + 0.005,
    }),
    transparentPlane: new THREE.MeshStandardMaterial({
      color: 'white',
      opacity: 0.1,
      transparent: true
    }),
    solidPlane: new THREE.MeshStandardMaterial({
      color: 'white',
      opacity: 1,
      transparent: true
    }),
  }), [])

  // Optimized helper functions
  const createPlane = useCallback((position: THREE.Vector3, rotation: THREE.Euler, size: number, material?: THREE.Material) => {
    const geometry = new THREE.PlaneGeometry(size, size)
    const mat = material || materials.plane
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    return mesh
  }, [materials.plane])

  const createDashedLine = useCallback((position: THREE.Vector3, rotation: THREE.Euler, length: number, dashSize: number, gapSize: number, lineWidth: number) => {
    const line = createLine([[-length, 0, 0], [length, 0, 0]], 'white', true, dashSize, gapSize, lineWidth)
    line.position.copy(position)
    line.rotation.copy(rotation)
    return line
  }, [])

  const createSolidLine = useCallback((start: THREE.Vector3, end: THREE.Vector3, lineWidth: number) => {
    const line = createLine([start.toArray(), end.toArray()], 'white', false)
    line.material.linewidth = lineWidth
    return line
  }, [])

  // Phase creators with optimized implementations
  const phaseCreators = useMemo(() => ({
    phase1: (id: string): THREE.Group => {
      const group = new THREE.Group()
      group.name = id
      group.visible = false

      // Create InstancedMesh for cross pattern
      const instancedMesh = new THREE.InstancedMesh(geometries.plane, materials.plane, 4)

      // Set up cross pattern matrices
      const positions = [
        { x: 0.058, y: 0, z: 0 },
        { x: -0.058, y: 0, z: 0 },
        { x: 0, y: 0, z: 0.056 },
        { x: 0, y: 0, z: -0.056 }
      ]

      positions.forEach((pos, i) => {
        const rotation = i < 2 ? 0 : Math.PI / 2
        reusableMatrix4.compose(
          vec3(pos),
          reusableQuaternion.setFromEuler(reusableEuler.set(Math.PI / -2, 0, rotation)),
          vec3({ x: 1, y: 1, z: 1 })
        )
        instancedMesh.setMatrixAt(i, reusableMatrix4)
      })
      instancedMesh.instanceMatrix.needsUpdate = true

      // Create ring
      const ring = new THREE.Mesh(geometries.ring, materials.ring)
      ring.rotation.x = Math.PI / -2

      group.add(instancedMesh, ring)
      group.scale.setScalar(SCALE)
      return group
    },

    phase2: (id: string): THREE.Group => {
      const group = new THREE.Group()
      group.name = id
      group.visible = false

      const lineLength = 0.026
      const planeSize = 0.013

      // Configuration for lines and planes
      const configs = [
        {
          linePos: vec3({ x: 0, y: 0, z: 0.056 }),
          lineRot: euler({ x: Math.PI / -2, y: 0, z: 0 }),
          planePos: vec3({ x: -0.03, y: 0, z: 0.056 }),
          planeRot: euler({ x: Math.PI / -2, y: 0, z: Math.PI / 4 })
        },
        {
          linePos: vec3({ x: 0, y: 0, z: -0.056 }),
          lineRot: euler({ x: Math.PI / -2, y: 0, z: 0 }),
          planePos: vec3({ x: 0.03, y: 0, z: -0.056 }),
          planeRot: euler({ x: Math.PI / -2, y: 0, z: Math.PI / 4 })
        },
        {
          linePos: vec3({ x: 0.062, y: 0, z: 0 }),
          lineRot: euler({ x: Math.PI / -2, y: 0, z: Math.PI / 2 }),
          planePos: vec3({ x: 0.062, y: 0, z: -0.027 }),
          planeRot: euler({ x: Math.PI / -2, y: 0, z: Math.PI / 4 })
        },
        {
          linePos: vec3({ x: -0.062, y: 0, z: 0 }),
          lineRot: euler({ x: Math.PI / -2, y: 0, z: Math.PI / 2 }),
          planePos: vec3({ x: -0.062, y: 0, z: 0.027 }),
          planeRot: euler({ x: Math.PI / -2, y: 0, z: Math.PI / 4 })
        }
      ]

      configs.forEach(config => {
        const line = createLine([[-lineLength, 0, 0], [lineLength, 0, 0]], 'white', true)
        line.position.copy(config.linePos)
        line.rotation.copy(config.lineRot)
        group.add(line)

        const plane = createPlane(config.planePos, config.planeRot, planeSize)
        group.add(plane)
      })

      // Additional corner planes
      const cornerPositions = [
        vec3({ x: 0.041, y: 0, z: 0 }),
        vec3({ x: -0.041, y: 0, z: 0 }),
        vec3({ x: 0, y: 0, z: 0.041 }),
        vec3({ x: 0, y: 0, z: -0.041 })
      ]

      cornerPositions.forEach(pos => {
        group.add(createPlane(pos, euler({ x: Math.PI / -2, y: 0, z: Math.PI / 4 }), planeSize))
      })

      group.scale.setScalar(SCALE)
      return group
    },

    phase3: (id: string): THREE.Group => {
      const group = new THREE.Group()
      group.name = id
      group.visible = false

      const lineConfigs = [
        { pos: vec3({ x: 0.06, y: 0, z: 0.05 }), length: 0.07, dash: 0.03, gap: 0.015 },
        { pos: vec3({ x: -0.06, y: 0, z: -0.058 }), length: 0.07, dash: 0.03, gap: 0.015 },
        { pos: vec3({ x: -0.017, y: 0, z: -0.016 }), length: 0.03, dash: 0.01, gap: 0.03 },
        { pos: vec3({ x: 0.017, y: 0, z: 0.016 }), length: 0.03, dash: 0.01, gap: 0.03 }
      ]

      lineConfigs.forEach(config => {
        group.add(createDashedLine(
          config.pos,
          euler({ x: Math.PI / -2, y: 0, z: Math.PI / 4 }),
          config.length,
          config.dash,
          config.gap,
          4
        ))
      })

      group.scale.setScalar(SCALE)
      return group
    },

    phase4: (id: string): THREE.Group => {
      return phaseCreators.phase3(id) // Reuse phase3
    },

    phase5: (id: string): THREE.Group => {
      const group = new THREE.Group()
      group.name = id
      group.visible = false

      const range = 0.08
      const points = [
        vec3({ x: range, y: 0, z: -range }),
        vec3({ x: -range, y: 0, z: -range }),
        vec3({ x: -range, y: 0, z: range }),
        vec3({ x: range, y: 0, z: range })
      ]

      // Create square outline
      for (let i = 0; i < points.length; i++) {
        const nextIndex = (i + 1) % points.length
        group.add(createSolidLine(points[i], points[nextIndex], 1))
      }

      // Add corner planes
      const planePositions = [
        vec3({ x: range - 0.02, y: 0, z: range - 0.02 }),
        vec3({ x: range - 0.14, y: 0, z: range - 0.02 }),
        vec3({ x: range - 0.02, y: 0, z: range - 0.14 }),
        vec3({ x: -range + 0.02, y: 0, z: -range + 0.02 })
      ]

      planePositions.forEach(pos => {
        const mesh = new THREE.Mesh(geometries.smallPlane, materials.transparentPlane)
        mesh.position.copy(pos)
        mesh.rotation.copy(euler({ x: Math.PI / -2, y: 0, z: 0 }))
        group.add(mesh)
      })

      group.scale.setScalar(SCALE)
      return group
    },

    phase6: (id: string): THREE.Group => {
      const group = new THREE.Group()
      group.name = id
      group.visible = false

      const range = 0.08
      const planeConfigs = [
        { pos: vec3({ x: range - 0.02, y: 0, z: range - 0.02 }), size: [0.04, 0.04], material: materials.transparentPlane },
        { pos: vec3({ x: range - 0.14, y: 0, z: range - 0.02 }), size: [0.04, 0.04], material: materials.transparentPlane },
        { pos: vec3({ x: range - 0.02, y: 0, z: range - 0.14 }), size: [0.04, 0.04], material: materials.transparentPlane },
        { pos: vec3({ x: -range + 0.02, y: 0, z: -range + 0.02 }), size: [0.04, 0.04], material: materials.transparentPlane },
        { pos: vec3({ x: -range + 0.08, y: 0, z: -range + 0.02 }), size: [0.08, 0.04], material: materials.solidPlane },
        { pos: vec3({ x: -range + 0.02, y: 0, z: -range + 0.08 }), size: [0.04, 0.08], material: materials.solidPlane },
        { pos: vec3({ x: range - 0.08, y: 0, z: range - 0.02 }), size: [0.08, 0.04], material: materials.solidPlane },
        { pos: vec3({ x: range - 0.02, y: 0, z: range - 0.08 }), size: [0.04, 0.08], material: materials.solidPlane }
      ]

      planeConfigs.forEach(config => {
        const geometry = new THREE.PlaneGeometry(config.size[0], config.size[1])
        const mesh = new THREE.Mesh(geometry, config.material)
        mesh.position.copy(config.pos)
        mesh.rotation.copy(euler({ x: Math.PI / -2, y: 0, z: 0 }))
        group.add(mesh)
      })

      group.scale.setScalar(SCALE)
      return group
    },

    phase7: (id: string): THREE.Group => {
      const group = new THREE.Group()
      group.name = id
      group.visible = false

      const lineConfigs = [
        vec3({ x: -0.055, y: 0, z: 0.045 }),
        vec3({ x: -0.015, y: 0, z: 0.012 }),
        vec3({ x: 0.018, y: 0, z: -0.02 }),
        vec3({ x: 0.055, y: 0, z: -0.055 })
      ]

      lineConfigs.forEach(pos => {
        group.add(createDashedLine(
          pos,
          euler({ x: Math.PI / -2, y: 0, z: Math.PI / -4 }),
          0.085,
          0.07,
          0.035,
          12
        ))
      })

      group.scale.setScalar(SCALE)
      return group
    },

    phase8: (id: string): THREE.Group => {
      const group = new THREE.Group()
      group.name = id
      group.visible = false

      const linePositions = [
        vec3({ x: 0.055, y: 0, z: 0.045 }),
        vec3({ x: -0.055, y: 0, z: -0.055 })
      ]

      linePositions.forEach(pos => {
        group.add(createDashedLine(
          pos,
          euler({ x: Math.PI / -2, y: 0, z: Math.PI / 4 }),
          0.08,
          0.012,
          0.015,
          15
        ))
      })

      group.scale.setScalar(SCALE)
      return group
    }
  }), [geometries, materials, createPlane, createDashedLine, createSolidLine, reusableMatrix4, reusableQuaternion, reusableEuler])

  // Optimized phase management
  const phaseNames = useMemo(() => Object.keys(phaseCreators), [phaseCreators])

  // Frame counter for animation timing
  const frameCounterRef = useRef<number>(0)

  // Optimized animation update (every 5 frames)
  const updateAnimations = useCallback(() => {
    if (!batchedMeshRef.current) return

    // Increment frame counter
    frameCounterRef.current++

    // Only update animation every 5 frames
    if (frameCounterRef.current % EFFECT_UPDATE_INTERVAL !== 0) return

    animationsRef.current.forEach((animation, index) => {
      if (!animation.enabled) return

      animation.animationIndex++

      // Update positions for all phases
      phaseNames.forEach(phaseName => {
        const obj = batchedMeshRef.current!.getObjectByName(`${phaseName}-${index}`)
        if (obj) {
          obj.position.copy(animation.position)
        }
      })

      // Handle phase visibility
      const currentPhase = animation.animationIndex

      phaseNames.forEach((phaseName, phaseIndex) => {
        const obj = batchedMeshRef.current!.getObjectByName(`${phaseName}-${index}`)
        if (obj) {
          obj.visible = (phaseIndex + 1) === currentPhase
        }
      })

      // Reset animation when complete
      if (currentPhase > TOTAL_PHASES) {
        phaseNames.forEach(phaseName => {
          const obj = batchedMeshRef.current!.getObjectByName(`${phaseName}-${index}`)
          if (obj) obj.visible = false
        })
        animation.enabled = false
        animation.animationIndex = 0
      }
    })
  }, [phaseNames])

  useFixedFrameUpdate(updateAnimations)

  // Optimized event handler
  const handleHitAnimation = useCallback((msg: string, data: THREE.Vector3) => {
    const nextIndex = animationsIndexRef.current < ANIMATION_COUNT - 1
      ? animationsIndexRef.current + 1
      : 0

    animationsIndexRef.current = nextIndex
    animationsRef.current[nextIndex].position.copy(data)
    animationsRef.current[nextIndex].enabled = true
  }, [])

  useEffect(() => {
    const token = PubSub.subscribe('startHitAnimation', handleHitAnimation)

    // Initialize animations
    batchedMeshRef.current?.clear()
    animationsRef.current = []

    for (let i = 0; i < ANIMATION_COUNT; i++) {
      animationsRef.current.push({
        position: vec3(),
        enabled: false,
        animationIndex: 0
      })

      // Add all phase objects
      Object.entries(phaseCreators).forEach(([phaseName, creator]) => {
        batchedMeshRef.current?.add(creator(`${phaseName}-${i}`))
      })
    }

    return () => {
      PubSub.unsubscribe(token)
    }
  }, [phaseCreators, handleHitAnimation])

  return (
    <>
      <group ref={batchedMeshRef} position={[0, 0, 0]} />
      <HitEffectExpandingRingEffects />
    </>
  )
}
