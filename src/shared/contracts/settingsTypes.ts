export type LLMProvider = 'ollama' | 'anthropic' | 'gemini' | 'openai'

export type PerformanceMode = 'gpu' | 'cpu'

// Layout de la pantalla de Bugs: 'cards' = una tarjeta por bug (más aireado),
// 'split' = lista densa agrupada por pantalla + vista previa al lado.

export interface LLMConfig {
  provider: LLMProvider
  model?: string
  visionModel?: string
  baseUrl?: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
  performanceMode?: PerformanceMode
}

export interface AppConfig {
  llm: LLMConfig
  googleAuth: {
    clientId: string
    clientSecret: string
    tokenPath: string
  }
}

export type Accelerator = 'gpu' | 'cpu' | 'unknown'

export interface HardwareProbe {
  accelerator: Accelerator
  detail: string
  model?: string
}
