import { saveCookieName, saveScore } from '@/server/playerSaves'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, randomUUID } from 'node:crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { name, score } = req.body || {}
  if (typeof name !== 'string' || !name.trim() || name.length > 32 ||
    !Number.isSafeInteger(score) || score < 0 || score > 1000000) return res.status(400).end()
  const cookie = saveCookieName(req.body.profileId)
  if (!cookie) return res.status(400).end()
  const initialId = req.cookies[cookie] || (req.cookies.id && cookie !== 'id'
    ? createHash('sha256').update(req.cookies.id + ':' + cookie).digest('hex') : randomUUID())
  const id = await saveScore(initialId, name.trim(), score)
  if (id !== req.cookies[cookie]) res.setHeader('Set-Cookie', cookie + '=' + id + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000')
  return res.status(200).json({ message: 'Success' })
}
