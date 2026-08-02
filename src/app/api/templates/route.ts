import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { listTemplates, createTemplate } from '@/lib/services/template-service'

export async function GET() {
  const user = await getDemoUser()
  const templates = await listTemplates(user.id)
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  const { title, categoryId, durationMin, description, icon } = body
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const tpl = await createTemplate(user.id, { title, categoryId: categoryId ?? null, durationMin, description, icon })
  return NextResponse.json({ template: tpl })
}
