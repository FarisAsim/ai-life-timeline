'use client'

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
import { SettingsView } from '@/components/settings/settings-view'
import { WelcomeDialog } from '@/components/onboarding/welcome-dialog'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { useSettings } from '@/hooks/use-data'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { Sparkles } from 'lucide-react'

export default function Home() {
  const view = useAppStore((s) => s.view)
  const { data: settings } = useSettings()

  useKeyboardShortcuts()

  return (
    <div className="min-h-screen bg-background bg-mesh">
      {/* Desktop: sidebar + content side by side */}
      <div className="flex md:flex-row flex-col">
        <AppSidebar />

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col min-h-screen">
          <AppHeader />
          <main
            className="flex-1 overflow-y-auto pb-24 md:pb-8"
            aria-label="Main content"
          >
            {view === 'timeline' && <TimelineView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'unknown' && <UnknownBlocksView />}
            {view === 'companion' && <CompanionView />}
            {view === 'insights' && <InsightsView />}
            {view === 'search' && <SearchView />}
            {view === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>

      {/* Desktop: floating companion button + footer */}
      {view !== 'companion' && <CompanionFab />}

      <NotificationsPanel />

      {/* Mobile: bottom navigation with center voice button */}
      <MobileBottomNav />

      {/* Onboarding */}
      <WelcomeDialog hasData={(settings?.stats?.eventCount ?? 0) > 0} />

      {/* Desktop footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 hidden border-t bg-background/80 backdrop-blur-md md:block">
        <div className="flex items-center justify-between px-6 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-emerald-500" aria-hidden="true" />
            AI Life Timeline — Never lose a moment
          </span>
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
      className="fixed bottom-6 right-6 z-20 hidden items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105 md:flex"
      aria-label="Open AI Companion"
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>Ask AI</span>
    </button>
  )
}
