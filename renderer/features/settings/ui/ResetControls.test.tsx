import { render, screen, waitFor, within } from '@testing-library/react'
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
  it('pide confirmación modal antes de restablecer (no llama de una)', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'vaciar vista local' }))
    expect(resetApp).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'vaciar vista local' })).toBeInTheDocument()
  })

  it('confirmar llama resetApp con el scope correcto', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'restablecer configuración' }))
    const dialog = screen.getByRole('dialog', { name: 'restablecer configuración' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'restablecer' }))

    await waitFor(() => expect(resetApp).toHaveBeenCalledWith('config'))
  })

  it('cancelar cierra la confirmación sin restablecer', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'vaciar vista local' }))
    const dialog = screen.getByRole('dialog', { name: 'vaciar vista local' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'cancelar' }))

    expect(resetApp).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'vaciar vista local' })).not.toBeInTheDocument()
  })

  it('Escape cancela la confirmación', async () => {
    const { resetApp } = stubReset()
    render(<ResetControls addLog={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'vaciar vista local' }))
    expect(screen.getByRole('dialog', { name: 'vaciar vista local' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(resetApp).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'vaciar vista local' })).not.toBeInTheDocument()
  })
})
