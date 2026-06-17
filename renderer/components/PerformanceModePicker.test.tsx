import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PerformanceModePicker, { type PerformanceMode } from './PerformanceModePicker'

// Wrapper controlado: refleja el onChange como lo haría el padre real.
function Harness({ initial = 'gpu' as PerformanceMode }) {
  const [mode, setMode] = useState<PerformanceMode>(initial)
  return (
    <>
      <span data-testid="mode">{mode}</span>
      <PerformanceModePicker value={mode} onChange={setMode} />
    </>
  )
}

function stubProbe(result: { accelerator: 'gpu' | 'cpu' | 'unknown'; detail: string }) {
  ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    probeHardware: vi.fn().mockResolvedValue(result),
  }
}

afterEach(() => {
  // @ts-expect-error limpiar el mock entre tests
  delete window.electronAPI
})

describe('PerformanceModePicker', () => {
  it('al detectar CPU marca recomendado, avisa y auto-selecciona CPU', async () => {
    stubProbe({ accelerator: 'cpu', detail: 'El modelo corre en CPU — será lento' })
    render(<Harness initial="gpu" />)

    await userEvent.click(screen.getByRole('button', { name: 'analizar mi equipo' }))

    // Auto-selección al modo detectado.
    expect(screen.getByTestId('mode')).toHaveTextContent('cpu')
    // Aviso visible + badge "recomendado".
    expect(screen.getByText(/será lento/)).toBeInTheDocument()
    expect(screen.getByText('recomendado')).toBeInTheDocument()
  })

  it('al detectar GPU no fuerza CPU', async () => {
    stubProbe({ accelerator: 'gpu', detail: 'El modelo corre en la GPU' })
    render(<Harness initial="gpu" />)

    await userEvent.click(screen.getByRole('button', { name: 'analizar mi equipo' }))

    expect(screen.getByTestId('mode')).toHaveTextContent('gpu')
    expect(screen.getByText('recomendado')).toBeInTheDocument()
  })
})
