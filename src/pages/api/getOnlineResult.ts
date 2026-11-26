import type { NextApiRequest, NextApiResponse } from 'next'
import { listSaves, saveCookieName } from '../../lib/playerSaves'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const cookie = saveCookieName(req.query.profileId)
  if (!cookie) return res.status(400).end()
  const rows = await listSaves({ enable: true })
  const data = rows.filter(row => row.id !== req.cookies[cookie]).sort((a, b) => b.score - a.score)
    .map(({ name, content, region, score }) => ({ name, content, region, score }))
  return res.status(200).json({ data })
}
