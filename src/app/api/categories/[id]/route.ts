import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { db } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getDemoUser()
  const { id } = await params
  const cat = await db.category.findFirst({ where: { id, userId: user.id } })
  if (!cat) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (cat.isDefault) return NextResponse.json({ error: 'cannot delete default category' }, { status: 400 })
  // Check if any events use this category
  const eventCount = await db.timelineEvent.count({ where: { categoryId: id } })
  if (eventCount > 0) {
    // Null out the categoryId on those events rather than blocking
    await db.timelineEvent.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
  }
  await db.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
