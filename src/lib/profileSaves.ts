import { v4 as uuid } from 'uuid'
import type { EndingSave } from './endingSave'

const profilePrefix = 'nier.profile.'
const runPrefix = 'nier.run.'
const oldSave = 'nier.endingSave'
const legacyId = 'legacy'

export type RunOutcome = 'unfinished' | 'retired' | 'cleared'
export type PlayerProfile = { id: string, name: string, createdAt: number }
export type RunRecord = {
  startedAt: number, updatedAt: number, outcome: RunOutcome,
  score: number, enemiesDefeated: number | null, playerTime: number, shootCount: number,
  shootHitCount: number, onHitCount: number, deathCount: number, retryCount: number,
}
export type ProfileHistory = PlayerProfile & { runs: RunRecord[] }

const pendingRuns = new Map<string, RunRecord>()

function count(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function runScore(stats: Pick<EndingSave, 'points' | 'onHitCount' | 'retryCount'>) {
  return Math.max(0, count(stats.points) - count(stats.onHitCount) - count(stats.retryCount))
}

export function formatPlayTime(seconds: number) {
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60]
  return parts.map(value => String(value).padStart(2, '0')).join(':')
}

function read<T>(key: string): T | null {
  const value = localStorage.getItem(key)
  if (!value) return null
  try { return JSON.parse(value) as T } catch { return null }
}

function keys(prefix: string) {
  return Object.keys(localStorage).filter(key => key.startsWith(prefix))
}

export function recordStats(stats: EndingSave, startedAt: number, outcome: RunOutcome): RunRecord {
  return {
    startedAt, updatedAt: Date.now(), outcome, score: runScore(stats),
    enemiesDefeated: Number.isFinite(stats.enemiesDefeated) ? count(stats.enemiesDefeated) : null,
    playerTime: count(stats.playerTime), shootCount: count(stats.shootCount),
    shootHitCount: count(stats.shootHitCount), onHitCount: count(stats.onHitCount),
    deathCount: count(stats.deathCount), retryCount: count(stats.retryCount),
  }
}

function importOldSave() {
  const old = read<EndingSave>(oldSave)
  if (typeof old?.name !== 'string' || !old.name.trim() || !Number.isFinite(old.points) || old.profileId) return
  // The old format held one completed run, with no date or enemy count.
  const profile = { id: legacyId, name: old.name, createdAt: 0 }
  const record = recordStats(old, 0, 'cleared')
  localStorage.setItem(runPrefix + legacyId + '.ending', JSON.stringify({ ...record, updatedAt: 0 }))
  localStorage.setItem(profilePrefix + legacyId, JSON.stringify(profile))
  const pending = read<EndingSave>('nier.pendingSaveDonation')
  if (pending && !pending.profileId) {
    localStorage.setItem('nier.pendingSaveDonation', JSON.stringify({ ...pending, profileId: legacyId }))
  }
  localStorage.removeItem(oldSave)
}

export function loadProfiles(): ProfileHistory[] {
  importOldSave()
  pendingRuns.forEach((record, key) => persistRun(key, record))
  const profiles = new Map<string, ProfileHistory>()
  for (const key of keys(profilePrefix)) {
    const p = read<PlayerProfile>(key)
    if (p?.id && p.name) profiles.set(p.id, { ...p, runs: [] })
  }
  const runKeys = new Set(keys(runPrefix).concat(Array.from(pendingRuns.keys())))
  runKeys.forEach(key => {
    const profile = profiles.get(profileIdForRun(key))
    const run = profile && (pendingRuns.get(key) || read<RunRecord>(key))
    if (profile && run) profile.runs.push(run)
  })
  profiles.forEach(p => p.runs.sort((a, b) => b.startedAt - a.startedAt))
  return Array.from(profiles.values()).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export function createProfile(name: string): PlayerProfile {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 16) throw new Error('Invalid player name')
  const profile = { id: uuid(), name: trimmed, createdAt: Date.now() }
  localStorage.setItem(profilePrefix + profile.id, JSON.stringify(profile))
  return profile
}

export function profileExists(id: string) {
  return localStorage.getItem(profilePrefix + id) !== null
}

function profileIdForRun(key: string) {
  return key.slice(runPrefix.length).split('.')[0]
}

function persistRun(key: string, record: RunRecord) {
  try {
    if (profileExists(profileIdForRun(key))) localStorage.setItem(key, JSON.stringify(record))
    pendingRuns.delete(key)
  } catch {
    // Keep the latest checkpoint if storage fills up, including the result of a finished run.
    pendingRuns.set(key, record)
  }
}

export function hasUnsavedRuns() { return pendingRuns.size > 0 }

export function writeRun(profileId: string, runId: string, record: RunRecord) {
  // Separate keys let two tabs finish different runs without replacing each other's history.
  persistRun(runPrefix + profileId + '.' + runId, record)
}

export function removeDonatedProfile(id: string) {
  localStorage.removeItem(profilePrefix + id)
  for (const key of keys(runPrefix + id + '.')) localStorage.removeItem(key)
  pendingRuns.forEach((_, key) => { if (profileIdForRun(key) === id) pendingRuns.delete(key) })
  if (id === legacyId) localStorage.removeItem(oldSave)
}

export function profileTotals(runs: RunRecord[]) {
  return runs.reduce((total, run) => ({
    cleared: total.cleared + Number(run.outcome === 'cleared'),
    best: Math.max(total.best, run.score),
    kills: total.kills + (run.enemiesDefeated ?? 0),
    missingKills: total.missingKills || run.enemiesDefeated === null,
    time: total.time + run.playerTime,
  }), { cleared: 0, best: 0, kills: 0, missingKills: false, time: 0 })
}
