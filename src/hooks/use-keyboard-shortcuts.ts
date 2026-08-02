'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { ViewName } from '@/lib/types'

// Global keyboard shortcuts for navigation and actions.
// Shortcuts:
//   n  → new event (dispatches 'timeline:new-event' CustomEvent)
//   /  → focus search
//   c  → companion
//   t  → timeline
//   k  → calendar
//   u  → unknown blocks
//   i  → insights
//   s  → settings
export function useKeyboardShortcuts() {
  const setView = useAppStore((s) => s.setView)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      // Ignore if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      const viewMap: Record<string, ViewName> = {
        t: 'timeline',
        k: 'calendar',
        u: 'unknown',
        c: 'companion',
        i: 'insights',
        s: 'settings',
      }
      if (viewMap[key]) {
        e.preventDefault()
        setView(viewMap[key])
        return
      }
      if (key === '/') {
        e.preventDefault()
        setView('search')
        return
      }
      if (key === 'n') {
        e.preventDefault()
        // Ensure we're on the timeline view, then dispatch the new-event signal
        setView('timeline')
        window.dispatchEvent(new CustomEvent('timeline:new-event'))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setView])
}
