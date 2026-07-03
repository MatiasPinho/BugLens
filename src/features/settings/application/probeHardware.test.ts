import { describe, expect, it, vi } from 'vitest'
import { probeHardware } from './probeHardware.js'

function jsonResponse(value: unknown): Response {
  return {
    json: vi.fn().mockResolvedValue(value),
  } as unknown as Response
}

describe('probeHardware', () => {
  it('devuelve unknown cuando Ollama no puede iniciar', async () => {
    await expect(
      probeHardware('http://localhost:11434', 'qwen2.5:7b', {
        ensureRunning: vi.fn().mockResolvedValue({ started: false, alreadyRunning: false }),
      }),
    ).resolves.toMatchObject({ accelerator: 'unknown' })
  })

  it('devuelve unknown cuando el modelo no esta descargado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ models: [{ name: 'otro:7b' }] }))

    await expect(
      probeHardware('http://localhost:11434', 'qwen2.5:7b', {
        ensureRunning: vi.fn().mockResolvedValue({ started: false, alreadyRunning: true }),
        fetch: fetchMock,
      }),
    ).resolves.toMatchObject({
      accelerator: 'unknown',
      detail: 'El modelo "qwen2.5:7b" no esta descargado todavia',
    })
  })

  it('detecta GPU cuando Ollama reporta uso de VRAM', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ models: [{ name: 'qwen2.5:7b' }] }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ models: [{ name: 'qwen2.5:7b', size_vram: 1 }] }))

    await expect(
      probeHardware('http://localhost:11434', 'qwen2.5:7b', {
        ensureRunning: vi.fn().mockResolvedValue({ started: false, alreadyRunning: true }),
        fetch: fetchMock,
      }),
    ).resolves.toMatchObject({ accelerator: 'gpu', model: 'qwen2.5:7b' })
  })

  it('detecta CPU cuando el modelo cargado no usa VRAM', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ models: [{ name: 'qwen2.5:7b' }] }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ models: [{ name: 'qwen2.5:7b', size_vram: 0 }] }))

    await expect(
      probeHardware('http://localhost:11434', 'qwen2.5:7b', {
        ensureRunning: vi.fn().mockResolvedValue({ started: false, alreadyRunning: true }),
        fetch: fetchMock,
      }),
    ).resolves.toMatchObject({ accelerator: 'cpu', model: 'qwen2.5:7b' })
  })
})
