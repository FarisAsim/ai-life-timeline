import { db } from '@/lib/db'
import type { Category } from '@/lib/types'

export async function listCategories(userId: string): Promise<Category[]> {
  const cats = await db.category.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  })
  return cats.map((c) => ({ ...c, icon: c.icon }))
}

export async function getCategoryMap(userId: string): Promise<Map<string, Category>> {
  const cats = await listCategories(userId)
  return new Map(cats.map((c) => [c.id, c]))
}

export async function findCategoryByName(userId: string, name: string) {
  return db.category.findFirst({
    where: { userId, name: { equals: name } },
  })
}
