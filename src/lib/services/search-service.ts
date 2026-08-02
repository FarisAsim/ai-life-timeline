import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import type { TimelineEvent, Category } from '@/lib/types'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

export interface SearchResult {
  event: TimelineEvent
  score: number
  reason: string
}

// Semantic search via LLM ranking.
// We fetch candidate events (bounded set) and ask the LLM to rank them
// against the query, returning matched IDs with relevance scores.
export async function semanticSearch(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  // Pull a reasonable candidate window: last 90 days of events.
  const end = new Date()
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
  const events = await db.timelineEvent.findMany({
    where: { userId, startTime: { gte: start, lte: end } },
    include: { attachments: { where: { type: 'voice_note' }, select: { transcript: true } } },
    orderBy: { startTime: 'desc' },
    take: 200,
  })
  if (events.length === 0) return []

  const cats = await db.category.findMany({ where: { userId } })
  const catMap = new Map<string, Category>()
  cats.forEach((c) => catMap.set(c.id, { ...c, icon: c.icon }))

  // Pre-filter with keyword matching to shrink the candidate set cheaply.
  const keywords = q.split(/\s+/).filter((w) => w.length > 2)
  const preFiltered = events.filter((e) => {
    const voiceText = (e.attachments ?? []).map((a) => a.transcript ?? '').filter(Boolean).join(' ')
    const tags = e.tags ? e.tags.split(',').map((t) => `#${t.trim()}`).join(' ') : ''
    const hay = `${e.title} ${e.description ?? ''} ${e.notes ?? ''} ${e.location ?? ''} ${voiceText} ${tags}`.toLowerCase()
    if (keywords.every((k) => hay.includes(k))) return true
    // also keep events whose category name matches
    const cat = e.categoryId ? catMap.get(e.categoryId) : null
    if (cat && cat.name.toLowerCase().includes(q)) return true
    return false
  })

  const candidates = preFiltered.length > 0 ? preFiltered.slice(0, 60) : events.slice(0, 40)

  const zai = await getZAI()

  const candidateText = candidates
    .map((e, i) => {
      const cat = e.categoryId ? catMap.get(e.categoryId) : null
      const start = format(e.startTime, 'MMM d, yyyy h:mm a')
      const voiceText = (e.attachments ?? []).map((a) => a.transcript ?? '').filter(Boolean).join(' / ')
      return `[${i}] id=${e.id} | ${start} | "${e.title}" | cat=${cat?.name ?? 'none'} | desc=${e.description ?? ''} | loc=${e.location ?? ''}${voiceText ? ` | voice="${voiceText}"` : ''}`
    })
    .join('\n')

  const prompt = `You are a semantic search engine over a personal life timeline.
Query: "${query}"
Candidate events:
${candidateText}

Return ONLY a JSON array of objects with the most relevant matches (max 20). Each object: {"index": <number>, "score": 0.0-1.0, "reason": "one short phrase why it matches"}. Use the index number from the candidates list. Only include events that genuinely match the query intent (semantic match — even if words differ). If nothing matches, return [].`

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'You output strictly valid JSON arrays with no extra text or markdown.' },
      { role: 'user', content: prompt },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  let rankings: { index: number; score: number; reason: string }[] = []
  try {
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    rankings = JSON.parse(cleaned)
  } catch {
    // Fallback: rank by keyword overlap score
    rankings = candidates.map((e, i) => {
      const hay = `${e.title} ${e.description ?? ''}`.toLowerCase()
      const overlap = keywords.filter((k) => hay.includes(k)).length
      return { index: i, score: overlap / Math.max(1, keywords.length), reason: 'keyword match' }
    })
  }

  const results: SearchResult[] = []
  for (const r of rankings) {
    if (r.index < 0 || r.index >= candidates.length) continue
    const e = candidates[r.index]
    const cat = e.categoryId ? catMap.get(e.categoryId) ?? null : null
    results.push({
      event: {
        id: e.id,
        userId: e.userId,
        title: e.title,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        durationMinutes: e.durationMinutes,
        location: e.location,
        notes: e.notes,
        categoryId: e.categoryId,
        category: cat,
        confidenceScore: e.confidenceScore,
        source: e.source as TimelineEvent['source'],
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      },
      score: r.score,
      reason: r.reason,
    })
    if (results.length >= limit) break
  }

  return results.sort((a, b) => b.score - a.score)
}
