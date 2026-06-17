import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Onboarding from './Onboarding'

function stubApi(overrides: Record<string, unknown> = {}) {
  const saveSettings = vi.fn().mockResolvedValue({ ok: true })
  ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    getSettings: vi.fn().mockResolvedValue({
      googleClientId: '',
      googleClientSecret: '',
      llmProvider: 'ollama',
      llmModel: 'qwen2.5:7b',
      ollamaBaseUrl: 'http://localhost:11434',
      performanceMode: 'gpu',
      onboarded: false,
    }),
    getBrowserAuthStatus: vi.fn().mockResolvedValue({ authenticated: false }),
    startBrowserLogin: vi.fn().mockResolvedValue({ ok: true }),
    probeHardware: vi.fn().mockResolvedValue({ accelerator: 'gpu', detail: 'GPU' }),
    saveSettings,
    ...overrides,
  }
  return { saveSettings }
}

afterEach(() => {
  // @ts-expect-error limpiar el mock entre tests
  delete window.electronAPI
})

describe('Onboarding', () => {
  it('avanza los 3 pasos y al finalizar guarda con onboarded:true + llama onDone', async () => {
    const { saveSettings } = stubApi()
    const onDone = vi.fn()
    render(<Onboarding onDone={onDone} />)

    // Paso 1 (rendimiento) → siguiente
    await userEvent.click(screen.getByRole('button', { name: 'siguiente' }))
    // Paso 2 (modelo) → siguiente
    await userEvent.click(screen.getByRole('button', { name: 'siguiente' }))
    // Paso 3 (google) → empezar
    await userEvent.click(screen.getByRole('button', { name: 'empezar' }))

    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1))
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ onboarded: true, performanceMode: 'gpu' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cambiar de proveedor resetea el modelo al default (no arrastra el anterior)', async () => {
    stubApi()
    render(<Onboarding onDone={vi.fn()} />)

    // Ir al paso "modelo".
    await userEvent.click(screen.getByRole('button', { name: 'siguiente' }))

    // Poner un modelo custom de ollama.
    const modelInput = screen.getByLabelText('modelo')
    await userEvent.clear(modelInput)
    await userEvent.type(modelInput, 'qwen2.5:32b')
    expect(modelInput).toHaveValue('qwen2.5:32b')

    // Cambiar a gemini y volver a ollama: el modelo debe quedar en el default de ollama,
    // no en el valor custom anterior (y mucho menos en uno de gemini).
    await userEvent.click(screen.getByRole('radio', { name: /gemini/ }))
    await userEvent.click(screen.getByRole('radio', { name: /ollama/ }))

    expect(screen.getByLabelText('modelo')).toHaveValue('qwen2.5:7b')
  })
})
