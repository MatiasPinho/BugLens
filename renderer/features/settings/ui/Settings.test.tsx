import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings'

const originalElectronAPI = window.electronAPI

function stubApi() {
  const checkOllama = vi
    .fn()
    .mockResolvedValueOnce({ available: false, models: [] })
    .mockResolvedValueOnce({ available: true, models: ['qwen2.5:7b'] })

  ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    getSettings: vi.fn().mockResolvedValue({
      googleClientId: '',
      googleClientSecret: '',
      llmProvider: 'ollama',
      llmModel: 'qwen2.5:7b',
      llmVisionModel: 'qwen2.5vl:7b',
      ollamaBaseUrl: 'http://localhost:11434',
      performanceMode: 'cpu',
      supabaseUrl: '',
      supabasePublishableKey: '',
      supabaseDefaultProjectSlug: 'buglens-default',
      supabaseDefaultProjectName: 'buglens',
      supabaseActiveProjectId: '',
      externalAgentCommand: '',
      externalAgentTimeoutMs: 20 * 60 * 1000,
      externalAgentWorkingDirectory: '',
      externalAgentRepositories: [],
      onboarded: true,
    }),
    getAuthStatus: vi.fn().mockResolvedValue({ authenticated: false }),
    getBrowserAuthStatus: vi.fn().mockResolvedValue({ authenticated: false }),
    getSupabaseStatus: vi.fn().mockResolvedValue({ configured: false, authenticated: false }),
    checkOllama,
    startOllama: vi.fn().mockResolvedValue({ ok: true, message: 'Ollama iniciado' }),
    checkOpenCode: vi.fn().mockResolvedValue({
      installed: false,
      hasBigPickle: false,
      model: 'opencode/big-pickle',
    }),
    cacheStats: vi.fn().mockResolvedValue({ count: 0, sizeKB: 0 }),
  }

  return { checkOllama }
}

afterEach(() => {
  window.electronAPI = originalElectronAPI
})

describe('Settings', () => {
  it('actualiza el estado global de Ollama después de iniciarlo', async () => {
    const { checkOllama } = stubApi()
    const onOllamaAvailabilityChange = vi.fn()

    render(<Settings addLog={vi.fn()} onOllamaAvailabilityChange={onOllamaAvailabilityChange} />)

    const startButton = await screen.findByRole('button', { name: 'Iniciar Ollama' })
    expect(onOllamaAvailabilityChange).toHaveBeenLastCalledWith(false)

    await userEvent.click(startButton)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Iniciar Ollama' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(onOllamaAvailabilityChange).toHaveBeenLastCalledWith(true)
    expect(checkOllama).toHaveBeenCalledTimes(2)
  })
})
