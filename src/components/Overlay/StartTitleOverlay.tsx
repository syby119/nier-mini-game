import { useSpring, animated } from '@react-spring/web'
import React, { } from 'react'
import systemInfoStore from '../../store/SystemInfoStore';
import usePlayerStore from '../../store/PlayerStore';
import useAudioStore from '../../store/AudioStore';
import { useOverlayStore } from '../../store/OverlayStore';

export default function StartTitleOverlay() {
    const updateSystemInfo = systemInfoStore(state => state.updateSystemInfo)
    const setGameStarted = systemInfoStore(state => state.setGameStarted)
    const setCurrentPhase = systemInfoStore(state => state.setCurrentPhase)
    const respawnPlayer = usePlayerStore(state => state.respawnPlayer)
    const setShowOverlay = useOverlayStore(state => state.setShowOverlay)
    const { stop: stopAudio, play: playAudio } = useAudioStore();
    
    // Check if we should skip title animation in development mode
    const shouldSkipTitleAnimation = process.env.NODE_ENV === 'development' && process.env.SKIP_TITLE_ANIMATION === 'true';
    
    const [styles, api] = useSpring(() => ({
        from: { titleOpacity: 0, subTitleOpacity: 0 },
        to: async (next) => {
            if (shouldSkipTitleAnimation) {
                // Skip animation and immediately proceed to game
                await next({ titleOpacity: 0, subTitleOpacity: 0 });
                return;
            }
            
            if (process.env.NODE_ENV != 'development') {
                playAudio('Weight of the World')
                await new Promise((resolve) => setTimeout(resolve, 2000));
                // 1. First let title and subtitle appear gradually
                await next({ titleOpacity: 1 });
                await new Promise((resolve) => setTimeout(resolve, 1000));
                await next({ subTitleOpacity: 1 });

                // 2. Keep for a while
                await new Promise((resolve) => setTimeout(resolve, 7000));

                // 3. Disappear synchronously
                await next({ titleOpacity: -0.5, subTitleOpacity: -0.5 });
            }
            await next({ titleOpacity: 0, subTitleOpacity: 0 });
        },
        onRest: () => {
            // Update system state after animation ends
            updateSystemInfo({
                titleScreenShowed: true,
                currentPhase: '0',
            })
            setGameStarted(true)
            setShowOverlay('titleScreenOverlay', false)
            setTimeout(() => {
                respawnPlayer()
            }, 200)
        },
        config: { duration: shouldSkipTitleAnimation ? 0 : 1000 },
    }));

    const AnimatedDiv = animated('div');

    // Don't render anything if we're skipping the animation
    if (shouldSkipTitleAnimation) {
        return null;
    }

    return (
        <div className="flex items-center justify-center flex-col gap-2">
            <AnimatedDiv style={{ opacity: styles.titleOpacity }}>
                <div className="text-5xl text-[#E5E5E3]">
                    NieR:Automata
                </div>
            </AnimatedDiv>
            <AnimatedDiv style={{ opacity: styles.subTitleOpacity }}>
                <div className="text-3xl text-[#E5E5E3] tracking-[.20em]">
                    the [E]nd of YoRHa
                </div>
            </AnimatedDiv>
        </div>
    );
};
