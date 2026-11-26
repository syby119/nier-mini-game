'use client'
import GameCanvas from '@/game/GameCanvas'
import GameOverlays from '@/game/GameOverlays'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { useEffect, useState } from 'react'

function Home() {
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
        <GameOverlays />
      </div>
    </main>
  )
}

export default Home
