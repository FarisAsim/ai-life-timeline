import { db } from '@/lib/db'
import { addMinutes, subDays, startOfDay } from 'date-fns'
import { getDemoUser } from './demo-user'
import { detectGapsForDay } from './gap-detection-service'
import { findOverlappingEvent } from './overlap-service'

// Generates a realistic week of timeline events so the app has rich data on first load.
export async function seedDemoData() {
  const user = await getDemoUser()
  const cats = await db.category.findMany({ where: { userId: user.id } })
  const byName = new Map(cats.map((c) => [c.name, c]))

  const now = new Date()

  // Build events for the past 7 days (and a partial today)
  for (let dayOffset = 7; dayOffset >= 0; dayOffset--) {
    const day = subDays(now, dayOffset)
    const base = startOfDay(day)
    // Skip if future
    if (day > now) continue

    const isWeekend = day.getDay() === 5 || day.getDay() === 6 // Fri/Sat in Egypt
    const isToday = day.toDateString() === now.toDateString()

    type EvDef = { title: string; cat: string; startH: number; startM: number; dur: number; desc?: string; loc?: string }
    let schedule: EvDef[]

    if (isWeekend) {
      schedule = [
        { title: 'Morning Prayer', cat: 'Prayer', startH: 6, startM: 0, dur: 30, loc: 'Home' },
        { title: 'Breakfast', cat: 'Meals', startH: 7, startM: 15, dur: 45, loc: 'Home' },
        { title: 'Family Time', cat: 'Social', startH: 9, startM: 0, dur: 120, loc: 'Home' },
        { title: 'Quran Reading', cat: 'Prayer', startH: 11, startM: 30, dur: 45 },
        { title: 'Lunch', cat: 'Meals', startH: 13, startM: 0, dur: 60, loc: 'Home' },
        { title: 'Rest & Nap', cat: 'Sleep', startH: 14, startM: 15, dur: 75 },
        { title: 'Visit Friends', cat: 'Social', startH: 16, startM: 30, dur: 150, loc: "Friend's house" },
        { title: 'Dinner Out', cat: 'Meals', startH: 19, startM: 30, dur: 90, loc: 'Restaurant' },
        { title: 'Evening Walk', cat: 'Exercise', startH: 21, startM: 15, dur: 45, loc: 'Park' },
      ]
    } else {
      schedule = [
        { title: 'Fajr Prayer', cat: 'Prayer', startH: 5, startM: 30, dur: 30, loc: 'Home' },
        { title: 'Gym Session', cat: 'Exercise', startH: 6, startM: 15, dur: 60, loc: 'Gym' },
        { title: 'Breakfast', cat: 'Meals', startH: 7, startM: 30, dur: 30, loc: 'Home' },
        { title: 'Commute to Work', cat: 'Commute', startH: 8, startM: 15, dur: 45, loc: 'Road' },
        { title: 'Deep Work — Coding', cat: 'Work', startH: 9, startM: 15, dur: 150, loc: 'Office', desc: 'Worked on the new feature branch' },
        { title: 'Team Standup', cat: 'Work', startH: 11, startM: 45, dur: 30, loc: 'Office' },
        { title: 'Lunch Break', cat: 'Meals', startH: 12, startM: 30, dur: 60, loc: 'Office cafeteria' },
        { title: 'Study — Arabic', cat: 'Study', startH: 13, startM: 45, dur: 75, loc: 'Office' },
        { title: 'Meetings', cat: 'Work', startH: 15, startM: 15, dur: 90, loc: 'Office' },
        { title: 'Commute Home', cat: 'Commute', startH: 17, startM: 0, dur: 50, loc: 'Road' },
        { title: 'Asr Prayer', cat: 'Prayer', startH: 15, startM: 45, dur: 20 },
        { title: 'Dinner', cat: 'Meals', startH: 19, startM: 30, dur: 45, loc: 'Home' },
        { title: 'Reading Time', cat: 'Study', startH: 20, startM: 30, dur: 60, loc: 'Home' },
        { title: 'Social Media', cat: 'Screen Time', startH: 21, startM: 45, dur: 45 },
        { title: 'Maghrib Prayer', cat: 'Prayer', startH: 18, startM: 15, dur: 15 },
        { title: 'Isha Prayer', cat: 'Prayer', startH: 20, startM: 0, dur: 20 },
      ]
    }

    // For today, only insert events that have already ended
    for (const ev of schedule) {
      const start = new Date(base)
      start.setHours(ev.startH, ev.startM, 0, 0)
      const end = addMinutes(start, ev.dur)
      if (isToday && start > now) continue
      const cappedEnd = isToday && end > now ? now : end
      if (cappedEnd <= start) continue
      const cat = byName.get(ev.cat)
      // Avoid duplicates
      const existing = await db.timelineEvent.findFirst({
        where: { userId: user.id, title: ev.title, startTime: start },
      })
      if (existing) continue
      // Skip this event if it would overlap an already-seeded event
      // (keeps the timeline overlap-free, honoring the PRD design)
      const conflict = await findOverlappingEvent(user.id, start, cappedEnd)
      if (conflict) continue
      await db.timelineEvent.create({
        data: {
          userId: user.id,
          title: ev.title,
          description: ev.desc ?? null,
          startTime: start,
          endTime: cappedEnd,
          durationMinutes: Math.max(1, Math.round((cappedEnd.getTime() - start.getTime()) / 60000)),
          location: ev.loc ?? null,
          categoryId: cat?.id ?? null,
          confidenceScore: 0.95,
          source: 'integration',
        },
      })
    }

    // Deliberately leave some gaps so Unknown Blocks can be detected
    // (the seed schedule already has natural gaps between activities)

    // Run gap detection for each past day
    await detectGapsForDay(user.id, day.toISOString().slice(0, 10))
  }

  // Create a welcome notification
  const existingNotif = await db.notification.findFirst({ where: { userId: user.id, type: 'insight' } })
  if (!existingNotif) {
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'insight',
        title: 'Welcome to your Life Timeline',
        body: 'I have seeded a week of sample data so you can explore. Visit the Unknown Blocks tab to see detected gaps.',
        actionType: 'view_insight',
      },
    })
  }

  return { seeded: true, dayCount: 8 }
}
