import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResetControls from './ResetControls'

function stubReset() {
  const resetApp = vi.fn().mockResolvedValue({ ok: true })
  ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = { resetApp }
  return { resetApp }
}

afterEach(() => {
  // @ts-expect-error limpiar el mock entre tests
  delete window.electronAPI
})

describe('ResetControls', () => {
  it('pide confirmación inline antes de restablecer (no llama de una)', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'borrar datos de bugs' }))
    expect(resetApp).not.toHaveBeenCalled()
    expect(screen.getByText(/reinicia la app/)).toBeInTheDocument()
  })

  it('confirmar llama resetApp con el scope correcto', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'restablecer configuración' }))
    await userEvent.click(screen.getByRole('button', { name: /sí, restablecer/ }))

    await waitFor(() => expect(resetApp).toHaveBeenCalledWith('config'))
  })

  it('cancelar cierra la confirmación sin restablecer', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'borrar datos de bugs' }))
    await userEvent.click(screen.getByRole('button', { name: 'cancelar' }))

    expect(resetApp).not.toHaveBeenCalled()
    expect(screen.queryByText(/reinicia la app/)).not.toBeInTheDocument()
  })

  it('Escape cancela la confirmación', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'borrar datos de bugs' }))
    expect(screen.getByText(/reinicia la app/)).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(resetApp).not.toHaveBeenCalled()
    expect(screen.queryByText(/reinicia la app/)).not.toBeInTheDocument()
  })
})
