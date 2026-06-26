import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingInline, LoadingOverlay } from './Loading'

describe('Loading', () => {
  it('expone estado accesible en overlay', () => {
    render(<LoadingOverlay visible title="cargando proyecto" detail="leyendo supabase" />)

    expect(screen.getByRole('status')).toHaveTextContent('cargando proyecto')
    expect(screen.getByText('leyendo supabase')).toBeInTheDocument()
  })

  it('renderiza loading inline con etiqueta', () => {
    render(<LoadingInline label="sincronizando" />)

    expect(screen.getByText('sincronizando')).toBeInTheDocument()
  })
})
