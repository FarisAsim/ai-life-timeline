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

export interface AIConfig {
  apiKey: string
  baseUrl: string
  model: string
  sttModel: string
}

const DEFAULTS: AIConfig = {
  apiKey: process.env.AI_API_KEY ?? '',
  baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  model: process.env.AI_MODEL ?? 'gpt-4o-mini',
  sttModel: process.env.AI_STT_MODEL ?? 'gpt-4o-transcribe',
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
          apiKey: raw.apiKey ?? '',
          baseUrl: raw.baseUrl ?? DEFAULTS.baseUrl,
          model: raw.model ?? DEFAULTS.model,
          sttModel: raw.sttModel ?? DEFAULTS.sttModel,
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
  // Merge: file values override env defaults when explicitly set in the file
  const apiKey = cfg.apiKey || DEFAULTS.apiKey
  return {
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    sttModel: cfg.sttModel,
    configured: apiKey.length > 0,
  }
}

export function updateAIConfig(input: AIConfig): AIConfig {
  const cfg: AIConfig = {
    apiKey: input.apiKey ?? '',
    baseUrl: input.baseUrl ?? DEFAULTS.baseUrl,
    model: input.model ?? DEFAULTS.model,
    sttModel: input.sttModel ?? DEFAULTS.sttModel,
  }
  // Persist to the local JSON file
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8')
  fileConfig = cfg
  fileConfigLoaded = true
  return cfg
}
