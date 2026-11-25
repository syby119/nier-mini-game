import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface RunStats {
  playerTime: number
  deathCount: number
  retryCount: number
  shootCount: number
  shootHitCount: number
  onHitCount: number
}

interface PlayerSave {
  id: string
  enable: boolean
  name: string
  score: number
  content: string
  region: string
  stats?: RunStats
  createdAt: Date
  updatedAt: Date
}

const directory = process.env.NIER_SAVE_DIR || path.join(process.cwd(), '.nier-saves')
const writes = new Map<string, Promise<unknown>>()

async function collection() {
  const client = await (await import('./mongodb')).default
  return client.db('nier').collection<PlayerSave>('player')
}

function filename(id: string) {
  return path.join(directory, createHash('sha256').update(id).digest('hex') + '.json')
}

async function readLocal(file: string): Promise<PlayerSave | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function localUpdate(id: string, update: (current: PlayerSave | null) => PlayerSave | null) {
  const task = (writes.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
    const file = filename(id)
    const current = await readLocal(file)
    const record = update(current)
    if (!record || record === current) return record
    await mkdir(directory, { recursive: true })
    const temp = file + '.' + randomUUID() + '.tmp'
    await writeFile(temp, JSON.stringify(record), { mode: 0o600 })
    await rename(temp, file)
    return record
  })
  writes.set(id, task)
  try { return await task } finally { if (writes.get(id) === task) writes.delete(id) }
}

export async function listSaves(filter: { enable?: boolean } = {}) {
  if (process.env.MONGODB_URI) return (await collection()).find(filter).toArray()
  let files: string[]
  try { files = await readdir(directory) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const rows = await Promise.all(files.filter(file => file.endsWith('.json')).map(file => readLocal(path.join(directory, file))))
  return rows.filter((row): row is PlayerSave => !!row && (filter.enable === undefined || row.enable === filter.enable))
}

export async function saveScore(id: string, name: string, score: number): Promise<string> {
  const now = new Date()
  const initial = { id, enable: true, name, score, region: '', content: '', createdAt: now, updatedAt: now }
  if (process.env.MONGODB_URI) {
    const table = await collection()
    await table.updateOne({ id }, { $setOnInsert: initial }, { upsert: true })
    const result = await table.updateOne({ id, enable: { $ne: false } }, { $set: { name, score, updatedAt: now } })
    if (!result.matchedCount) return saveScore(randomUUID(), name, score)
  } else {
    const saved = await localUpdate(id, current => {
      if (!current) return initial
      return current.enable ? { ...current, name, score, updatedAt: now } : current
    })
    if (!saved?.enable) return saveScore(randomUUID(), name, score)
  }
  return id
}

export async function saveMessage(id: string, content: string, region: string) {
  const changes = { content, region, updatedAt: new Date() }
  if (process.env.MONGODB_URI) {
    return (await (await collection()).updateOne({ id, enable: true }, { $set: changes })).matchedCount > 0
  }
  const saved = await localUpdate(id, row => row?.enable ? { ...row, ...changes } : row)
  return !!saved?.enable
}

export async function donateSave(id: string, stats?: RunStats) {
  const changes = { ...(stats && { stats }), enable: false, updatedAt: new Date() }
  if (process.env.MONGODB_URI) {
    const table = await collection()
    const record = await table.findOneAndUpdate({ id, enable: true }, { $set: changes }, { returnDocument: 'after', projection: { name: 1 } })
      || await table.findOne({ id, enable: false }, { projection: { name: 1 } })
    return record ? record.name || 'PLAYER' : null
  }
  const saved = await localUpdate(id, row => row?.enable ? { ...row, ...changes } : row)
  return saved ? saved.name || 'PLAYER' : null
}
