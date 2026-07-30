import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyzedBug, BugStatus } from '../../../../src/shared/contracts'
import BugsScreen from './BugsScreen'

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

// La vista de tarjetas muestra un título por bug (la dividida lo repite en la
// preview), así que los asserts de contenido usan 'cards' salvo que el test sea
// específico del layout dividido.
// El título de un bug aparece a propósito dos veces: en la lista y como
// encabezado de la columna central. Las aserciones sobre "qué bugs se ven"
// tienen que mirar la lista.
function inList() {
  return within(screen.getByRole('list', { name: 'lista de bugs' }))
}

function renderScreen(
  results: AnalyzedBug[],
  props: Partial<React.ComponentProps<typeof BugsScreen>> = {},
) {
  return render(
    <BugsScreen
      results={results}
      {...props}
    />,
  )
}

describe('BugsScreen — estados', () => {
  it('renderiza una tarjeta por bug con su título', () => {
    renderScreen([makeBug({ id: 'bug-1', title: 'Login roto' })])
    expect(inList().getByText('Login roto')).toBeInTheDocument()
  })

  it('el selector de estado muestra el estado actual', async () => {
    renderScreen([makeBug({ id: 'bug-1', title: 'X', status: 'solucionado' })], {
      onSetStatus: vi.fn(),
    })
    // 'solucionado' es histórico → no se ve en la pestaña por defecto.
    await userEvent.click(screen.getByRole('tab', { name: /Todos/ }))
    const select = within(screen.getByRole('complementary', { name: 'propiedades del bug' })).getByLabelText('estado del bug') as HTMLSelectElement
    expect(select.value).toBe('solucionado')
  })

  it('cambiar el estado llama onSetStatus con el bug y el nuevo estado', async () => {
    const onSetStatus = vi.fn()
    renderScreen([makeBug({ id: 'bug-1', title: 'X' })], { onSetStatus })

    await userEvent.selectOptions(within(screen.getByRole('complementary', { name: 'propiedades del bug' })).getByLabelText('estado del bug'), 'solucionado')

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
    renderScreen(results, { onSetStatus: vi.fn() })

    // En 'Todos' conviven ambos; el filtro de estado refina dentro de la vista.
    await userEvent.click(screen.getByRole('tab', { name: /Todos/ }))
    expect(inList().getByText('Bug activo')).toBeInTheDocument()
    expect(inList().getByText('Bug resuelto')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('filtrar por estado'), 'solucionado')

    expect(inList().queryByText('Bug activo')).not.toBeInTheDocument()
    expect(inList().getByText('Bug resuelto')).toBeInTheDocument()
  })

  it('buscar filtra por texto y se puede limpiar', async () => {
    renderScreen([
      makeBug({ id: 'a', title: 'Login roto' }),
      makeBug({ id: 'b', title: 'Export falla' }),
    ])

    await userEvent.type(screen.getByLabelText('buscar bugs'), 'login')
    expect(inList().getByText('Login roto')).toBeInTheDocument()
    expect(screen.queryByText('Export falla')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.getByText('Export falla')).toBeInTheDocument()
  })
})

