import { NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'

export async function GET() {
  const user = await getDemoUser()
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone, quietHoursStart: user.quietHoursStart, quietHoursEnd: user.quietHoursEnd } })
}
