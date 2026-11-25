import type { NextApiRequest, NextApiResponse } from 'next'
import { donateSave, RunStats } from '../../lib/playerSaves'

const fields: (keyof RunStats)[] = ['playerTime', 'deathCount', 'retryCount', 'shootCount', 'shootHitCount', 'onHitCount']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!req.cookies.id) return res.status(400).end()
  const stats = {} as RunStats
  for (const key of fields) {
    const value = req.body?.[key]
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.floor(value))) return res.status(400).end()
    stats[key] = Math.floor(value)
  }
  if (!await donateSave(req.cookies.id, stats)) return res.status(404).end()
  res.setHeader('Set-Cookie', 'gameClear=1; Path=/; SameSite=Lax; Max-Age=31536000')
  return res.status(200).json({ uploaded: true })
}
