/**
 * Runtime AI configuration store.
 * Reads AI provider settings from:
 *   1. A persisted local JSON file (./ai.config.json) — settable from the Settings UI.
 *   2. Falls back to environment variables (AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_STT_MODEL).
 *
 * Values from the local file take precedence, so changes in the Settings UI
 * take effect immediately without restart.
 */
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'ai.config.json')

export type AIProviderType = 'openai' | 'gemini'

export interface AIConfig {
  providerType: AIProviderType
  apiKey: string
  baseUrl: string
  model: string
  sttModel: string
  geminiApiKey: string
  geminiModel: string
  /**
   * Fallback Gemini models tried automatically when the primary model hits
   * a persistent quota (429). Each model has its own free-tier quota counter,
   * so rotating gives effectively multiple quotas for free.
   */
  geminiFallbackModels: string[]
}

const DEFAULTS: AIConfig = {
  providerType:
    (process.env.AI_PROVIDER_TYPE as AIProviderType) ??
    (process.env.GEMINI_API_KEY ? 'gemini' : 'openai'),
  apiKey: process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
  baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  model: process.env.AI_MODEL ?? 'gpt-4o-mini',
  sttModel: process.env.AI_STT_MODEL ?? 'gpt-4o-transcribe',
  geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? process.env.AI_MODEL ?? 'gemini-3.6-flash',
  geminiFallbackModels: process.env.GEMINI_FALLBACK_MODELS
    ? process.env.GEMINI_FALLBACK_MODELS.split(',')
    : ['gemini-3.5-flash', 'gemini-3.7-flash'],
}

// In-memory cache of the persisted file config
let fileConfig: AIConfig | null = null
let fileConfigLoaded = false

function loadFileConfig(): AIConfig {
  if (!fileConfigLoaded) {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Partial<AIConfig>
        fileConfig = {
          providerType: raw.providerType ?? DEFAULTS.providerType,
          apiKey: raw.apiKey ?? '',
          baseUrl: raw.baseUrl ?? DEFAULTS.baseUrl,
          model: raw.model ?? DEFAULTS.model,
          sttModel: raw.sttModel ?? DEFAULTS.sttModel,
          geminiApiKey: raw.geminiApiKey ?? '',
          geminiModel: raw.geminiModel ?? DEFAULTS.geminiModel,
          geminiFallbackModels: raw.geminiFallbackModels ?? DEFAULTS.geminiFallbackModels,
        }
      }
    } catch {
      fileConfig = null
    }
    fileConfigLoaded = true
  }
  return fileConfig ?? DEFAULTS
}

export function getAIConfig(): AIConfig & { configured: boolean } {
  const cfg = loadFileConfig()
  // Merge: file values override env defaults when explicitly set in the file.
  // Cross-fill: when the provider is gemini but only AI_API_KEY was set
  // (e.g. via Vercel env vars), use it as the Gemini key as well.
  if (cfg.providerType === 'gemini' && !cfg.geminiApiKey && cfg.apiKey) {
    cfg.geminiApiKey = cfg.apiKey
  } else if (cfg.providerType === 'openai' && !cfg.apiKey && cfg.geminiApiKey) {
    cfg.apiKey = cfg.geminiApiKey
  }
  const apiKey = cfg.providerType === 'gemini' ? cfg.geminiApiKey : cfg.apiKey
  return {
    providerType: cfg.providerType,
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    sttModel: cfg.sttModel,
    geminiApiKey: cfg.geminiApiKey,
    geminiModel: cfg.geminiModel,
    geminiFallbackModels: cfg.geminiFallbackModels,
    configured: apiKey.length > 0,
  }
}

export function updateAIConfig(input: Partial<AIConfig>): AIConfig {
  const current = loadFileConfig()
  const cfg: AIConfig = {
    providerType: input.providerType ?? current.providerType,
    apiKey: input.apiKey ?? current.apiKey,
    baseUrl: input.baseUrl ?? DEFAULTS.baseUrl,
    model: input.model ?? DEFAULTS.model,
    sttModel: input.sttModel ?? DEFAULTS.sttModel,
    geminiApiKey: input.geminiApiKey ?? current.geminiApiKey,
    geminiModel: input.geminiModel ?? DEFAULTS.geminiModel,
    geminiFallbackModels: input.geminiFallbackModels ?? current.geminiFallbackModels,
  }
  // Persist to the local JSON file
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8')
  fileConfig = cfg
  fileConfigLoaded = true
  return cfg
}
