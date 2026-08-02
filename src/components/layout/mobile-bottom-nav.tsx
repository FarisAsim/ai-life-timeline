'use client'

import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import {
  LayoutList, CalendarDays, CircleHelp, Sparkles, Compass,
} from 'lucide-react'
import type { ViewName } from '@/lib/types'
import { motion } from 'framer-motion'

const MOBILE_NAV: { id: ViewName; icon: typeof LayoutList; label: string }[] = [
  { id: 'timeline', icon: LayoutList, label: 'Timeline' },
  { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
  { id: 'unknown', icon: CircleHelp, label: 'Gaps' },
  { id: 'insights', icon: Compass, label: 'Insights' },
  { id: 'companion', icon: Sparkles, label: 'AI' },
]

export function MobileBottomNav() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t bg-background/95 backdrop-blur-lg md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              active ? 'text-emerald-600' : 'text-muted-foreground',
            )}
          >
            {active && (
              <motion.div
                layoutId="mobile-nav-active"
                className="absolute -top-px h-0.5 w-12 rounded-full bg-emerald-500"
                transition={{ duration: 0.2 }}
              />
            )}
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
