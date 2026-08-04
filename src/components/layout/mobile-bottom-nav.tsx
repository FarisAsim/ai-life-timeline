'use client'

import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  LayoutList, CalendarDays, CircleHelp, Compass, Mic,
} from 'lucide-react'
import type { ViewName } from '@/lib/types'
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
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/50 glass"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          height: 'calc(4rem + env(safe-area-inset-bottom))',
        }}
        aria-label="Mobile navigation"
      >
        {/* Left items */}
        {MOBILE_NAV.slice(0, 2).map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                'flex h-14 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg transition-colors',
                active ? 'text-emerald-600' : 'text-muted-foreground',
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}

        {/* Center: Voice capture — prominent 56px button with glow */}
        <button
          onClick={() => setVoiceOpen(true)}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/40 transition-transform active:scale-90 pulse-glow"
          aria-label="Record voice to add event"
        >
          <Mic className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Right items */}
        {MOBILE_NAV.slice(2, 4).map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                'flex h-14 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg transition-colors',
                active ? 'text-emerald-600' : 'text-muted-foreground',
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <VoiceCaptureDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
    </>
  )
}
