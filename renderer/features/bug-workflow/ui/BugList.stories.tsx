import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { bugRecordKey } from '../../../../src/features/bug-workflow/domain/bugStatusKey'
import { makeBug } from '../../../components/_storyFixtures'
import BugList from './BugList'
import { type BugFilters, type BugKpiFilter, filterBugs } from './bugPresentation'

const matias = { id: 'perfil-1', displayName: 'Matias Pinho' }
const lucia = { id: 'perfil-2', displayName: 'Lucía Gómez' }

const bugs = [
  {
    ...makeBug({
      id: '1',
      title: 'Login queda cargando con credenciales válidas',
      severity: 'critical',
      screen: '/auth/login',
    }),
    assignees: [matias, lucia],
    dueDate: '2026-07-31',
  },
  {
    ...makeBug({
      id: '2',
      title: 'El contador de progreso retrocede si el reloj del sistema viaja al año 2042',
      status: 'en_progreso',
      screen: 'analizador de bugs',
    }),
    dueDate: '2026-08-08',
  },
  {
    ...makeBug({ id: '3', title: 'Se pierden acentos en CSV', severity: 'high' }),
    assignees: [lucia],
  },
  makeBug({ id: '4', title: 'Export vacío al filtrar', status: 'solucionado' }),
  makeBug({ id: '5', title: 'Modal no cierra con Esc', status: 'cerrado', severity: 'low' }),
]

const meta = {
  title: 'buglens/bugs/BugList',
  component: BugList,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BugList>
export default meta

function Lista({ filtro = {} }: { filtro?: Partial<BugFilters> }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(bugRecordKey(bugs[0].enriched.raw))
  const [filters, setFilters] = useState<BugFilters>({
    lifecycle: 'todos',
    category: 'all',
    severity: 'all',
    status: 'all',
    search: '',
    quickFilter: null,
    ...filtro,
  })
  const selectKpi = (quickFilter: BugKpiFilter) => {
    setFilters({
      lifecycle:
        quickFilter === 'active' ? 'activos' : quickFilter === 'solved' ? 'historicos' : 'todos',
      category: 'all',
      severity: quickFilter === 'critical' ? 'critical' : 'all',
      status: quickFilter === 'solved' ? 'solucionado' : 'all',
      search: '',
      quickFilter,
    })
  }
  const visibleBugs = filterBugs(bugs, filters)

  return (
    <div className="app-shell" style={{ height: '100vh' }}>
      <BugList
        bugs={visibleBugs}
        totalCount={bugs.length}
        counts={{ activos: 3, historicos: 2, todos: 5 }}
        kpis={{ active: 3, critical: 1, missingInfo: 2, solved: 1 }}
        filters={filters}
        categories={['frontend', 'backend']}
        severities={['critical', 'high', 'medium', 'low']}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        onLifecycleChange={(lifecycle) =>
          setFilters({ ...filters, lifecycle, status: 'all', quickFilter: null })
        }
        onSearchChange={(search) => setFilters({ ...filters, search, quickFilter: null })}
        onSeverityChange={(severity) => setFilters({ ...filters, severity, quickFilter: null })}
        onCategoryChange={(category) => setFilters({ ...filters, category, quickFilter: null })}
        onStatusChange={(status) => setFilters({ ...filters, status, quickFilter: null })}
        onKpiSelect={selectKpi}
        onClearFilters={() =>
          setFilters({
            lifecycle: filters.lifecycle,
            category: 'all',
            severity: 'all',
            status: 'all',
            search: '',
            quickFilter: filters.lifecycle === 'activos' ? 'active' : null,
          })
        }
      />
    </div>
  )
}

export const Default: StoryObj = { render: () => <Lista /> }

/** Con filtros activos aparece "Limpiar". */
export const ConFiltros: StoryObj = {
  render: () => <Lista filtro={{ search: 'login', severity: 'critical' }} />,
}

/** Sin resultados: la lista queda vacía pero la cabecera sigue operativa. */
export const SinResultados: StoryObj = {
  render: () => (
    <div className="app-shell" style={{ height: '100vh' }}>
      <BugList
        bugs={[]}
        totalCount={5}
        counts={{ activos: 3, historicos: 2, todos: 5 }}
        kpis={{ active: 3, critical: 1, missingInfo: 2, solved: 1 }}
        filters={{
          lifecycle: 'activos',
          category: 'all',
          severity: 'all',
          status: 'all',
          search: 'no existe',
          quickFilter: null,
        }}
        categories={['frontend']}
        severities={['critical']}
        onSelect={() => {}}
        onLifecycleChange={() => {}}
        onSearchChange={() => {}}
        onSeverityChange={() => {}}
        onCategoryChange={() => {}}
        onStatusChange={() => {}}
        onKpiSelect={() => {}}
        onClearFilters={() => {}}
      />
    </div>
  ),
}
