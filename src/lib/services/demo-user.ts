import { db } from '@/lib/db'
import { DEFAULT_CATEGORIES } from '@/lib/types'

// The app supports device-level multi-account auth (see auth-service.ts).
// The "active" account is stored in localStorage (server cannot read it),
// so API routes pass the active account id from the request body/header
// when set, and fall back to the legacy single demo user otherwise.
const DEMO_EMAIL = 'demo@life-timeline.app'

export async function getDemoUser(preferredId?: string) {
  let user = preferredId
    ? await db.user.findUnique({ where: { id: preferredId }, include: { categories: true } })
    : null
  if (!user) user = await db.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { categories: true },
  })
  if (!user) {
    user = await db.user.create({
      data: {
        email: DEMO_EMAIL,
        name: 'You',
        timezone: 'Africa/Cairo',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        categories: {
          create: DEFAULT_CATEGORIES.map((c) => ({
            name: c.name,
            color: c.color,
            icon: c.icon,
            isDefault: true,
          })),
        },
      },
      include: { categories: true },
    })
  }
  return user
}

export type DemoUser = Awaited<ReturnType<typeof getDemoUser>>
