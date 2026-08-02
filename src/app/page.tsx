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

  // No auto-seed — the app starts empty for real use.
  // Users can seed demo data via the "Seed demo data" button in the header or Settings.

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-16">
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

      {/* Floating companion quick-access button — desktop only */}
      {view !== 'companion' && <CompanionFab />}

      <NotificationsPanel />

      {/* Mobile bottom navigation (includes voice capture button) */}
      <MobileBottomNav />

      {/* Onboarding welcome dialog (shows on first visit with no data) */}
      <WelcomeDialog hasData={(settings?.stats?.eventCount ?? 0) > 0} />

      {/* Sticky footer — hidden on mobile (replaced by bottom nav) */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 hidden border-t bg-background/80 backdrop-blur-md md:block">
        <div className="flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground md:px-6">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            AI Life Timeline — Never lose a moment
          </span>
          <span className="hidden items-center gap-3 sm:flex">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold">T</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold">K</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold">U</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold">C</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold">I</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold">/</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold">N</kbd>
            <span className="ml-1">navigate</span>
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
      className="fixed bottom-12 right-6 z-20 hidden items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105 md:flex"
      aria-label="Open AI Companion"
    >
      <Sparkles className="h-4 w-4" />
      <span>Ask AI</span>
    </button>
  )
}

