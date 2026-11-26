import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface ISystemInfo {
  mainOverlayShowed: boolean;
  titleScreenShowed: boolean;
  currentPhase: string;
}

// 初始值
const initSystemInfoValue: ISystemInfo = {
  mainOverlayShowed: false,
  titleScreenShowed: false,
  currentPhase: "",
};

interface SystemInfoContextType {
  systemInfo: ISystemInfo;
  initRes: boolean;
  doneInitRes: () => void;
  gameStarted: boolean;
  playerSpawnZ: number;
  resetSystemInfo: () => void;
  setCurrentPhase: (newPhase: string) => void;
  setTitleScreenShowed: (showed: boolean) => void;
  setGameStarted: (started: boolean, playerSpawnZ?: number) => void;
  updateSystemInfo: (updates: Partial<ISystemInfo>) => void;
  importantPhaseRecord: string;
  setImportantPhaseRecord: (phase: string) => void;
  postEffects: boolean;
  setPostEffects: (value: boolean) => void;
}

const systemInfoStore = create<SystemInfoContextType>()(
  subscribeWithSelector((set, get) => ({
    initRes: false,
    doneInitRes: () => set({ initRes: true }),
    gameStarted: false,
    playerSpawnZ: 0,
    systemInfo: initSystemInfoValue,
    resetSystemInfo: () => {
      set({ systemInfo: { ...initSystemInfoValue } });
      PubSub.publish("resetPlayerPosition");
      PubSub.publish("resetEnemiesData", {
        type: "empty",
      });
      PubSub.publish("resetPlayerProjectiles");
      PubSub.publish("resetEnemyShootProjectile");
      PubSub.publish("resetEnemyShootUnbrokenProjectileToken");
      PubSub.publish("updateSceneEffectCount", 0);
    },
    setCurrentPhase: (newPhase) =>
      set((state) => ({
        systemInfo: { ...state.systemInfo, currentPhase: newPhase },
      })),
    setTitleScreenShowed: (showed) =>
      set((state) => ({
        systemInfo: { ...state.systemInfo, titleScreenShowed: showed },
      })),
    setGameStarted: (started, playerSpawnZ = 0) =>
      set({ gameStarted: started, playerSpawnZ }),
    updateSystemInfo: (updates) =>
      set((state) => ({
        systemInfo: { ...state.systemInfo, ...updates },
      })),
    importantPhaseRecord: "",
    setImportantPhaseRecord: (phase) => set({ importantPhaseRecord: phase }),
    postEffects: true,
    setPostEffects: (value) =>
      set((state) => ({
        postEffects: value,
      })),
  }))
);

export default systemInfoStore;
