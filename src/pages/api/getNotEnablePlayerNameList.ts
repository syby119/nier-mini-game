import type { NextApiRequest, NextApiResponse } from 'next'
import { listSaves } from '../../lib/playerSaves'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const rows = await listSaves({ enable: false })
  const own = new Set(Object.entries(req.cookies).filter(([key]) => key === 'id' || key.startsWith('nier-slot-')).map(([, id]) => id))
  const data = rows.filter(row => !own.has(row.id)).map(({ name }) => ({ name }))
  return res.status(200).json({ data })
}
