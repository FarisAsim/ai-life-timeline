import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { listCategories } from '@/lib/services/category-service'

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  const categories = await listCategories(user.id)
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  const body = await req.json()
  const { name, color, icon } = body
  if (!name || !color) return NextResponse.json({ error: 'name and color required' }, { status: 400 })
  // upsert by name
  const existing = await import('@/lib/db').then(m => m.db.category.findFirst({ where: { userId: user.id, name: { equals: name } } }))
  if (existing) {
    const updated = await import('@/lib/db').then(m => m.db.category.update({ where: { id: existing.id }, data: { color, icon: icon ?? existing.icon } }))
    return NextResponse.json({ category: updated })
  }
  const cat = await import('@/lib/db').then(m => m.db.category.create({ data: { userId: user.id, name, color, icon: icon ?? null } }))
  return NextResponse.json({ category: cat })
}
