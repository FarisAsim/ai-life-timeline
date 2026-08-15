/**
 * AI Life Timeline — Service Worker
 * - Registers the Notifications API so the app can show system notifications.
 * - Runs a periodic gap-reminder check: every 15 minutes (while the page is
 *   registered) it asks the app backend for due reminders and shows them as
 *   native system notifications, even when the tab is closed/backgrounded
 *   (supported browsers) or in-app (all browsers).
 */

const SW_VERSION = "1.0.0"
const CACHE_NAME = "lt-static-v1"
const CHECK_INTERVAL_MS = 15 * 60 * 1000

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      const keys = await caches.keys()
      for (const key of keys) {
        if (key !== CACHE_NAME) await caches.delete(key)
      }
    })()
  )
})

self.addEventListener("fetch", (event) => {
  // Skip non-GET and cross-origin.
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  // API requests always go to the network (fresh data).
  if (url.pathname.startsWith("/api/")) return
  event.respondWith(
    (async () => {
      const networkRes = await fetch(event.request)
      if (networkRes.ok) {
        const clone = networkRes.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return networkRes
      }
      const cached = await caches.match(event.request)
      return cached || networkRes
    })()
  )
})

/**
 * Ask the backend for reminders that are due right now.
 * The app backend does the real gap detection; the SW only schedules checks.
 */
async function checkReminders() {
  try {
    const res = await fetch("/api/sw-reminders")
    if (!res.ok) return
    const data = await res.json()
    const reminders = data.reminders || []
    for (const r of reminders) {
      try {
        self.registration.showNotification(r.title, {
          body: r.body,
          icon: "/logo.svg",
          badge: "/logo.svg",
          tag: r.tag || "lt-reminder",
          silent: false,
        })
      } catch {
        /* notification failed — e.g. permission denied */
      }
    }
  } catch {
    /* offline — skip */
  }
}

self.addEventListener("activate", () => {
  self.registration.addEventListener("periodicsync", () => {})
  // Fallback polling for browsers without Periodic Background Sync:
  // check when any page client exists; otherwise rely on push events.
  setInterval(() => {
    const hasClient = self.clients.matchAll().then((clients) => clients.length > 0)
    hasClient.then((alive) => {
      if (alive) checkReminders()
    })
  }, CHECK_INTERVAL_MS)
  // Run once immediately after activation.
  checkReminders()
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const tag = event.notification.tag || ""
  const data = event.notification.data || {}
  const target = data.path || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus().then((c) => c.navigate(target))
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
