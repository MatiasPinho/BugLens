// Configuración del proveedor LLM soportado por la app. La UI expone solo Ollama:
// los providers cloud nunca se probaron en este producto.

export interface LlmOption {
  id: string
  name: string
  description: string
}

export const LLM_OPTIONS: LlmOption[] = [
  { id: 'ollama', name: 'ollama', description: 'Local y gratis. Requiere Ollama instalado.' },
]

export const DEFAULT_OLLAMA_TEXT_MODEL = 'qwen2.5:7b'
export const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  ollama: DEFAULT_OLLAMA_TEXT_MODEL,
}

export const DEFAULT_OLLAMA_VISION_MODEL = 'qwen2.5vl:7b'

/** Modelo por defecto del proveedor (cae a '' si es desconocido). */
export function defaultModelFor(provider: string): string {
  return PROVIDER_DEFAULT_MODEL[provider] ?? ''
}
