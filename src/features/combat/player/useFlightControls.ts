import { useKeyboardControls } from '@react-three/drei'
import type { RootState } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { Plane, Raycaster, Vector3, type Group } from 'three'
import { gamepadManager } from '@/shared/input/GamepadManager'
import { lerpAngle } from './heading'

const flightPlane = new Plane(new Vector3(0, 1, 0), 0)

export function useFlightControls() {
  const [, readKeyboard] = useKeyboardControls<'forward' | 'backward' | 'left' | 'right'>()
  const aiming = useRef(false)
  const firing = useRef(false)
  const targetHeading = useRef(0)
  const raycaster = useMemo(() => new Raycaster(), [])
  const cursor = useMemo(() => new Vector3(), [])

  useEffect(() => {
    function press(event: MouseEvent) {
      if (event.button === 0) aiming.current = true
      if (event.button === 2 && aiming.current) firing.current = true
    }
    function release(event: MouseEvent) {
      if (event.button === 0) aiming.current = false
      if (event.button === 2) firing.current = false
    }
    function preventMenu(event: MouseEvent) { event.preventDefault() }
    document.addEventListener('mousedown', press)
    document.addEventListener('mouseup', release)
    document.addEventListener('contextmenu', preventMenu)
    return () => {
      document.removeEventListener('mousedown', press)
      document.removeEventListener('mouseup', release)
      document.removeEventListener('contextmenu', preventMenu)
    }
  }, [])

  function move({ camera, pointer }: RootState, body: RapierRigidBody, ship: Group, speed: number) {
    const keys = readKeyboard()
    const pad = gamepadManager.getState()
    const axes = pad.connected ? pad.axes : {}
    // On this camera the positive world axes point left and forward.
    const x = ((keys.right ? -1 : keys.left ? 1 : 0) - (axes['Left Stick Horizontal'] || 0)) * speed
    const z = ((keys.backward ? -1 : keys.forward ? 1 : 0) - (axes['Left Stick Vertical'] || 0)) * speed
    const moving = x !== 0 || z !== 0
    if (moving) targetHeading.current = Math.atan2(x, z)

    let turnRate = 0.2
    if (aiming.current) {
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(flightPlane, cursor)) {
        const position = body.translation()
        targetHeading.current = Math.atan2(cursor.x - position.x, cursor.z - position.z)
        turnRate = 0.8
      }
    }
    const aimX = axes['Right Stick Horizontal'] || 0
    const aimY = axes['Right Stick Vertical'] || 0
    if (Math.abs(aimX) > 0.1 || Math.abs(aimY) > 0.1) {
      targetHeading.current = Math.atan2(-aimX, -aimY)
      turnRate = 0.4
    }

    ship.rotation.y = lerpAngle(ship.rotation.y, targetHeading.current, turnRate)
    body.setLinvel({ x, y: body.linvel().y, z }, true)
    return moving
  }

  function isFiring() {
    const { connected, buttons } = gamepadManager.getState()
    return firing.current || (connected && (buttons.RB || buttons.R1))
  }

  return { move, isFiring }
}
