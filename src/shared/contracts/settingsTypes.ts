export type LLMProvider = 'ollama' | 'anthropic' | 'gemini' | 'openai'

export type PerformanceMode = 'gpu' | 'cpu'

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
