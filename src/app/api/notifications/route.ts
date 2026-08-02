import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { listNotifications, markRead, markAllRead, countUnread, runNotificationEngine } from '@/lib/services/notification-service'

export async function GET(req: NextRequest) {
  const user = await getDemoUser()
  const onlyUnread = req.nextUrl.searchParams.get('unread') === 'true'
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id, onlyUnread),
    countUnread(user.id),
  ])
  return NextResponse.json({ notifications, unreadCount })
}

export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  if (body.action === 'run_engine') {
    const created = await runNotificationEngine(user.id)
    return NextResponse.json({ created, count: created.length })
  }
  if (body.action === 'mark_all_read') {
    await markAllRead(user.id)
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'mark_read' && body.notificationId) {
    const n = await markRead(user.id, body.notificationId)
    if (!n) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
