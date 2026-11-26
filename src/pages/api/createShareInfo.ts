import { isSupportMessageText } from '@/features/community/supportMessageText'
import { supportPhrases } from '@/features/ending/messages/SupportPhrases'
import { saveCookieName, saveMessage } from '@/server/playerSaves'
import type { NextApiRequest, NextApiResponse } from 'next'

const longest = (options: readonly string[]) => Math.max(...options.map(text => text.length))
// Preserve the original free-text limits and fit every combination in the editor.
const messageLimit = Math.max(30,
  longest(supportPhrases.openings) + longest(supportPhrases.connections) + longest(supportPhrases.endings))
const regionLimit = Math.max(15, longest(supportPhrases.regions))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { content, region } = req.body || {}
  const cookie = saveCookieName(req.body?.profileId)
  const id = cookie && req.cookies[cookie]
  if (!id || !isSupportMessageText(content) || content.length > messageLimit ||
    typeof region !== 'string' || !region.trim() || region.length > regionLimit) return res.status(400).end()
  if (!await saveMessage(id, content.trim(), region.trim())) return res.status(404).end()
  return res.status(200).json({ message: 'Success' })
}
