import type { LLMConfig, LLMProvider, PerformanceMode } from '../types/index.js'

// ─── LLM config ────────────────────────────────────────────────────────────────

/**
 * Returns the configured LLM config from environment variables.
 * Can be overridden by passing explicit config.
 */
export function getLLMConfig(override?: Partial<LLMConfig>): LLMConfig {
  const provider = (override?.provider ?? process.env['LLM_PROVIDER'] ?? 'ollama') as LLMProvider

  return {
    provider,
    model: override?.model ?? process.env['LLM_MODEL'] ?? getDefaultModel(provider),
    visionModel:
      override?.visionModel ??
      process.env['LLM_VISION_MODEL'] ??
      process.env['OLLAMA_VISION_MODEL'] ??
      'qwen2.5vl:7b',
    baseUrl: override?.baseUrl ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
    apiKey: override?.apiKey ?? getApiKey(provider),
    temperature: override?.temperature ?? 0.1,
    maxTokens: override?.maxTokens ?? 4096,
    performanceMode: override?.performanceMode ?? getPerformanceMode(),
  }
}

function getPerformanceMode(): PerformanceMode {
  return process.env['LLM_PERFORMANCE_MODE'] === 'cpu' ? 'cpu' : 'gpu'
}

function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'ollama':
      return process.env['OLLAMA_MODEL'] ?? 'qwen2.5:7b'
    case 'anthropic':
      return 'claude-haiku-4-5-20251001'
    case 'gemini':
      return 'gemini-2.5-flash'
    case 'openai':
      return 'gpt-4o-mini'
  }
}

function getApiKey(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'anthropic':
      return process.env['ANTHROPIC_API_KEY']
    case 'gemini':
      return process.env['GEMINI_API_KEY']
    case 'openai':
      return process.env['OPENAI_API_KEY']
    default:
      return undefined
  }
}
