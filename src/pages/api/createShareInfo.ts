import type { NextApiRequest, NextApiResponse } from 'next'
import { saveMessage } from '../../lib/playerSaves'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { content, region } = req.body || {}
  if (!req.cookies.id || typeof content !== 'string' || !content.trim() || content.length > 30 ||
    typeof region !== 'string' || !region.trim() || region.length > 15) return res.status(400).end()
  if (!await saveMessage(req.cookies.id, content.trim(), region.trim())) return res.status(404).end()
  return res.status(200).json({ message: 'Success' })
}
