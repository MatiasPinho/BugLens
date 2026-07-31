import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { makeBug } from '../../../components/_storyFixtures'
import BugList from './BugList'
import type { BugFilters, LifecycleTab } from './bugPresentation'

const bugs = [
  makeBug({
    id: '1',
    title: 'Login queda cargando con credenciales válidas',
    severity: 'critical',
    screen: '/auth/login',
  }),
  makeBug({
    id: '2',
    title: 'El contador de progreso retrocede si el reloj del sistema viaja al año 2042',
    status: 'en_progreso',
    screen: 'analizador de bugs',
  }),
  makeBug({ id: '3', title: 'Se pierden acentos en CSV', severity: 'high' }),
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
  const [selectedId, setSelectedId] = useState<string | null>('1')
  const [lifecycle, setLifecycle] = useState<LifecycleTab>('todos')
  const filters: BugFilters = {
    lifecycle,
    category: 'all',
    severity: 'all',
    status: 'all',
    search: '',
    ...filtro,
  }

  return (
    <div className="app-shell" style={{ height: '100vh' }}>
      <BugList
        bugs={bugs}
        totalCount={bugs.length}
        counts={{ activos: 3, historicos: 2, todos: 5 }}
        kpis={{ active: 3, critical: 1, missingInfo: 2, solved: 1 }}
        filters={filters}
        categories={['frontend', 'backend']}
        severities={['critical', 'high', 'medium', 'low']}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onLifecycleChange={setLifecycle}
        onSearchChange={() => {}}
        onSeverityChange={() => {}}
        onCategoryChange={() => {}}
        onStatusChange={() => {}}
        onClearFilters={() => {}}
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
        }}
        categories={['frontend']}
        severities={['critical']}
        onSelect={() => {}}
        onLifecycleChange={() => {}}
        onSearchChange={() => {}}
        onSeverityChange={() => {}}
        onCategoryChange={() => {}}
        onStatusChange={() => {}}
        onClearFilters={() => {}}
      />
    </div>
  ),
}
