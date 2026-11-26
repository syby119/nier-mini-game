import { animated, useSpring } from '@react-spring/web'
import { useProgress } from '@react-three/drei'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import systemInfoStore from './state/SystemInfoStore'

const AnimatedDiv = animated('div')
export default function PreLoadAssetsOverlay() {
  const doneInitRes = systemInfoStore((state) => state.doneInitRes)
  const { loaded, total } = useProgress()

  // Check if we should skip loading animation in development mode
  const shouldSkipLoadingAnimation = process.env.NODE_ENV === 'development' && process.env.SKIP_LOADING_ANIMATION === 'true'

  const [loadBackgroundStyle, loadBackgroundStyleApi] = useSpring<{
    opacity: number
    transform: string
  }>(() => ({
    opacity: 0,
    transform: 'scale(0)',
  }))
  const radius = 120 // Circle radius
  const speed = 0.035 // Rotation speed
  const [counterPreLoadTime, setCounterPreLoadTime] = useState<number>(shouldSkipLoadingAnimation ? 0 : 3) // Preload time, max 3 seconds

  const angleRef = useRef(0) // Save current angle
  const loadRef = useRef<any>(null)

  // Use react-spring to update position and rotation angle
  const [playerStyle, playerStyledApi] = useSpring<{
    left?: string
    top?: string
    transform: string
    opacity: number
  }>(() => ({
    transform: `rotate(0deg)`,
    opacity: 0,
  }))

  // Skip animation effect if environment variable is set
  useEffect(() => {
    if (shouldSkipLoadingAnimation) {
      // Immediately complete the loading process
      doneInitRes()
      return
    }

    const timer = setInterval(() => {
      angleRef.current += speed // Update angle per frame
      if (loadRef.current) {
        // Get loading background image position and size
        const loadRect = loadRef.current.getBoundingClientRect()
        const centerX = loadRect.x + loadRect.width / 3
        const centerY = loadRect.y + loadRect.height / 3

        // Calculate plane position and rotation angle based on current angle
        const x = centerX + radius * Math.cos(angleRef.current)
        const y = centerY + radius * Math.sin(angleRef.current)
        const rotation = (angleRef.current * 180) / Math.PI + 180
        // Use react-spring to update animation
        playerStyledApi.start({
          left: `${x}px`,
          top: `${y}px`,
          transform: `rotate(${rotation}deg)`,
        })
        loadBackgroundStyleApi.start({
          transform: `scale(${1 + Math.sin(angleRef.current) * 0.1})`,
        })
      }
    }, 1000 / 60)
    const updateCounter = setInterval(() => {
      setCounterPreLoadTime((prev) => {
        if (prev <= 1) {
          clearInterval(updateCounter) // Clear timer here
          return 0 // Return 0 to ensure state is not negative
        }
        return prev - 1 // Continue decrementing
      })
    }, 1000)

    return () => {
      clearInterval(timer)
      clearInterval(updateCounter)
    }
  }, [shouldSkipLoadingAnimation])

  useEffect(() => {
    if (shouldSkipLoadingAnimation) return

    loadBackgroundStyleApi.start({
      opacity: 1,
      config: { duration: 1000 },
    })
    playerStyledApi.start({
      opacity: 1,
      config: { duration: 1000 },
      delay: 1000
    })
  }, [shouldSkipLoadingAnimation])

  useEffect(() => {
    if (shouldSkipLoadingAnimation) return

    if (loaded === total && counterPreLoadTime <= 0) {
      loadBackgroundStyleApi.start({
        opacity: 0,
        config: { duration: 1000 },
        onChange: (e) => {
          if (e.value.opacity <= 0) {
            doneInitRes()
          }
        }
      })
      playerStyledApi.start({
        opacity: 0,
        config: { duration: 1000 }
      })
    }
  }, [total, loaded, counterPreLoadTime, shouldSkipLoadingAnimation])

  // Don't render anything if we're skipping the animation
  if (shouldSkipLoadingAnimation) {
    return null
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center">
      <div>
        <AnimatedDiv style={{ position: 'absolute', ...playerStyle }}>
          <Image src="/images/player.png" alt="player" width={64} height={64} />
        </AnimatedDiv>
        <AnimatedDiv style={loadBackgroundStyle} ref={loadRef}>
          <Image src="/images/load.png" alt="loadBg" width={192} height={192} />
        </AnimatedDiv>
      </div>
    </div>
  )
}
