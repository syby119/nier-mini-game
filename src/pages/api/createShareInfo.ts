import type { NextApiRequest, NextApiResponse } from 'next'
import { saveCookieName, saveMessage } from '../../lib/playerSaves'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { content, region } = req.body || {}
  const cookie = saveCookieName(req.body?.profileId)
  const id = cookie && req.cookies[cookie]
  if (!id || typeof content !== 'string' || !content.trim() || content.length > 30 ||
    typeof region !== 'string' || !region.trim() || region.length > 15) return res.status(400).end()
  if (!await saveMessage(id, content.trim(), region.trim())) return res.status(404).end()
  return res.status(200).json({ message: 'Success' })
}
