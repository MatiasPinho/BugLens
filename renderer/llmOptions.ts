// Opciones de proveedor LLM y su modelo por defecto. Fuente única compartida por
// el wizard de primer arranque (Onboarding) y la configuración (Settings).

export interface LlmOption {
  id: string
  name: string
  description: string
}

export const LLM_OPTIONS: LlmOption[] = [
  { id: 'ollama', name: 'ollama', description: 'Local y gratis. Requiere Ollama instalado.' },
  { id: 'anthropic', name: 'anthropic', description: 'Alta calidad. Requiere ANTHROPIC_API_KEY.' },
  { id: 'gemini', name: 'gemini', description: 'Rápido y económico. Requiere GEMINI_API_KEY.' },
  { id: 'openai', name: 'openai', description: 'Requiere OPENAI_API_KEY.' },
]

// Modelo por defecto de cada proveedor. Al cambiar de proveedor se resetea el modelo
// a este valor — si no, el campo (que es uno solo, `llmModel`) arrastraría el modelo del
// proveedor anterior (ej: quedaba "gemini-2.5-flash" tras pasar a ollama).
export const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  ollama: 'qwen2.5:7b',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
}

/** Modelo por defecto del proveedor (cae a '' si es desconocido). */
export function defaultModelFor(provider: string): string {
  return PROVIDER_DEFAULT_MODEL[provider] ?? ''
}
