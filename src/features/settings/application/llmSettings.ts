import type { LLMConfig, LLMProvider } from '../../../shared/contracts/settingsTypes.js'
import type { AppSettings } from './settingsStore.js'

export interface LocalLLMStartupResult {
  started: boolean
  alreadyRunning: boolean
}

export function buildLLMConfigFromSettings(settings: AppSettings): LLMConfig {
  return {
    provider: (settings.llmProvider || 'ollama') as LLMProvider,
    model: settings.llmModel,
    visionModel: settings.llmVisionModel,
    baseUrl: settings.ollamaBaseUrl,
    performanceMode: settings.performanceMode,
  }
}

export function shouldEnsureLocalLLM(settings: AppSettings): boolean {
  return settings.llmProvider === 'ollama'
}

export function localLLMBaseUrl(settings: AppSettings): string {
  return settings.ollamaBaseUrl || 'http://localhost:11434'
}

export function localLLMStartupLog(result: LocalLLMStartupResult): {
  level: 'info' | 'warn'
  message: string
} {
  if (result.started) return { level: 'info', message: 'Ollama iniciado automaticamente' }
  if (result.alreadyRunning) return { level: 'info', message: 'Ollama ya estaba corriendo' }
  return { level: 'warn', message: 'No se pudo levantar Ollama - el analisis puede fallar' }
}
