import { selectPodLanguage } from '@/features/audio/podLanguage'
import Game from '@/game/Game'
import { headers } from 'next/headers'

export default async function Home({ searchParams }: { searchParams: Promise<{ voice?: string | string[] }> }) {
  const [request, query] = await Promise.all([headers(), searchParams])
  const country = request.get('x-vercel-ip-country') || request.get('cf-ipcountry')
  const voiceLanguage = selectPodLanguage(query.voice, country, request.get('accept-language'))
  return <Game voiceLanguage={voiceLanguage} />
}
