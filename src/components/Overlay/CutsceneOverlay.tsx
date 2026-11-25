import { animated, useSpring } from '@react-spring/web'
import { useOverlayStore } from '../../store/OverlayStore'

const AnimatedDiv = animated('div')

export default function CutsceneOverlay() {
  const setOverlay = useOverlayStore(state => state.setShowOverlay)
  const [style] = useSpring(() => ({
    from: { opacity: 0 },
    to: async next => {
      await next({ opacity: 1 })
      setOverlay('playerSummaryOverlay', true)
      await next({ opacity: 0, delay: 500 })
    },
    config: { duration: 1500 },
    onRest: () => setOverlay('scoreTransition', false),
  }), [setOverlay])
  return <AnimatedDiv aria-hidden="true" className="w-full h-full absolute bg-black" style={style} />
}
