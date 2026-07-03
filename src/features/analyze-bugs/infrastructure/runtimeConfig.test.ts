import { describe, expect, it } from 'vitest'
import {
  CPU_CONCURRENCY,
  CPU_OLLAMA_TIMEOUT_MS,
  DEFAULT_CONCURRENCY,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  parsePositiveIntEnv,
  resolveConcurrency,
  resolveOllamaTimeoutMs,
} from './runtimeConfig'

describe('parsePositiveIntEnv', () => {
  it('parsea un entero positivo', () => {
    expect(parsePositiveIntEnv('1', 99)).toBe(1)
    expect(parsePositiveIntEnv('180000', 99)).toBe(180000)
  })

  it('cae al fallback con vacío, undefined o solo espacios', () => {
    expect(parsePositiveIntEnv(undefined, 99)).toBe(99)
    expect(parsePositiveIntEnv('', 99)).toBe(99)
    expect(parsePositiveIntEnv('   ', 99)).toBe(99)
  })

  it('cae al fallback con valores inválidos (no entero, cero, negativo, texto)', () => {
    expect(parsePositiveIntEnv('abc', 99)).toBe(99)
    expect(parsePositiveIntEnv('0', 99)).toBe(99)
    expect(parsePositiveIntEnv('-3', 99)).toBe(99)
    expect(parsePositiveIntEnv('1.5', 99)).toBe(99)
  })
})

describe('resolveOllamaTimeoutMs', () => {
  it('usa el default (GPU) sin override ni modo', () => {
    expect(resolveOllamaTimeoutMs({ env: {} })).toBe(DEFAULT_OLLAMA_TIMEOUT_MS)
  })

  it('usa el timeout largo en modo cpu', () => {
    expect(resolveOllamaTimeoutMs({ env: {}, performanceMode: 'cpu' })).toBe(CPU_OLLAMA_TIMEOUT_MS)
  })

  it('OLLAMA_TIMEOUT_MS gana incluso en modo cpu', () => {
    expect(
      resolveOllamaTimeoutMs({ env: { OLLAMA_TIMEOUT_MS: '500000' }, performanceMode: 'cpu' }),
    ).toBe(500000)
  })

  it('ignora un override inválido y cae al perfil del modo', () => {
    expect(
      resolveOllamaTimeoutMs({ env: { OLLAMA_TIMEOUT_MS: 'nope' }, performanceMode: 'cpu' }),
    ).toBe(CPU_OLLAMA_TIMEOUT_MS)
  })
})

describe('resolveConcurrency', () => {
  it('usa el default del proveedor sin override ni modo', () => {
    expect(resolveConcurrency('ollama', { env: {} })).toBe(DEFAULT_CONCURRENCY.ollama)
    expect(resolveConcurrency('anthropic', { env: {} })).toBe(DEFAULT_CONCURRENCY.anthropic)
  })

  it('en modo cpu baja a 1 para cualquier proveedor', () => {
    expect(resolveConcurrency('ollama', { env: {}, performanceMode: 'cpu' })).toBe(CPU_CONCURRENCY)
    expect(resolveConcurrency('anthropic', { env: {}, performanceMode: 'cpu' })).toBe(
      CPU_CONCURRENCY,
    )
  })

  it('LLM_CONCURRENCY gana sobre el modo y el proveedor', () => {
    expect(
      resolveConcurrency('ollama', { env: { LLM_CONCURRENCY: '4' }, performanceMode: 'cpu' }),
    ).toBe(4)
  })

  it('ignora un override inválido y cae al perfil del modo', () => {
    expect(
      resolveConcurrency('ollama', { env: { LLM_CONCURRENCY: '0' }, performanceMode: 'cpu' }),
    ).toBe(CPU_CONCURRENCY)
  })
})
