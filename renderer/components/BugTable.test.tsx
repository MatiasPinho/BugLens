import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyzedBug, BugStatus } from '../../src/types/index'
import BugTable from './BugTable'

// Factory: arma un AnalyzedBug completo, sobreescribible por test (sin beforeEach).
function makeBug(
  over: { id: string; title: string; status?: BugStatus } & Partial<AnalyzedBug['analysis']>,
): AnalyzedBug {
  const { id, title, status = 'nuevo', ...analysis } = over
  return {
    enriched: {
      raw: { id, rowIndex: 1, title, description: `desc ${id}`, rawRow: {}, googleDocLinks: [] },
      googleDocs: [],
    },
    analysis: {
      category: 'frontend',
      severity: 'medium',
      confidence: 0.8,
      affectedArea: 'formularios',
      summary: `resumen ${id}`,
      rewritten: { observed: 'o', expected: 'e', steps: [], environment: 'dev', problemCount: 1 },
      missingInformation: [],
      rawResponse: '{}',
      ...analysis,
    },
    status,
    processingMs: 10,
  }
}

describe('BugTable — estados', () => {
  it('renderiza una fila por bug con su título', () => {
    render(<BugTable results={[makeBug({ id: 'bug-1', title: 'Login roto' })]} />)
    expect(screen.getByText('Login roto')).toBeInTheDocument()
  })

  it('el selector de estado muestra el estado actual', async () => {
    render(
      <BugTable
        results={[makeBug({ id: 'bug-1', title: 'X', status: 'solucionado' })]}
        onSetStatus={vi.fn()}
      />,
    )
    // 'solucionado' es histórico → no se ve en la pestaña por defecto.
    await userEvent.click(screen.getByRole('tab', { name: /todos/ }))
    const select = screen.getByLabelText('estado del bug') as HTMLSelectElement
    expect(select.value).toBe('solucionado')
  })

  it('cambiar el estado llama onSetStatus con el bug y el nuevo estado', async () => {
    const onSetStatus = vi.fn()
    const bug = makeBug({ id: 'bug-1', title: 'X' })
    render(<BugTable results={[bug]} onSetStatus={onSetStatus} />)

    await userEvent.selectOptions(screen.getByLabelText('estado del bug'), 'solucionado')

    expect(onSetStatus).toHaveBeenCalledTimes(1)
    const [bugArg, statusArg] = onSetStatus.mock.calls[0]
    expect(statusArg).toBe('solucionado')
    expect(bugArg.enriched.raw.id).toBe('bug-1')
  })

  it('filtrar por estado oculta los bugs que no coinciden', async () => {
    const results = [
      makeBug({ id: 'a', title: 'Bug activo', status: 'nuevo' }),
      makeBug({ id: 'b', title: 'Bug resuelto', status: 'solucionado' }),
    ]
    render(<BugTable results={results} onSetStatus={vi.fn()} />)

    // En 'todos' conviven ambos; el filtro de estado refina dentro de la vista.
    await userEvent.click(screen.getByRole('tab', { name: /todos/ }))
    expect(screen.getByText('Bug activo')).toBeInTheDocument()
    expect(screen.getByText('Bug resuelto')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('filtrar por estado'), 'solucionado')

    expect(screen.queryByText('Bug activo')).not.toBeInTheDocument()
    expect(screen.getByText('Bug resuelto')).toBeInTheDocument()
  })
})

describe('BugTable — ciclo de vida (activos / históricos)', () => {
  const mixed = () => [
    makeBug({ id: 'a', title: 'Activo nuevo', status: 'nuevo' }),
    makeBug({ id: 'b', title: 'En progreso', status: 'en_progreso' }),
    makeBug({ id: 'c', title: 'Resuelto', status: 'solucionado' }),
    makeBug({ id: 'd', title: 'No repli', status: 'no_replicado' }),
  ]

  it('por defecto muestra solo los activos (nuevo / en progreso)', () => {
    render(<BugTable results={mixed()} />)
    expect(screen.getByText('Activo nuevo')).toBeInTheDocument()
    expect(screen.getByText('En progreso')).toBeInTheDocument()
    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument()
    expect(screen.queryByText('No repli')).not.toBeInTheDocument()
  })

  it('la pestaña históricos muestra resueltos, cerrados y no replicados', async () => {
    render(<BugTable results={mixed()} />)
    await userEvent.click(screen.getByRole('tab', { name: /históricos/ }))
    expect(screen.queryByText('Activo nuevo')).not.toBeInTheDocument()
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
    expect(screen.getByText('No repli')).toBeInTheDocument()
  })

  it('la pestaña todos muestra activos e históricos juntos', async () => {
    render(<BugTable results={mixed()} />)
    await userEvent.click(screen.getByRole('tab', { name: /todos/ }))
    expect(screen.getByText('Activo nuevo')).toBeInTheDocument()
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
  })

  it('los contadores de cada pestaña reflejan el ciclo de vida', () => {
    render(<BugTable results={mixed()} />)
    expect(screen.getByRole('tab', { name: /activos/ })).toHaveTextContent('2')
    expect(screen.getByRole('tab', { name: /históricos/ })).toHaveTextContent('2')
    expect(screen.getByRole('tab', { name: /todos/ })).toHaveTextContent('4')
  })

  it('si no hay activos, muestra el vacío con opción de ver todos', async () => {
    render(<BugTable results={[makeBug({ id: 'c', title: 'Resuelto', status: 'solucionado' })]} />)
    expect(screen.getByText('no hay bugs activos')).toBeInTheDocument()
    await userEvent.click(screen.getByText('ver todos'))
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
  })
})

describe('BugTable — borrar bug', () => {
  function renderWithDelete(onDelete = vi.fn()) {
    render(
      <BugTable
        results={[makeBug({ id: 'a', title: 'Activo nuevo' })]}
        onSetStatus={vi.fn()}
        onDelete={onDelete}
      />,
    )
    return onDelete
  }

  it('borra el bug solo después de confirmar', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByText('Activo nuevo')) // expandir el detalle
    await userEvent.click(screen.getByRole('button', { name: 'borrar' }))
    expect(onDelete).not.toHaveBeenCalled() // hasta confirmar, no borra
    await userEvent.click(screen.getByRole('button', { name: 'sí, borrar' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete.mock.calls[0][0].enriched.raw.id).toBe('a')
  })

  it('cancelar no borra y vuelve al botón inicial', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'borrar' }))
    await userEvent.click(screen.getByRole('button', { name: 'no' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'borrar' })).toBeInTheDocument()
  })
})
