import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeBug } from '../../../components/_storyFixtures'
import BugList from './BugList'
import type { BugFilters } from './bugPresentation'

const bugs = [
  makeBug({ id: 'bug-1', title: 'Login roto', severity: 'critical', screen: '/auth/login' }),
  makeBug({ id: 'bug-2', title: 'Export vacío', status: 'solucionado' }),
]

const filtrosVacios: BugFilters = {
  lifecycle: 'activos',
  category: 'all',
  severity: 'all',
  status: 'all',
  search: '',
}

function renderList(over: Partial<React.ComponentProps<typeof BugList>> = {}) {
  const props = {
    bugs,
    totalCount: bugs.length,
    counts: { activos: 1, historicos: 1, todos: 2 },
    kpis: { active: 1, critical: 1, missingInfo: 0, solved: 1 },
    filters: filtrosVacios,
    categories: ['frontend' as const],
    severities: ['critical' as const],
    onSelect: vi.fn(),
    onLifecycleChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSeverityChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onStatusChange: vi.fn(),
    onClearFilters: vi.fn(),
    ...over,
  }
  render(<BugList {...props} />)
  return props
}

describe('BugList', () => {
  it('muestra un ítem por bug con su título', () => {
    renderList()
    const lista = screen.getByRole('list', { name: 'lista de bugs' })

    expect(within(lista).getByText('Login roto')).toBeInTheDocument()
    expect(within(lista).getByText('Export vacío')).toBeInTheDocument()
  })

  it('comunica severidad y estado con texto, no solo con color', () => {
    renderList()
    const item = screen.getByRole('button', { name: /Login roto/ })

    expect(within(item).getByText('crítica')).toBeInTheDocument()
    expect(within(item).getByText('nuevo')).toBeInTheDocument()
  })

  it('elegir un bug avisa con su id', async () => {
    const props = renderList()

    await userEvent.click(screen.getByRole('button', { name: /Export vacío/ }))

    expect(props.onSelect).toHaveBeenCalledWith('bug-2')
  })

  it('marca el seleccionado para lectores de pantalla', () => {
    renderList({ selectedId: 'bug-2' })

    expect(screen.getByRole('button', { name: /Export vacío/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /Login roto/ })).not.toHaveAttribute('aria-current')
  })

  it('dice que no hay pantalla informada en vez de dejarlo en blanco', () => {
    const sinPantalla = makeBug({ id: 'bug-3', title: 'Sin pantalla' })
    sinPantalla.enriched.raw.rawRow = {}
    sinPantalla.analysis.affectedArea = ''
    renderList({ bugs: [sinPantalla] })

    expect(screen.getByText('Sin pantalla informada')).toBeInTheDocument()
  })

  it('buscar avisa el texto tipeado', async () => {
    const props = renderList()

    await userEvent.type(screen.getByLabelText('buscar bugs'), 'log')

    expect(props.onSearchChange).toHaveBeenCalled()
  })

  it('cambiar de pestaña avisa al padre', async () => {
    const props = renderList()

    await userEvent.click(screen.getByRole('tab', { name: /Históricos/ }))

    expect(props.onLifecycleChange).toHaveBeenCalledWith('historicos')
  })

  it('el botón de limpiar solo aparece con filtros activos', async () => {
    const props = renderList({ filters: { ...filtrosVacios, search: 'login' } })

    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(props.onClearFilters).toHaveBeenCalled()
  })

  it('sin filtros activos no ofrece limpiar', () => {
    renderList()

    expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument()
  })

  it('anuncia cuántos bugs coinciden al filtrar', () => {
    renderList({ bugs: [bugs[0]], totalCount: 2 })

    expect(screen.getByText('1 de 2 bugs coinciden')).toBeInTheDocument()
  })

  it('muestra el resumen del proyecto', () => {
    renderList()

    // "Activos" también es el nombre de una pestaña: se acota al KPI.
    expect(screen.getByText('Activos', { selector: '.kpi-label' })).toBeInTheDocument()
    expect(screen.getByText('Críticos', { selector: '.kpi-label' })).toBeInTheDocument()
  })
})
