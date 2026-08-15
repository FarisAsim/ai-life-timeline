/**
 * Background reminder endpoint consumed by the service worker.
 * Returns due reminders right now:
 *   1. Gap prompts — an open unknown block older than the reminder threshold
 *      (default 60 min) still unresolved.
 *   2. Quiet-hours guard — never fires inside quiet hours.
 *   3. Inactive-logging nudge — no event recorded in the last 3 hours
 *      during waking hours.
 */
import { NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { db } from '@/lib/db'

function isQuiet(user: { quietHoursStart: string | null; quietHoursEnd: string | null; timezone?: string | null }, now: Date): boolean {
  if (!user.quietHoursStart || !user.quietHoursEnd) return false
  const inTz = (d: Date) => {
    try {
      return new Date(d.toLocaleString('en-US', { timeZone: user.timezone || 'Africa/Cairo' }).replace(/\u200E|\u200F/g, ''))
    } catch {
      return d
    }
  }
  const local = inTz(now)
  const hhmm = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`
  const start = user.quietHoursStart
  const end = user.quietHoursEnd
  return start < end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end
}

export async function GET() {
  try {
    const user = await getDemoUser()
    const now = new Date()
    if (isQuiet(user, now)) return NextResponse.json({ reminders: [] })

    const reminders: { title: string; body: string; tag: string; data?: object }[] = []

    // 1. Open gap older than threshold (per user; default 60 min)
    const threshold = new Date(now.getTime() - 60 * 60 * 1000)
    const openGap = await db.unknownBlock.findFirst({
      where: {
        userId: user.id,
        status: 'open',
        startTime: { lte: threshold },
      },
      orderBy: { startTime: 'desc' },
    })
    if (openGap) {
      const startH = new Date(openGap.startTime).getHours()
      const label = startH >= 5 && startH < 12 ? 'الصبح' : startH >= 12 && startH < 17 ? 'الضهر' : startH >= 17 && startH < 21 ? 'المغرب' : 'الليل'
      reminders.push({
        title: 'فاتك وقت من غير تسجيل',
        body: `عندك وقت من (${label}) لسه مش مسجّل — افتح التطبيق وقلّي كنت بتعمل إيه.`,
        tag: 'lt-gap-prompt',
        data: { path: '/unknown' },
      })
    }

    // 2. Inactivity nudge (no event in last 3h during waking hours 8-22)
    const localHour = new Date(now.toLocaleString('en-US', { timeZone: user.timezone || 'Africa/Cairo' })).getUTCHours()
    if (localHour >= 8 && localHour < 22) {
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
      const recent = await db.timelineEvent.count({
        where: { userId: user.id, startTime: { gte: threeHoursAgo } },
      })
      if (recent === 0) {
        reminders.push({
          title: 'يومك ماشي إزاي؟',
          body: 'من 3 ساعات محدش سجّل حاجة — افتح التطبيق وأضف آخر اللي عملته.',
          tag: 'lt-inactivity',
          data: { path: '/' },
        })
      }
    }

    return NextResponse.json({ reminders })
  } catch {
    return NextResponse.json({ reminders: [] })
  }
}
