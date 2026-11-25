import type { NextApiRequest, NextApiResponse } from 'next'
import { listSaves } from '../../lib/playerSaves'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const rows = await listSaves()
  const data = rows.filter(row => row.content).map(({ name, content, region }) => ({ name, content, region }))
  return res.status(200).json({ data })
}
