/**
 * Data export / import endpoints.
 * GET  ?download=1        → full JSON export of the current user's data.
 * GET  ?preview=1          → counts summary (cheap, no blob attachment data).
 * POST with JSON body      → import a previously exported snapshot (additive).
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveUser } from '@/lib/api-account'
import { exportAllData, importAllData, validateImportData, type ExportedData } from '@/lib/services/export-service'

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(request)
    const includeBlobs = request.nextUrl.searchParams.get('blobs') === '1'
    const data = await exportAllData(user.id, includeBlobs)

    if (request.nextUrl.searchParams.get('preview') === '1') {
      return NextResponse.json({
        counts: {
          events: data.events.length,
          categories: data.categories.length,
          unknownBlocks: data.unknownBlocks.length,
          conversations: data.conversations.length,
          notifications: data.notifications.length,
          habitPatterns: data.habitPatterns.length,
          templates: data.templates.length,
          goals: data.goals.length,
        },
        exportedAt: data.exportedAt,
      })
    }

    return new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="ai-life-timeline-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'فشل التصدير' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateImportData(body)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const user = await resolveUser(request)
    const counts = await importAllData(user.id, body as ExportedData)
    return NextResponse.json({ ok: true, counts })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'فشل الاستيراد' }, { status: 500 })
  }
}
