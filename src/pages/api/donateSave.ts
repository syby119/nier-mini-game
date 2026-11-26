import type { NextApiRequest, NextApiResponse } from 'next'
import { donateSave, RunStats, saveCookieName } from '../../lib/playerSaves'

const fields: (keyof RunStats)[] = ['playerTime', 'deathCount', 'retryCount', 'shootCount', 'shootHitCount', 'onHitCount']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const cookie = saveCookieName(req.body?.profileId)
  const id = cookie && req.cookies[cookie]
  if (!id) return res.status(400).end()
  const stats = {} as RunStats
  for (const key of fields) {
    const value = req.body?.[key]
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.floor(value))) return res.status(400).end()
    stats[key] = Math.floor(value)
  }
  if (req.body.enemiesDefeated !== undefined) {
    if (!Number.isSafeInteger(req.body.enemiesDefeated) || req.body.enemiesDefeated < 0) return res.status(400).end()
    stats.enemiesDefeated = req.body.enemiesDefeated
  }
  if (!await donateSave(id, stats)) return res.status(404).end()
  res.setHeader('Set-Cookie', 'gameClear=1; Path=/; SameSite=Lax; Max-Age=31536000')
  return res.status(200).json({ uploaded: true })
}
