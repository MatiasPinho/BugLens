import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmActionModal } from './ActionModal'

describe('ConfirmActionModal', () => {
  it('confirma la acción desde el modal', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmActionModal
        open
        title="Borrar bug"
        description="Se ocultará del proyecto compartido."
        confirmLabel="Borrar bug"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Borrar bug' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar bug' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancela con el botón secundario', async () => {
    const onClose = vi.fn()
    render(
      <ConfirmActionModal
        open
        title="Restablecer configuración"
        confirmLabel="Restablecer"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Restablecer configuración' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra con Escape', async () => {
    const onClose = vi.fn()
    render(
      <ConfirmActionModal
        open
        title="Borrar bug"
        confirmLabel="Borrar bug"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    )

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra desde el fondo', async () => {
    const onClose = vi.fn()
    render(
      <ConfirmActionModal
        open
        title="Borrar bug"
        confirmLabel="Borrar bug"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'cerrar modal' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
