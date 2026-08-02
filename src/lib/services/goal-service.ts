import { db } from '@/lib/db'
import type { Category } from '@/lib/types'
import { subDays } from 'date-fns'

export interface GoalData {
  id: string
  title: string
  type: string // category_hours | event_count | completion_pct
  categoryId: string | null
  category: Category | null
  targetValue: number
  period: string // weekly | monthly
  currentValue: number
  progress: number // 0..1
  createdAt: string
}

function serialize(g: Awaited<ReturnType<typeof db.goal.findFirst>> & object, cat: Category | null, currentValue: number): GoalData {
  return {
    id: g.id,
    title: g.title,
    type: g.type,
    categoryId: g.categoryId,
    category: cat,
    targetValue: g.targetValue,
    period: g.period,
    currentValue,
    progress: g.targetValue > 0 ? Math.min(1, currentValue / g.targetValue) : 0,
    createdAt: g.createdAt.toISOString(),
  }
}

export async function listGoals(userId: string): Promise<GoalData[]> {
  const goals = await db.goal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  const catIds = [...new Set(goals.map((g) => g.categoryId).filter(Boolean))] as string[]
  const cats = catIds.length ? await db.category.findMany({ where: { id: { in: catIds } } }) : []
  const catMap = new Map(cats.map((c) => [c.id, { ...c, icon: c.icon }]))

  // Compute current values
  const now = new Date()
  const weekStart = subDays(now, 7)
  const monthStart = subDays(now, 30)

  const result: GoalData[] = []
  for (const g of goals) {
    const startDate = g.period === 'weekly' ? weekStart : monthStart
    let currentValue = 0

    if (g.type === 'category_hours' && g.categoryId) {
      const events = await db.timelineEvent.findMany({
        where: { userId, categoryId: g.categoryId, startTime: { gte: startDate, lte: now } },
        select: { durationMinutes: true },
      })
      currentValue = events.reduce((s, e) => s + e.durationMinutes, 0) / 60
    } else if (g.type === 'event_count') {
      const where: { userId: string; startTime: { gte: Date; lte: Date }; categoryId?: string } = { userId, startTime: { gte: startDate, lte: now } }
      if (g.categoryId) where.categoryId = g.categoryId
      currentValue = await db.timelineEvent.count({ where })
    } else if (g.type === 'completion_pct') {
      // Average completion over the period
      const events = await db.timelineEvent.findMany({
        where: { userId, startTime: { gte: startDate, lte: now } },
        select: { durationMinutes: true },
      })
      const totalMin = events.reduce((s, e) => s + e.durationMinutes, 0)
      const days = g.period === 'weekly' ? 7 : 30
      const possibleMin = days * 17 * 60 // 17 waking hours per day
      currentValue = possibleMin > 0 ? Math.round((totalMin / possibleMin) * 100) : 0
    }

    result.push(serialize(g, g.categoryId ? catMap.get(g.categoryId) ?? null : null, currentValue))
  }
  return result
}

export async function createGoal(userId: string, input: { title: string; type: string; categoryId?: string | null; targetValue: number; period: string }): Promise<GoalData> {
  const g = await db.goal.create({
    data: {
      userId,
      title: input.title,
      type: input.type,
      categoryId: input.categoryId ?? null,
      targetValue: input.targetValue,
      period: input.period,
    },
  })
  return serialize(g, null, 0)
}

export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const g = await db.goal.findFirst({ where: { id, userId } })
  if (!g) return false
  await db.goal.delete({ where: { id } })
  return true
}
