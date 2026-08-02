import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { bugRecordKey } from '../../../../src/features/bug-workflow/domain/bugStatusKey'
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
  quickFilter: 'active',
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
    onKpiSelect: vi.fn(),
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

    expect(props.onSelect).toHaveBeenCalledWith(bugRecordKey(bugs[1].enriched.raw))
  })

  it('marca el seleccionado para lectores de pantalla', () => {
    renderList({ selectedKey: bugRecordKey(bugs[1].enriched.raw) })

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

  it('muestra responsables y fecha límite de los bugs activos sin sumar otra fila', () => {
    const conSeguimiento = {
      ...makeBug({ id: 'bug-3', title: 'Checkout bloqueado' }),
      assignees: [
        { id: 'perfil-1', displayName: 'Matias Pinho' },
        { id: 'perfil-2', displayName: 'Lucía Gómez' },
      ],
      dueDate: '2099-12-31',
    }
    renderList({ bugs: [conSeguimiento], totalCount: 1 })

    expect(screen.getByText('Responsables: Matias Pinho, Lucía Gómez')).toHaveClass('sr-only')
    expect(screen.getByText('Vence 31 dic')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('señala con texto una fecha vencida y los bugs activos sin responsable', () => {
    const vencido = {
      ...makeBug({ id: 'bug-3', title: 'Checkout bloqueado' }),
      dueDate: '2000-01-01',
    }
    renderList({ bugs: [vencido], totalCount: 1 })

    expect(screen.getByText('Venció 01 ene')).toHaveClass('bug-list-due-date-overdue')
    expect(screen.getByText('Sin asignar')).toBeInTheDocument()
  })

  it('no carga seguimiento operativo en bugs históricos', () => {
    const historico = {
      ...makeBug({ id: 'bug-3', title: 'Checkout corregido', status: 'solucionado' }),
      dueDate: '2000-01-01',
    }
    renderList({ bugs: [historico], totalCount: 1 })

    expect(screen.queryByText(/Venció|Vence/)).not.toBeInTheDocument()
    expect(screen.queryByText('Sin asignar')).not.toBeInTheDocument()
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

  it('convierte los KPI en atajos accesibles y comunica el seleccionado', async () => {
    const props = renderList()
    const activeShortcut = screen.getByRole('button', { name: 'Filtrar por activos, 1 bug' })

    expect(activeShortcut).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar por críticos, 1 bug' }))

    expect(props.onKpiSelect).toHaveBeenCalledWith('critical')
  })

  it('desactiva los atajos que no tienen resultados', () => {
    renderList()

    expect(screen.getByRole('button', { name: 'Filtrar por falta info, 0 bugs' })).toBeDisabled()
  })
})
