'use client'
import type { PodLanguage } from '@/features/audio/podLanguage'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { useEffect, useState } from 'react'
import GameCanvas from './GameCanvas'
import GameOverlays from './GameOverlays'

export default function Game({ voiceLanguage }: { voiceLanguage: PodLanguage }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    // The ping initializes the anonymous player cookie. Offline play can still start.
    void fetch('/api/ping').catch(() => { })
  }, [])

  return (
    <main>
      <Analytics />
      <SpeedInsights />
      <div className="fixed top-0 left-0 w-full h-full">
        {mounted && <GameCanvas />}
        <GameOverlays voiceLanguage={voiceLanguage} />
      </div>
    </main>
  )
}
