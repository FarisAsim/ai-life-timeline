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
  const { providerType, apiKey, baseUrl, model, sttModel, geminiApiKey, geminiModel } = body as {
    providerType?: 'openai' | 'gemini'
    apiKey?: string
    baseUrl?: string
    model?: string
    sttModel?: string
    geminiApiKey?: string
    geminiModel?: string
  }
  try {
    const cfg = updateAIConfig({
      providerType: providerType ?? 'openai',
      apiKey: apiKey ?? '',
      baseUrl: baseUrl ?? 'https://api.openai.com/v1',
      model: model ?? 'gpt-4o-mini',
      sttModel: sttModel ?? 'gpt-4o-transcribe',
      geminiApiKey: geminiApiKey ?? '',
      geminiModel: geminiModel ?? 'gemini-3.6-flash',
    })
    const key = cfg.providerType === 'gemini' ? cfg.geminiApiKey : cfg.apiKey
    return NextResponse.json({ ...cfg, configured: key.length > 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'update failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
