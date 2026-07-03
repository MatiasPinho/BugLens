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
      llmVisionModel: 'qwen2.5vl:7b',
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

  it('muestra dos modos de análisis y permite elegir si usa capturas', async () => {
    const { saveSettings } = stubApi()
    render(<Onboarding onDone={vi.fn()} />)

    // Ir al paso "modelo".
    await userEvent.click(screen.getByRole('button', { name: 'siguiente' }))

    expect(screen.getByRole('radio', { name: /solo texto/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /texto \+ capturas/i })).toBeInTheDocument()
    expect(screen.getByText('qwen2.5:7b')).toBeInTheDocument()
    expect(screen.getByText(/qwen2.5vl:7b/)).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /gemini/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('modelo texto')).not.toBeInTheDocument()

    const textOnly = screen.getByRole('radio', { name: /solo texto/i })
    const textWithImages = screen.getByRole('radio', { name: /texto \+ capturas/i })
    expect(textWithImages).toBeChecked()
    await userEvent.click(textOnly)
    expect(textOnly).toBeChecked()
    expect(textWithImages).not.toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: 'siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'empezar' }))

    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1))
    expect(saveSettings.mock.calls[0][0]).toMatchObject({
      llmProvider: 'ollama',
      llmModel: 'qwen2.5:7b',
      llmVisionModel: '',
    })
  })
})
