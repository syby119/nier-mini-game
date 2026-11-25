import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'node:crypto'
import { saveScore } from '../../lib/playerSaves'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { name, score } = req.body || {}
  if (typeof name !== 'string' || !name.trim() || name.length > 32 ||
    !Number.isSafeInteger(score) || score < 0 || score > 1000000) return res.status(400).end()
  const id = await saveScore(req.cookies.id || randomUUID(), name.trim(), score)
  if (id !== req.cookies.id) res.setHeader('Set-Cookie', 'id=' + id + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000')
  return res.status(200).json({ message: 'Success' })
}
