import React, { useEffect, useRef, useState } from 'react'
import { Enemy } from './Enemy'
import { EnemyData, EnemyProps, FinalConfirmEnemy } from '../data/EnemyData'
import { Html, Text } from '@react-three/drei';
import usePlayerStore from '../store/PlayerStore';
import { useDebouncedCallback } from 'use-debounce';
import systemInfoStore from '../store/SystemInfoStore';
import useAudioStore from '../store/AudioStore';
import { useCutsceneStore } from '../store/CutsceneStore';


export const EnemySystem = React.memo(() => {
    const currentPhase = systemInfoStore(state => state.systemInfo.currentPhase);
    const setImportantPhaseRecord = systemInfoStore(state => state.setImportantPhaseRecord);
    const setCurrentPhase = systemInfoStore(state => state.setCurrentPhase);
    const startCutscene = useCutsceneStore(state => state.startCutscene);
    const setPlayerShareInfo = usePlayerStore(state => state.setPlayerShareInfo);
    const updatePlayerInfo = usePlayerStore(state => state.updatePlayerInfo);
    const playerHealth = usePlayerStore(state => state.playerInfo.playerHealth);
    const [enemiesMap, setEnemiesMap] = useState<Map<string, EnemyProps>>(new Map());
    const pendingEnemies = useRef<Set<string>>(new Set());
    const pointsRef = useRef<number>(0);
    const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());
    const defeatedEnemyIds = useRef<Set<string>>(new Set());
    const { play: playAudio } = useAudioStore();

    const batchAddEnemies = (enemies: EnemyProps[]) => {
        enemies.forEach(enemy => {
            if (enemy.isImportantPhase) {
                setImportantPhaseRecord(enemy.phase);
            }
            setEnemiesMap(prev => {
                const newMap = new Map(prev);
                if (!newMap.has(enemy.id)) {
                    newMap.set(enemy.id, enemy);
                }
                return newMap;
            });
        });
    }

    const handleUpdateEnemiesByPhase = (phase: string) => {
        const phaseEnemies = EnemyData.filter(e => e.phase === phase);
        batchAddEnemies(phaseEnemies);
    };

    const debouncedPhaseUpdate = useDebouncedCallback(
        (phase: string) => handleUpdateEnemiesByPhase(phase),
        500
    );

    useEffect(() => {
        if (playerHealth > 0) {
            console.log('currentPhase', currentPhase)
            debouncedPhaseUpdate(currentPhase);
        }
    }, [currentPhase, debouncedPhaseUpdate]);

    useEffect(() => {
        const resetEnemiesDataToken = PubSub.subscribe("resetEnemiesData", (msg: any, resetType: {
            type: string,
            phase?: string
        }) => {
            //重置敌人数据
            timersRef.current.forEach(timer => clearTimeout(timer)); // 清除所有定时器
            timersRef.current.clear(); // 清空定时器引用
            if (resetType?.type == "empty") {
                setEnemiesMap(new Map());
            } else if (resetType?.type == "resetPhase") {
                setEnemiesMap(new Map());
                setTimeout(() => {
                    handleUpdateEnemiesByPhase(resetType?.phase || currentPhase);
                }, 200)
            }
            defeatedEnemyIds.current.clear();
            pendingEnemies.current.clear();
        })

        const setFinalConfirmEnemiesDataToken = PubSub.subscribe("setFinalConfirmEnemiesData", (msg: any, data: EnemyProps) => {
            //设置最终确认敌人数据 FinalConfirmEnemy
            timersRef.current.forEach(timer => clearTimeout(timer)); // 清除所有定时器
            timersRef.current.clear(); // 清空定时器引用
            const newMap = new Map();
            newMap.set(FinalConfirmEnemy.id, FinalConfirmEnemy);
            setEnemiesMap(newMap);
            defeatedEnemyIds.current.clear();
            pendingEnemies.current.clear();
        })

        return () => {
            timersRef.current.forEach(timer => clearTimeout(timer));
            timersRef.current.clear();
            PubSub.unsubscribe(resetEnemiesDataToken);
            PubSub.unsubscribe(setFinalConfirmEnemiesDataToken);
        };
    }, []);

    const handleFinalConfirmEnemyOnDeath = () => {
        setTimeout(() => {
            startCutscene('startDestroyOnlineResultOverlay')
            new Promise(async (resolve) => {
                const req = await fetch('/api/destroy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                const req2 = await fetch('/api/gameClear')
                resolve(null)
            }).catch(() => { })

        }, 3000)
        setTimeout(() => {
            PubSub.publish("setDisablePlayerMove", true);
            PubSub.publish("setPlayerVisibleModel", false);
        }, 4000)
    }

    const handleFinalEnemyOnDeath = () => {
        setTimeout(() => {
            startCutscene('startPlayerSummary')
            setPlayerShareInfo({ points: pointsRef.current });
            updatePlayerInfo({ needOtherPlayerHelp: false })
        }, 3000)
        setTimeout(() => {
            PubSub.publish("setDisablePlayerMove", true);
            PubSub.publish("setPlayerVisibleModel", false);
        }, 4000)
    }

    const enemyOnDeath = (
        id: string,
        _phase?: string,
        nextPhase?: string,
        _isImportantPhase?: boolean,
        isNeedChidAllDead?: boolean,
        childrenIds?: string[],
        points: number = 0
    ) => {
        //避免同个敌人多次死亡
        if (defeatedEnemyIds.current.has(id)) {
            setEnemiesMap(prev => {
                const newMap = new Map(prev);
                newMap.delete(id)
                return newMap;
            });
            return
        }
        pointsRef.current += points;
        defeatedEnemyIds.current.add(id);
        playAudio('coreExplode1');
        if (id == "enemy_final") {
            handleFinalEnemyOnDeath()
        } else if (id == 'enemy_final_confirm') {
            handleFinalConfirmEnemyOnDeath()
        }
        checkPendingEnemies({
            id,
            nextPhase,
            isNeedChidAllDead,
            childrenIds
        });
        setEnemiesMap(prev => {
            const newMap = new Map(prev);
            newMap.delete(id)
            return newMap;
        });
    }

    const checkPendingEnemies = (deadEnemy: {
        id: string,
        nextPhase?: string,
        isNeedChidAllDead?: boolean,
        childrenIds?: string[]
    }) => {
        // Several enemies can be defeated before React renders the updated map.
        const allChildrenDefeated = (ids: string[] = []) =>
            ids.every(childId => defeatedEnemyIds.current.has(childId));

        pendingEnemies.current.forEach(id => {
            const enemy = EnemyData.find(e => e.id === id);
            if (enemy?.nextPhase && allChildrenDefeated(enemy.childrenIds)) {
                pendingEnemies.current.delete(id);
                setCurrentPhase(enemy.nextPhase);
            }
        });

        if (!deadEnemy.nextPhase) return;
        if (deadEnemy.isNeedChidAllDead && !allChildrenDefeated(deadEnemy.childrenIds)) {
            pendingEnemies.current.add(deadEnemy.id);
        } else {
            setCurrentPhase(deadEnemy.nextPhase);
        }
    }

    return (
        <>
            <Html>
                {/* <button className='text-white' onClick={() => {
                    // const newMap = new Map();
                    // newMap.set(FinalConfirmEnemy.id, FinalConfirmEnemy);
                    // setEnemiesMap(newMap);
                    addNotification(t("unlockDebugMenu") + Math.random())
                }}>
                    log
                </button> */}
            </Html>
            {Array.from(enemiesMap.values()).map(enemy => (
                <Enemy
                    key={enemy.id}
                    {...enemy}
                    onDeath={enemyOnDeath}
                />
            ))}
        </>
    );
});
