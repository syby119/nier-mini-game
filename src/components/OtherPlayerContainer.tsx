import { useControls } from 'leva'
import { createRef, useImperativeHandle, useMemo, useRef, useState, type Ref, type RefObject } from 'react'
import * as THREE from 'three'
import { PlayerShip } from './PlayerShip'
import { getRescuePilots } from '../store/NetworkStore'

const fullCircle = 2 * Math.PI
// In the 30 fps finale recording the formation turns about 10 degrees per frame.
const orbitDegreesPerSecond = 300
const arrivalTime = 1.1
const firstWaveSpacing = 1.1
const replacementDelay = 2.8

type WingmanState = 'waiting' | 'incoming' | 'ready'

interface Wingman {
    state: WingmanState
    elapsed: number
    pilot: string
    origin: THREE.Vector3
    ship: RefObject<THREE.Group | null>
}

function nextPilot(roster: string[], start: number, wingmen: Wingman[]) {
    for (let i = 0; i < roster.length; i++) {
        const pilot = roster[(start + i) % roster.length]
        if (!wingmen.some(wingman => wingman.state !== 'waiting' && wingman.pilot === pilot)) return pilot
    }
    return roster[start % roster.length]
}

export interface SupportFormation {
    update(delta: number, center: THREE.Vector3Like, heading: number, width: number, height: number): void
    forEachReadyOffset(visit: (offset: THREE.Vector3) => void): void
    sacrificeWingman(): { position: THREE.Vector3, pilot: string } | undefined
}

export default function OtherPlayerContainer({ ref, pilots }: { ref: Ref<SupportFormation>, pilots?: string[] }) {
    const [roster] = useState(() => pilots ?? getRescuePilots())
    const { helpPlayerCount, centerRange, rotationSpeed } = useControls('Player', {
        helpPlayerCount: { label: 'Other Player Count', value: 6, min: 6, max: 60, step: 1 },
        centerRange: { label: 'Center Range', value: 0.15, min: 0.15, max: 1, step: 0.01 },
        rotationSpeed: { label: 'Rotation Speed (°/s)', value: orbitDegreesPerSecond, min: 0, max: 690, step: 1 },
    })
    const wingmen = useMemo(() => Array.from({ length: helpPlayerCount }, (_, i): Wingman => ({
        state: 'waiting',
        elapsed: -firstWaveSpacing * i,
        pilot: '',
        origin: new THREE.Vector3(),
        ship: createRef<THREE.Group>(),
    })), [helpPlayerCount])
    const phase = useRef(0)
    const arrivals = useRef(0)

    useImperativeHandle(ref, () => ({
        update(delta, center, heading, width, height) {
            phase.current = (phase.current - THREE.MathUtils.degToRad(rotationSpeed) * delta) % fullCircle
            wingmen.forEach((wingman, index) => {
                const ship = wingman.ship.current
                if (!ship) return
                const angle = phase.current + fullCircle * index / wingmen.length
                ship.position.set(centerRange * Math.cos(angle), 0, centerRange * Math.sin(angle))
                ship.rotation.y = heading

                if (wingman.state !== 'ready') {
                    wingman.elapsed += delta
                    if (wingman.elapsed < 0) return
                    if (wingman.state === 'waiting') {
                        // Approach from a fixed point outside the frame, even if the player moves.
                        const entryAngle = Math.PI / 2 + arrivals.current * Math.PI * (3 - Math.sqrt(5))
                        const x = Math.cos(entryAngle)
                        const z = Math.sin(entryAngle)
                        const distance = Math.min((width / 2 + 0.12) / Math.abs(x), (height / 2 + 0.12) / Math.abs(z))
                        wingman.origin.set(x * distance, 0, z * distance)
                        wingman.pilot = nextPilot(roster, arrivals.current, wingmen)
                        arrivals.current++
                        wingman.state = 'incoming'
                        ship.visible = true
                    }
                    const t = Math.min(1, wingman.elapsed / arrivalTime)
                    ship.position.lerp({
                        x: wingman.origin.x - center.x, y: 0, z: wingman.origin.z - center.z,
                    }, (1 - t) ** 2)
                    if (t < 1) return
                    wingman.state = 'ready'
                }
            })
        },
        forEachReadyOffset(visit) {
            for (const wingman of wingmen) {
                if (wingman.state === 'ready' && wingman.ship.current) {
                    visit(wingman.ship.current.position)
                }
            }
        },
        sacrificeWingman() {
            const wingman = wingmen.find(wingman => wingman.state === 'ready')
            const ship = wingman?.ship.current
            if (!wingman || !ship) return
            const position = ship.getWorldPosition(new THREE.Vector3())
            wingman.state = 'waiting'
            wingman.elapsed = -replacementDelay
            ship.visible = false
            return { position, pilot: wingman.pilot }
        },
    }), [wingmen, roster, centerRange, rotationSpeed])

    return (
        <group name="OtherPlayerContainer">
            {wingmen.map((wingman, i) => (
                <group key={helpPlayerCount + '-' + i} ref={wingman.ship} name={'other_player_' + i} visible={false}>
                    <PlayerShip />
                </group>
            ))}
        </group>
    )
}
