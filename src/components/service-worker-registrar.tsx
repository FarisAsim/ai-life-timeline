'use client'

import { useEffect } from 'react'
import { apiFetch } from '@/hooks/use-data'

/**
 * Registers the app service worker (reminders, offline cache) and asks for
 * the Notifications permission on first visit. Safe to run in any browser:
 * non-supporting browsers simply skip registration.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    let cancelled = false
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        // Ask for notification permission once (on interaction, browsers may
        // ignore requests without user gesture — the toast in the app is the
        // primary path; this is a soft background request).
        if (!cancelled && Notification.permission === 'default') {
          Notification.requestPermission()
        }
        // Immediate check so reminders fire even before the 15-minute interval.
        try {
          const res = await apiFetch('/api/sw-reminders')
          if (res.ok) {
            const data = await res.json()
            for (const r of data.reminders || []) {
              if (Notification.permission === 'granted') {
                new Notification(r.title, { body: r.body, icon: '/logo.svg', tag: r.tag })
              }
            }
          }
        } catch {
          /* offline */
        }
        void registration
      } catch {
        /* SW registration failed (e.g. non-HTTPS) — reminders still work via the toast system in-app */
      }
    }

    // Wait for the page to settle, then register.
    const timer = window.setTimeout(register, 1500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return null
}
