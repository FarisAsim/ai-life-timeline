import { create } from 'zustand'
import { format } from 'date-fns'
import type { ViewName } from '@/lib/types'

interface AppState {
  // Navigation
  view: ViewName
  setView: (v: ViewName) => void

  // Selected date for timeline
  selectedDate: string // YYYY-MM-DD
  setSelectedDate: (d: string) => void

  // Sidebar collapsed (mobile)
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Notifications panel
  notifPanelOpen: boolean
  setNotifPanelOpen: (open: boolean) => void

  // Companion panel open (drawer on the right)
  companionOpen: boolean
  setCompanionOpen: (open: boolean) => void

  // Refresh tick — bump to invalidate queries
  refreshTick: number
  triggerRefresh: () => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'timeline',
  setView: (v) => set({ view: v }),

  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  setSelectedDate: (d) => set({ selectedDate: d }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  notifPanelOpen: false,
  setNotifPanelOpen: (open) => set({ notifPanelOpen: open }),

  companionOpen: false,
  setCompanionOpen: (open) => set({ companionOpen: open }),

  refreshTick: 0,
  triggerRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}))