describe('BugsScreen — ciclo de vida (activos / históricos)', () => {
  const mixed = () => [
    makeBug({ id: 'a', title: 'Activo nuevo', status: 'nuevo' }),
    makeBug({ id: 'b', title: 'En progreso', status: 'en_progreso' }),
    makeBug({ id: 'c', title: 'Resuelto', status: 'solucionado' }),
    makeBug({ id: 'd', title: 'No repli', status: 'no_replicado' }),
  ]

  it('por defecto muestra solo los activos (nuevo / en progreso)', () => {
    renderScreen(mixed())
    expect(inList().getByText('Activo nuevo')).toBeInTheDocument()
    expect(inList().getByText('En progreso')).toBeInTheDocument()
    expect(inList().queryByText('Resuelto')).not.toBeInTheDocument()
    expect(screen.queryByText('No repli')).not.toBeInTheDocument()
  })

  it('la pestaña históricos muestra resueltos, cerrados y no replicados', async () => {
    renderScreen(mixed())
    await userEvent.click(screen.getByRole('tab', { name: /Históricos/ }))
    expect(inList().queryByText('Activo nuevo')).not.toBeInTheDocument()
    expect(inList().getByText('Resuelto')).toBeInTheDocument()
    expect(screen.getByText('No repli')).toBeInTheDocument()
  })

  it('la pestaña todos muestra activos e históricos juntos', async () => {
    renderScreen(mixed())
    await userEvent.click(screen.getByRole('tab', { name: /Todos/ }))
    expect(inList().getByText('Activo nuevo')).toBeInTheDocument()
    expect(inList().getByText('Resuelto')).toBeInTheDocument()
  })

  it('los contadores de cada pestaña reflejan el ciclo de vida', () => {
    renderScreen(mixed())
    expect(screen.getByRole('tab', { name: /Activos/ })).toHaveTextContent('2')
    expect(screen.getByRole('tab', { name: /Históricos/ })).toHaveTextContent('2')
    expect(screen.getByRole('tab', { name: /Todos/ })).toHaveTextContent('4')
  })

  it('si no hay activos, muestra el vacío con opción de ver todos', async () => {
    renderScreen([makeBug({ id: 'c', title: 'Resuelto', status: 'solucionado' })])
    expect(screen.getByText('No hay bugs activos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos' }))
    expect(inList().getByText('Resuelto')).toBeInTheDocument()
  })

  it('roving tabindex: solo la pestaña activa es tabbable', () => {
    renderScreen(mixed())
    expect(screen.getByRole('tab', { name: /Activos/ })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /Históricos/ })).toHaveAttribute('tabindex', '-1')
  })

  it('las flechas mueven la selección y el foco entre pestañas', async () => {
    renderScreen(mixed())
    const activos = screen.getByRole('tab', { name: /Activos/ })
    activos.focus()
    await userEvent.keyboard('{ArrowRight}')

    const historicos = screen.getByRole('tab', { name: /Históricos/ })
    expect(historicos).toHaveAttribute('aria-selected', 'true')
    expect(historicos).toHaveFocus()
    expect(inList().getByText('Resuelto')).toBeInTheDocument()
  })

  it('el nombre accesible de cada pestaña incluye el conteo', () => {
    renderScreen(mixed())
    expect(screen.getByRole('tab', { name: 'Activos, 2 bugs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Históricos, 2 bugs' })).toBeInTheDocument()
  })
})

describe('BugsScreen — tres columnas', () => {
  it('muestra el reporte del bug elegido en la columna central', async () => {
    renderScreen([
      makeBug({ id: 'bug-1', title: 'Login roto' }),
      makeBug({ id: 'bug-2', title: 'Export vacío' }),
    ])

    // Sin elegir nada se abre el primero: la columna central nunca queda vacía
    // habiendo bugs.
    expect(screen.getByRole('heading', { name: 'Login roto' })).toBeInTheDocument()
  })

  it('elegir otro bug de la lista avisa al padre', async () => {
    const onFocus = vi.fn()
    renderScreen(
      [makeBug({ id: 'bug-1', title: 'Login roto' }), makeBug({ id: 'bug-2', title: 'Export vacío' })],
      { onFocus },
    )

    await userEvent.click(screen.getByRole('button', { name: /Export vacío/ }))

    expect(onFocus).toHaveBeenCalledWith('bug-2')
  })

  it('el bug enfocado es el que se muestra', () => {
    renderScreen(
      [makeBug({ id: 'bug-1', title: 'Login roto' }), makeBug({ id: 'bug-2', title: 'Export vacío' })],
      { focusedId: 'bug-2' },
    )

    expect(screen.getByRole('heading', { name: 'Export vacío' })).toBeInTheDocument()
  })

  it('si el filtro deja afuera al bug enfocado, muestra el primero visible', async () => {
    renderScreen(
      [
        makeBug({ id: 'bug-1', title: 'Login roto' }),
        makeBug({ id: 'bug-2', title: 'Export vacío' }),
      ],
      { focusedId: 'bug-2' },
    )

    await userEvent.type(screen.getByLabelText('buscar bugs'), 'Login')

    // No puede quedar mostrando un reporte que la lista ya no ofrece.
    expect(screen.getByRole('heading', { name: 'Login roto' })).toBeInTheDocument()
  })

  it('muestra los KPI del proyecto', () => {
    renderScreen([makeBug({ id: 'bug-1', title: 'Login roto' })])

    expect(screen.getByText('Activos', { selector: '.kpi-label' })).toBeInTheDocument()
    expect(screen.getByText('Críticos', { selector: '.kpi-label' })).toBeInTheDocument()
  })

  it('muestra el rail de propiedades del bug elegido', () => {
    renderScreen([makeBug({ id: 'bug-1', title: 'Login roto' })])

    expect(screen.getByRole('complementary', { name: 'propiedades del bug' })).toBeInTheDocument()
  })
})
