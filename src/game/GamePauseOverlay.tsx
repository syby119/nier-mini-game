import useAudioStore from '@/features/audio/AudioStore'
import { animated, useSpring } from '@react-spring/web'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { returnToCover } from './battleSession'
import useGamePauseStore from './state/GamePauseStore'

const AnimatedDiv = animated('div')
export default function GamePauseOverlay() {
  const t = useTranslations('saves')
  const isPaused = useGamePauseStore(state => state.isPaused)
  const opacityValueRef = useRef<number>(0)
  const [styles, api] = useSpring(() => ({
    from: { opacity: opacityValueRef.current },
  }))
  const [volume, setVolume] = useState<number>(0.3)
  const setAllVolume = useAudioStore(state => state.setAllVolume)

  const handlePauseChange = (isPause: boolean) => {
    api.stop()
    if (isPause) {
      api.start({
        from: { opacity: opacityValueRef.current },
        to: { opacity: 0.6 },
        config: { duration: 600 },
        onChange: (value) => {
          opacityValueRef.current = value.value.opacity
        }
      })
    } else {
      api.start({
        from: { opacity: opacityValueRef.current },
        to: { opacity: 0 },
        config: { duration: 300 },
        onChange: (value) => {
          opacityValueRef.current = value.value.opacity
        }
      })
    }
  }

  useEffect(() => useGamePauseStore.subscribe(
    state => state.isPaused, handlePauseChange
  ), [])

  return (
    <AnimatedDiv className="w-screen h-screen bg-[#2e2c27] z-10 absolute" inert={!isPaused} style={{
      opacity: styles.opacity,
      pointerEvents: isPaused ? 'auto' : 'none',
      display: styles.opacity.to((opacity) => opacity === 0 ? 'none' : 'flex')
    }}>
      <div className="container mx-auto flex items-center justify-center h-full flex-col">
        <div className="text-white text-6xl">
          GAME STOP
          <div className="text-white text-xl mt-10">
            <p>Volume</p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              defaultValue={volume}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg dark:bg-gray-700 pointer-events-auto"
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                setVolume(value)
                setAllVolume(value)
              }} />
          </div>
          <button type="button" className="mt-8 cursor-pointer border border-current px-4 py-2 text-base"
            onClick={returnToCover}>{t('leaveBattle')}</button>
        </div>
      </div>
    </AnimatedDiv>
  )
}
