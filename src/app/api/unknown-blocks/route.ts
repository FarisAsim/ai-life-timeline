import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { listOpenBlocks, listAllBlocks } from '@/lib/services/gap-detection-service'
import { generateAiGuess } from '@/lib/services/companion-service'
import { resolveBlockWithText, resolveBlockAsUnknown, deleteBlock } from '@/lib/services/gap-detection-service'

export async function GET(req: NextRequest) {
  const user = await getDemoUser()
  const all = req.nextUrl.searchParams.get('all') === 'true'
  const blocks = all ? await listAllBlocks(user.id) : await listOpenBlocks(user.id)
  return NextResponse.json({ blocks })
}

// Resolve a block with text, or generate an AI guess
export async function POST(req: NextRequest) {
  const user = await getDemoUser()
  const body = await req.json()
  const { action, blockId } = body
  if (!blockId) return NextResponse.json({ error: 'blockId required' }, { status: 400 })

  if (action === 'ai_guess') {
    const guess = await generateAiGuess(user.id, blockId)
    return NextResponse.json({ guess })
  }
  if (action === 'resolve_text') {
    const { title, categoryId, description } = body
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const result = await resolveBlockWithText(user.id, blockId, title, categoryId ?? null, description)
    if (!result) return NextResponse.json({ error: 'block not found' }, { status: 404 })
    return NextResponse.json(result)
  }
  if (action === 'confirm_unknown') {
    const block = await resolveBlockAsUnknown(user.id, blockId)
    if (!block) return NextResponse.json({ error: 'block not found' }, { status: 404 })
    return NextResponse.json({ block })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const user = await getDemoUser()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const ok = await deleteBlock(user.id, id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
