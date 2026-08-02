'use client'

import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  LayoutList, CalendarDays, CircleHelp, Compass, Mic,
} from 'lucide-react'
import type { ViewName } from '@/lib/types'
import { motion } from 'framer-motion'
import { VoiceCaptureDialog } from '@/components/timeline/voice-capture-dialog'

const MOBILE_NAV: { id: ViewName; icon: typeof LayoutList; label: string }[] = [
  { id: 'timeline', icon: LayoutList, label: 'Home' },
  { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
  { id: 'unknown', icon: CircleHelp, label: 'Gaps' },
  { id: 'insights', icon: Compass, label: 'Stats' },
]

export function MobileBottomNav() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t bg-background/95 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Left side: 2 items */}
        {MOBILE_NAV.slice(0, 2).map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-emerald-600' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          )
        })}

        {/* Center: Voice capture button */}
        <button
          onClick={() => setVoiceOpen(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-95"
          aria-label="Voice capture"
        >
          <Mic className="h-5 w-5" />
        </button>

        {/* Right side: 2 items */}
        {MOBILE_NAV.slice(2, 4).map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-emerald-600' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <VoiceCaptureDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
    </>
  )
}
