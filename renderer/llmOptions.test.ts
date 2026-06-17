import { describe, expect, it } from 'vitest'
import { defaultModelFor, LLM_OPTIONS } from './llmOptions'

describe('defaultModelFor', () => {
  it('devuelve el modelo por defecto de cada proveedor', () => {
    expect(defaultModelFor('ollama')).toBe('qwen2.5:7b')
    expect(defaultModelFor('gemini')).toBe('gemini-2.5-flash')
    expect(defaultModelFor('anthropic')).toBe('claude-haiku-4-5-20251001')
    expect(defaultModelFor('openai')).toBe('gpt-4o-mini')
  })

  it('cae a vacío para un proveedor desconocido', () => {
    expect(defaultModelFor('desconocido')).toBe('')
  })

  it('tiene un default para cada opción listada', () => {
    for (const opt of LLM_OPTIONS) {
      expect(defaultModelFor(opt.id)).not.toBe('')
    }
  })
})
