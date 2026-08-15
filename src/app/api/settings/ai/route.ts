import { NextRequest, NextResponse } from 'next/server'
import { getDemoUser } from '@/lib/services/demo-user'
import { getAIConfig, updateAIConfig } from '@/lib/ai-config'

// Read current AI provider configuration
export async function GET() {
  await getDemoUser()
  return NextResponse.json(getAIConfig())
}

// Update AI provider configuration (persisted to a local config file; applied at runtime)
export async function POST(req: NextRequest) {
  await getDemoUser()
  const body = await req.json()
  const { apiKey, baseUrl, model, sttModel } = body as {
    apiKey?: string
    baseUrl?: string
    model?: string
    sttModel?: string
  }
  try {
    const cfg = updateAIConfig({
      apiKey: apiKey ?? '',
      baseUrl: baseUrl ?? 'https://api.openai.com/v1',
      model: model ?? 'gpt-4o-mini',
      sttModel: sttModel ?? 'gpt-4o-transcribe',
    })
    return NextResponse.json({ ...cfg, configured: cfg.apiKey.length > 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'update failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
