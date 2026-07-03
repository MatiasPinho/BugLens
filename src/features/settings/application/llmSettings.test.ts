import { describe, expect, it } from 'vitest'
import {
  buildLLMConfigFromSettings,
  localLLMBaseUrl,
  localLLMStartupLog,
  shouldEnsureLocalLLM,
} from './llmSettings.js'
import type { AppSettings } from './settingsStore.js'

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    googleClientId: '',
    googleClientSecret: '',
    llmProvider: 'ollama',
    llmModel: 'qwen2.5:7b',
    llmVisionModel: 'qwen2.5vl:7b',
    ollamaBaseUrl: 'http://localhost:11434',
    performanceMode: 'gpu',
    supabaseUrl: '',
    supabasePublishableKey: '',
    supabaseDefaultProjectSlug: 'buglens-default',
    supabaseDefaultProjectName: 'buglens',
    supabaseActiveProjectId: '',
    externalAgentCommand: '',
    externalAgentTimeoutMs: 1200000,
    externalAgentWorkingDirectory: '',
    externalAgentRepositories: [],
    onboarded: true,
    ...overrides,
  }
}

describe('llmSettings', () => {
  it('traduce settings a LLMConfig', () => {
    expect(buildLLMConfigFromSettings(makeSettings({ performanceMode: 'cpu' }))).toEqual({
      provider: 'ollama',
      model: 'qwen2.5:7b',
      visionModel: 'qwen2.5vl:7b',
      baseUrl: 'http://localhost:11434',
      performanceMode: 'cpu',
    })
  })

  it('solo asegura Ollama cuando es el provider elegido', () => {
    expect(shouldEnsureLocalLLM(makeSettings())).toBe(true)
    expect(shouldEnsureLocalLLM(makeSettings({ llmProvider: 'openai' }))).toBe(false)
  })

  it('resuelve baseUrl local con fallback', () => {
    expect(localLLMBaseUrl(makeSettings({ ollamaBaseUrl: '' }))).toBe('http://localhost:11434')
  })

  it('describe el resultado de arranque local', () => {
    expect(localLLMStartupLog({ started: true, alreadyRunning: false })).toEqual({
      level: 'info',
      message: 'Ollama iniciado automaticamente',
    })
    expect(localLLMStartupLog({ started: false, alreadyRunning: true }).level).toBe('info')
    expect(localLLMStartupLog({ started: false, alreadyRunning: false }).level).toBe('warn')
  })
})
