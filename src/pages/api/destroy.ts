import { donateSave } from '@/server/playerSaves'
import type { NextApiRequest, NextApiResponse } from 'next'

// Older clients confirm the same donation without sending a run summary.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!req.cookies.id) return res.status(400).json({ message: 'Error' })
  const name = await donateSave(req.cookies.id)
  if (!name) return res.status(400).json({ message: 'Error' })
  return res.status(200).json({ message: 'THANK YOU... ' + name })
}
