import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EngineStatusButton from './EngineStatusButton'

describe('EngineStatusButton', () => {
  it('distingue la comprobación inicial de un motor disponible', () => {
    render(<EngineStatusButton availability={null} onOpenSettings={() => {}} />)

    expect(screen.getByText('Comprobando Ollama')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveClass('badge-category')
  })

  it('muestra el error con texto y tono semántico', () => {
    render(<EngineStatusButton availability={false} onOpenSettings={() => {}} />)

    expect(
      screen.getByRole('button', { name: 'Ollama no disponible. Abrir configuración' }),
    ).toHaveClass('badge-severity-critical')
  })

  it('abre configuración desde cualquier estado', async () => {
    const onOpenSettings = vi.fn()
    render(<EngineStatusButton availability={true} onOpenSettings={onOpenSettings} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ollama local. Abrir configuración' }))

    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})
