'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { NotificationsPanel } from '@/components/notifications/notifications-panel'
import { TimelineView } from '@/components/timeline/timeline-view'
import { CalendarView } from '@/components/calendar/calendar-view'
import { UnknownBlocksView } from '@/components/unknown-blocks/unknown-blocks-view'
import { CompanionView } from '@/components/companion/companion-view'
import { InsightsView } from '@/components/insights/insights-view'
import { SearchView } from '@/components/search/search-view'
import { useSeed } from '@/hooks/use-data'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

export default function Home() {
  const view = useAppStore((s) => s.view)
  const seed = useSeed()

  // Auto-seed demo data on first load so the app is immediately useful
  useEffect(() => {
    seed.mutate(undefined, {
      onSuccess: (d: { seeded?: boolean } | undefined) => {
        if (d?.seeded) toast.success('Welcome — demo data is loaded. Explore your timeline!')
      },
      onError: () => {
        /* ignore — may already be seeded */
      },
    })
  }, []) // run once on mount

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-y-auto pb-16">
            {view === 'timeline' && <TimelineView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'unknown' && <UnknownBlocksView />}
            {view === 'companion' && <CompanionView />}
            {view === 'insights' && <InsightsView />}
            {view === 'search' && <SearchView />}
          </main>
        </div>
      </div>

      {/* Floating companion quick-access button (visible on all views except companion itself) */}
      {view !== 'companion' && <CompanionFab />}

      <NotificationsPanel />

      {/* Sticky footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground md:px-6">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            AI Life Timeline — Never lose a moment
          </span>
          <span className="hidden sm:inline">Hour-by-hour · Gap detection · Habit learning</span>
        </div>
      </footer>
    </div>
  )
}

function CompanionFab() {
  const setView = useAppStore((s) => s.setView)
  return (
    <button
      onClick={() => setView('companion')}
      className="fixed bottom-12 right-4 z-20 flex items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105 md:right-6"
      aria-label="Open AI Companion"
    >
      <Sparkles className="h-4 w-4" />
      <span className="hidden sm:inline">Ask AI</span>
    </button>
  )
}

void Button
