import { NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { db } from '@/lib/db'
import { DEFAULT_CATEGORIES } from '@/lib/types'

// Full account deletion — right to be forgotten (PRD §9)
// Deletes all user data and re-creates a fresh empty account.
export async function DELETE() {
  const user = await getDemoUser()

  // Delete all user data in dependency order
  await db.notification.deleteMany({ where: { userId: user.id } })
  await db.aIMessage.deleteMany({
    where: { conversation: { userId: user.id } },
  })
  await db.aIConversation.deleteMany({ where: { userId: user.id } })
  await db.unknownBlock.deleteMany({ where: { userId: user.id } })
  await db.timelineEvent.deleteMany({ where: { userId: user.id } })
  await db.habitPattern.deleteMany({ where: { userId: user.id } })
  await db.category.deleteMany({ where: { userId: user.id } })
  await db.user.delete({ where: { id: user.id } })

  // Re-create a fresh empty user with default categories
  const newUser = await db.user.create({
    data: {
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      quietHoursStart: user.quietHoursStart,
      quietHoursEnd: user.quietHoursEnd,
      categories: {
        create: DEFAULT_CATEGORIES.map((c) => ({
          name: c.name,
          color: c.color,
          icon: c.icon,
          isDefault: true,
        })),
      },
    },
  })

  return NextResponse.json({ ok: true, newUserId: newUser.id, message: 'All data deleted and a fresh account created.' })
}
