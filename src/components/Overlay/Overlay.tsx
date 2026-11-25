import React, { useEffect } from 'react'
import StartTitleOverlay from './StartTitleOverlay';
import ContinueOverlay from './ContinueOverlay';
import CutsceneOverlay from './CutsceneOverlay';
import MainTitleOverlay from './MainTitleOverlay';
import ResultOverlay from './OnlineResultOverlay';
import PlayerSummaryOverlay from './PlayerSummaryOverlay';
import { pendingDonation } from '../../lib/endingSave';
import FinaleSaveOverlay from './FinaleSaveOverlay';
import RequestPlayerInfoPhase2Overlay from './RequestPlayerInfoPhase2Overlay';
import NotificationOverlay from './NotificationOverlay';
import { useOverlayStore } from '../../store/OverlayStore';
import GamePauseOverlay from './GamePauseOverlay';
import PreLoadAssetsOverlay from './PreLoadAssetsOverlay';
import systemInfoStore from '../../store/SystemInfoStore';

export default function Overlay() {
    const isInitRes = systemInfoStore((state) => state.initRes);
    const isShowMainScreen = useOverlayStore((state) => state.isShowOverlay.mainTitleOverlay);
    const isShowTitleScreen = useOverlayStore((state) => state.isShowOverlay.titleScreenOverlay);
    const isShowContinueOverlay = useOverlayStore((state) => state.isShowOverlay.continueOverlay);
    const isCutsceneActive = useOverlayStore(state => state.isShowOverlay.scoreTransition);
    const isShowOnlineResultOverlay = useOverlayStore((state) => state.isShowOverlay.onlineResultOverlay);
    const isShowPlayerSummaryOverlay = useOverlayStore((state) => state.isShowOverlay.playerSummaryOverlay);
    const isShowRequestPlayerInfoOverlay = useOverlayStore((state) => state.isShowOverlay.requestPlayerInfoOverlay);
    const isShowRequestPlayerInfoPhase2Overlay = useOverlayStore((state) => state.isShowOverlay.requestPlayerInfoPhase2Overlay);
    const isShowRequestPlayerInfoPhase3Overlay = useOverlayStore((state) => state.isShowOverlay.requestPlayerInfoPhase3Overlay);
    useEffect(() => {
        if (!isInitRes || !pendingDonation()) return
        const { setShowOverlay } = useOverlayStore.getState()
        setShowOverlay('mainTitleOverlay', false)
        setShowOverlay('requestPlayerInfoPhase3Overlay', true)
    }, [isInitRes])
    return (
        <div className="w-full h-full absolute top-0 left-0 flex items-center justify-center select-none flex-col pointer-events-none">
            {!isInitRes && <PreLoadAssetsOverlay />}
            {isInitRes && <>
                <NotificationOverlay />
                <GamePauseOverlay />
                {isShowMainScreen && <MainTitleOverlay />}
                {isShowTitleScreen && <StartTitleOverlay />}
                {isShowContinueOverlay && <ContinueOverlay />}
                {isCutsceneActive && <CutsceneOverlay />}
                {isShowOnlineResultOverlay && <ResultOverlay />}
                {isShowPlayerSummaryOverlay && <PlayerSummaryOverlay />}
                {isShowRequestPlayerInfoOverlay && <FinaleSaveOverlay message />}
                {isShowRequestPlayerInfoPhase2Overlay && <RequestPlayerInfoPhase2Overlay />}
                {isShowRequestPlayerInfoPhase3Overlay && <FinaleSaveOverlay />}
            </>}
        </div>
    );
};
