import { NextResponse } from 'next/server'
import { seedDemoData } from '@/lib/services/seed-service'

export async function POST() {
  const result = await seedDemoData()
  return NextResponse.json(result)
}
