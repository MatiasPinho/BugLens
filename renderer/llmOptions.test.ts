import { describe, expect, it } from 'vitest'
import { defaultModelFor, LLM_OPTIONS } from './llmOptions'

describe('defaultModelFor', () => {
  it('devuelve el modelo por defecto de cada proveedor', () => {
    expect(defaultModelFor('ollama')).toBe('qwen2.5:7b')
  })

  it('cae a vacío para un proveedor desconocido', () => {
    expect(defaultModelFor('desconocido')).toBe('')
  })

  it('tiene un default para cada opción listada', () => {
    for (const opt of LLM_OPTIONS) {
      expect(defaultModelFor(opt.id)).not.toBe('')
    }
  })

  it('solo lista ollama como proveedor soportado', () => {
    expect(LLM_OPTIONS.map((opt) => opt.id)).toEqual(['ollama'])
  })
})
