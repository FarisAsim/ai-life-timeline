import { db } from '@/lib/db'
import type { Category } from '@/lib/types'

export interface EventTemplateData {
  id: string
  title: string
  categoryId: string | null
  category: Category | null
  durationMin: number
  description: string | null
  icon: string | null
  createdAt: string
}

function serialize(t: Awaited<ReturnType<typeof db.eventTemplate.findFirst>> & object, cat: Category | null): EventTemplateData {
  return {
    id: t.id,
    title: t.title,
    categoryId: t.categoryId,
    category: cat,
    durationMin: t.durationMin,
    description: t.description,
    icon: t.icon,
    createdAt: t.createdAt.toISOString(),
  }
}

export async function listTemplates(userId: string): Promise<EventTemplateData[]> {
  const templates = await db.eventTemplate.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
  })
  const catIds = [...new Set(templates.map((t) => t.categoryId).filter(Boolean))] as string[]
  const cats = catIds.length ? await db.category.findMany({ where: { id: { in: catIds } } }) : []
  const catMap = new Map(cats.map((c) => [c.id, { ...c, icon: c.icon }]))
  return templates.map((t) => serialize(t, t.categoryId ? catMap.get(t.categoryId) ?? null : null))
}

export async function createTemplate(userId: string, input: { title: string; categoryId?: string | null; durationMin?: number; description?: string; icon?: string }): Promise<EventTemplateData> {
  const t = await db.eventTemplate.create({
    data: {
      userId,
      title: input.title,
      categoryId: input.categoryId ?? null,
      durationMin: input.durationMin ?? 60,
      description: input.description ?? null,
      icon: input.icon ?? null,
    },
  })
  const cat = t.categoryId ? await db.category.findUnique({ where: { id: t.categoryId } }) : null
  return serialize(t, cat ? { ...cat, icon: cat.icon } : null)
}

export async function deleteTemplate(userId: string, id: string): Promise<boolean> {
  const t = await db.eventTemplate.findFirst({ where: { id, userId } })
  if (!t) return false
  await db.eventTemplate.delete({ where: { id } })
  return true
}
