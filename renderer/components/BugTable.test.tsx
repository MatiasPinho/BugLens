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

  it('el selector de estado muestra el estado actual', () => {
    render(
      <BugTable
        results={[makeBug({ id: 'bug-1', title: 'X', status: 'solucionado' })]}
        onSetStatus={vi.fn()}
      />,
    )
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

    expect(screen.getByText('Bug activo')).toBeInTheDocument()
    expect(screen.getByText('Bug resuelto')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('filtrar por estado'), 'solucionado')

    expect(screen.queryByText('Bug activo')).not.toBeInTheDocument()
    expect(screen.getByText('Bug resuelto')).toBeInTheDocument()
  })
})
