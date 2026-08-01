import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AppTopbar from './AppTopbar'

describe('AppTopbar', () => {
  it('marca la última miga como la ubicación actual', () => {
    render(<AppTopbar breadcrumb={['Bugs', 'El login queda cargando']} />)

    expect(screen.getByText('El login queda cargando')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Bugs')).not.toHaveAttribute('aria-current')
  })

  it('guarda la identidad detrás del avatar, no en la barra', async () => {
    render(
      <AppTopbar
        breadcrumb={['Bugs']}
        user={{ id: 'perfil-1', email: 'matias@estudio.com', provider: 'Google Auth' }}
      />,
    )

    // El topbar solo muestra el avatar: el mail y el proveedor ocupaban demasiado.
    expect(screen.queryByText('matias@estudio.com')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'cuenta y equipo' }))

    expect(screen.getByText('matias@estudio.com')).toBeInTheDocument()
    expect(screen.getByText('Google Auth')).toBeInTheDocument()
  })

  it('lista el equipo dentro del menú de la cuenta', async () => {
    render(
      <AppTopbar
        breadcrumb={['Bugs']}
        user={{ id: 'perfil-1', email: 'matias@estudio.com' }}
        members={[
          { id: 'perfil-1', displayName: 'Matias Pinho' },
          { id: 'perfil-2', email: 'lucia@estudio.com' },
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'cuenta y equipo' }))

    expect(screen.getByText('Matias Pinho')).toBeInTheDocument()
    expect(screen.getByText('lucia@estudio.com')).toBeInTheDocument()
  })

  it('cierra sesión desde el menú de la cuenta', async () => {
    const onSignOut = vi.fn()
    render(<AppTopbar breadcrumb={['Bugs']} user={{ id: 'perfil-1' }} onSignOut={onSignOut} />)

    await userEvent.click(screen.getByRole('button', { name: 'cuenta y equipo' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }))

    expect(onSignOut).toHaveBeenCalled()
  })

  it('renderiza los slots de proyecto, estado y acciones', () => {
    render(
      <AppTopbar
        breadcrumb={['Bugs']}
        projectSlot={<span>selector de proyecto</span>}
        statusSlot={<span>Ollama local</span>}
        actions={<button type="button">ayuda</button>}
        asideActions={<button type="button">analizar</button>}
      />,
    )

    expect(screen.getByText('selector de proyecto')).toBeInTheDocument()
    expect(screen.getByText('Ollama local')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ayuda' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'analizar' })).toBeInTheDocument()
  })

  it('no renderiza bloque de usuario ni cierre de sesión si no hay sesión', () => {
    render(<AppTopbar breadcrumb={['Bugs']} />)

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })
})
