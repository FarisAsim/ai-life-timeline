import { db } from '@/lib/db'
import { DEFAULT_CATEGORIES } from '@/lib/types'

// For MVP we operate on a single demo user (no auth complexity).
// This keeps the architecture ready to add real auth later.
const DEMO_EMAIL = 'demo@life-timeline.app'

export async function getDemoUser() {
  let user = await db.user.findUnique({
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
