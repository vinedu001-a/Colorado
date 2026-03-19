'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

/**
 * 🚀 OPTIMIZED DYNAMIC IMPORT
 * We keep 'ssr: false' but simplify the loading UI.
 * Complex animations in the 'loading' component can sometimes block the 
 * main thread while ngrok is still streaming the JS chunks.
 */
const OneClickMigrator = dynamic(
  () => import("@/components/OneClickMigrator").then(mod => mod.OneClickMigrator),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mb-3" />
        <p className="text-zinc-600 text-[10px] uppercase tracking-tighter">Syncing Protocol...</p>
      </div>
    )
  }
)

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 🛡️ Hydration Guard: Pure black screen until client-side is ready
  if (!mounted) return <div className="min-h-screen bg-black" />

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-4">
      <div className="w-full max-w-md">

        {/* 🛠️ MAIN COMPONENT CONTAINER */}
        <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900 shadow-2xl relative">
          <OneClickMigrator />
        </div>

        {/* 📡 STATUS BAR */}
        <footer className="mt-8 text-center space-y-2 opacity-60">
          <div className="flex items-center justify-center gap-2">
            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
              Ghost Protocol Active
            </span>
          </div>
          <p className="text-[9px] text-zinc-700 font-mono tracking-tighter">
            SECURE_RELAY_v6.2.0
          </p>
        </footer>
      </div>
    </main>
  )
}