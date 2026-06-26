import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TeamLogin from './TeamLogin'

describe('TeamLogin', () => {
  it('pide login y llama onLogin al continuar con Google', async () => {
    const onLogin = vi.fn()
    render(
      <TeamLogin
        status={{ configured: true, authenticated: false }}
        loading={false}
        onLogin={onLogin}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'continuar con google' }))

    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('bloquea login si Supabase no está configurado', () => {
    render(
      <TeamLogin
        status={{ configured: false, authenticated: false }}
        loading={false}
        onLogin={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'continuar con google' })).toBeDisabled()
    expect(screen.getByText(/Configurá Supabase/)).toBeInTheDocument()
  })

  it('muestra usuario y proyecto cuando está conectado', () => {
    render(
      <TeamLogin
        status={{
          configured: true,
          authenticated: true,
          user: { id: 'u1', email: 'qa@example.com' },
          project: { id: 'p1', name: 'buglens', slug: 'buglens-default' },
        }}
        loading={false}
        onLogin={vi.fn()}
      />,
    )

    expect(screen.getByText('qa@example.com')).toBeInTheDocument()
    expect(screen.getByText('proyecto: buglens')).toBeInTheDocument()
  })
})
