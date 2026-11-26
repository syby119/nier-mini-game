import React, { useEffect, useRef, useState } from 'react'
import { finishBattle } from '../lib/battleSession'
import { Enemy } from './Enemy'
import { EnemyData, EnemyProps } from '../data/EnemyData'
import usePlayerStore from '../store/PlayerStore';
import { useDebouncedCallback } from 'use-debounce';
import systemInfoStore from '../store/SystemInfoStore';
import useAudioStore from '../store/AudioStore';
import { useOverlayStore } from '../store/OverlayStore';


export const EnemySystem = React.memo(() => {
    const currentPhase = systemInfoStore(state => state.systemInfo.currentPhase);
    const setImportantPhaseRecord = systemInfoStore(state => state.setImportantPhaseRecord);
    const setCurrentPhase = systemInfoStore(state => state.setCurrentPhase);
    const setOverlay = useOverlayStore(state => state.setShowOverlay);
    const addCombatStats = usePlayerStore(state => state.addCombatStats);
    const updatePlayerInfo = usePlayerStore(state => state.updatePlayerInfo);
    const playerHealth = usePlayerStore(state => state.playerInfo.playerHealth);
    const [enemiesMap, setEnemiesMap] = useState<Map<string, EnemyProps>>(new Map());
    const pendingEnemies = useRef<Set<string>>(new Set());
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

        return () => {
            timersRef.current.forEach(timer => clearTimeout(timer));
            timersRef.current.clear();
            PubSub.unsubscribe(resetEnemiesDataToken);
        };
    }, []);

    const handleFinalEnemyOnDeath = () => {
        setTimeout(() => {
            setOverlay('scoreTransition', true)
            updatePlayerInfo({ needOtherPlayerHelp: false })
        }, 3000)
        setTimeout(() => {
            PubSub.publish("setDisablePlayerMove", true);
            PubSub.publish("setPlayerVisibleModel", false);
        }, 4000)
    }

    const removeEnemy = (id: string) => {
        setEnemiesMap(prev => {
            if (!prev.has(id)) return prev
            const next = new Map(prev)
            next.delete(id)
            return next
        })
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
            removeEnemy(id)
            return
        }
        addCombatStats({ points, enemiesDefeated: 1 });
        defeatedEnemyIds.current.add(id);
        playAudio('coreExplode1');
        if (id == "enemy_final") {
            finishBattle('cleared')
            handleFinalEnemyOnDeath()
        }
        checkPendingEnemies({
            id,
            nextPhase,
            isNeedChidAllDead,
            childrenIds
        });
        removeEnemy(id)
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
            {Array.from(enemiesMap.values()).map(enemy => (
                <Enemy
                    key={enemy.id}
                    {...enemy}
                    onDeath={enemyOnDeath}
                    onLeave={removeEnemy}
                />
            ))}
        </>
    );
});
