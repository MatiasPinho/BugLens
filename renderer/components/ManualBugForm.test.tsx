import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ManualBugForm from './ManualBugForm'

describe('ManualBugForm', () => {
  it('el submit arranca deshabilitado y se habilita al cargar título', async () => {
    render(<ManualBugForm onSubmit={vi.fn()} onClose={vi.fn()} />)
    const submit = screen.getByRole('button', { name: 'agregar y analizar' })
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText('título'), 'Login roto')
    expect(submit).toBeEnabled()
  })

  it('al enviar llama onSubmit con los campos y cierra', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<ManualBugForm onSubmit={onSubmit} onClose={onClose} />)

    await userEvent.type(screen.getByLabelText('título'), 'Login roto')
    await userEvent.type(screen.getByLabelText('ambiente'), 'prod')
    await userEvent.click(screen.getByRole('button', { name: 'agregar y analizar' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Login roto', environment: 'prod' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cancelar cierra sin enviar', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<ManualBugForm onSubmit={onSubmit} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'cancelar' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape cierra el modal', async () => {
    const onClose = vi.fn()
    render(<ManualBugForm onSubmit={vi.fn()} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Enter envía si es válido', async () => {
    const onSubmit = vi.fn()
    render(<ManualBugForm onSubmit={onSubmit} onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('título'), 'Login roto')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('enfoca el campo título al abrir', () => {
    render(<ManualBugForm onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText('título')).toHaveFocus()
  })
})
