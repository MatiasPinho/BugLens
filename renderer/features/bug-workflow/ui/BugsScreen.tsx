// BugsScreen.tsx
//
// Pantalla de Bugs en tres columnas: lista (navegación), reporte del bug elegido
// (lectura y trabajo) y propiedades + actividad.
//
// Es la dueña del estado compartido — filtros, pestañas y cuál es el bug
// seleccionado — porque las tres columnas dependen de lo mismo. Las columnas solo
// renderizan.

import type React from 'react'
import { useMemo, useState } from 'react'
import type {
  AnalyzedBug,
  BugCategory,
  BugComment,
  BugStatus,
  CommentVote,
  ExternalAgentResult,
  Severity,
  TeamMember,
} from '../../../../src/shared/contracts'
import EmptyState from '../../../components/EmptyState'
import BugComments from './BugComments'
import BugDetail, { type BugDetailAgentInfo, type BugDetailProject } from './BugDetail'
import BugList from './BugList'
import BugPropertiesRail from './BugPropertiesRail'
import {
  type BugFilters,
  bugKpis,
  filterBugs,
  type LifecycleTab,
  lifecycleCounts,
} from './bugPresentation'

interface Props {
  results: AnalyzedBug[]
  /** Barra superior del shell. Arranca a la derecha de la lista, no la cruza. */
  topbar?: React.ReactNode
  project?: BugDetailProject
  agent?: BugDetailAgentInfo
  members?: TeamMember[]
  onSetStatus?: (bug: AnalyzedBug, status: BugStatus) => void
  onSetAssignees?: (bug: AnalyzedBug, userIds: string[]) => void
  onSetDueDate?: (bug: AnalyzedBug, dueDate: string | null) => void
  onAddComment?: (bug: AnalyzedBug, body: string, parentId: string | null) => Promise<BugComment>
  onVoteComment?: (commentId: string, value: CommentVote) => void
  onDelete?: (bug: AnalyzedBug) => void
  onAnalyzeExternalAgent?: (bug: AnalyzedBug) => Promise<ExternalAgentResult>
  focusedId?: string | null
  onFocus?: (id: string) => void
  searchInputRef?: React.MutableRefObject<HTMLInputElement | null>
}

export default function BugsScreen({
  results,
  topbar,
  project,
  agent,
  members = [],
  onSetStatus,
  onSetAssignees,
  onSetDueDate,
  onAddComment,
  onVoteComment,
  onDelete,
  onAnalyzeExternalAgent,
  focusedId,
  onFocus,
  searchInputRef,
}: Props) {
  const [lifecycle, setLifecycle] = useState<LifecycleTab>('activos')
  const [category, setCategory] = useState<BugCategory | 'all'>('all')
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [status, setStatus] = useState<BugStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const filters: BugFilters = useMemo(
    () => ({ lifecycle, category, severity, status, search }),
    [lifecycle, category, severity, status, search],
  )
  const counts = useMemo(() => lifecycleCounts(results), [results])
  const kpis = useMemo(() => bugKpis(results), [results])
  const filtered = useMemo(() => filterBugs(results, filters), [results, filters])
  const categories = useMemo(
    () => [...new Set(results.map((bug) => bug.analysis.category))],
    [results],
  )
  const severities = useMemo(
    () => [...new Set(results.map((bug) => bug.analysis.severity))],
    [results],
  )

  // El bug abierto sale de lo filtrado: si el filtro lo deja afuera, se abre el
  // primero de la lista en vez de mostrar un reporte que ya no está a la vista.
  const selected =
    filtered.find((bug) => bug.enriched.raw.id === focusedId) ?? filtered[0] ?? null

  const changeLifecycle = (tab: LifecycleTab) => {
    setLifecycle(tab)
    setStatus('all')
  }

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setSeverity('all')
    setStatus('all')
  }

  return (
    <>
      {/* La lista es hermana del rail, de altura completa: es navegación, no
          contenido de la pantalla. Por eso el topbar arranca a su derecha. */}
      <BugList
        bugs={filtered}
        totalCount={results.length}
        counts={counts}
        kpis={kpis}
        filters={filters}
        categories={categories}
        severities={severities}
        selectedId={selected?.enriched.raw.id ?? null}
        onSelect={(id) => onFocus?.(id)}
        onLifecycleChange={changeLifecycle}
        onSearchChange={setSearch}
        onSeverityChange={setSeverity}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        onClearFilters={clearFilters}
        searchInputRef={searchInputRef}
      />

      <div className="app-content">
        {topbar}

        <div className="bugs-work">
        {selected ? (
          <>
            <div className="bugs-center">
              {/* key por bug: cambiar de bug reinicia el estado interno del
                  detalle (agente externo, borradores) en vez de arrastrarlo. */}
              <BugDetail
                key={selected.enriched.raw.id}
                bug={selected}
                project={project}
                onSetStatus={onSetStatus ? (next) => onSetStatus(selected, next) : undefined}
                onDelete={onDelete ? () => onDelete(selected) : undefined}
                onAnalyzeExternalAgent={onAnalyzeExternalAgent}
              />

              <BugComments
                key={`comments-${selected.enriched.raw.id}`}
                bug={selected}
                comments={selected.comments ?? []}
                onAddComment={
                  onAddComment
                    ? async (body, parentId) => {
                        await onAddComment(selected, body, parentId)
                      }
                    : undefined
                }
                onVote={onVoteComment}
              />
            </div>

            <BugPropertiesRail
              bug={selected}
              agent={agent}
              members={members}
              onSetStatus={onSetStatus ? (next) => onSetStatus(selected, next) : undefined}
              onSetAssignees={
                onSetAssignees ? (userIds) => onSetAssignees(selected, userIds) : undefined
              }
              onSetDueDate={onSetDueDate ? (due) => onSetDueDate(selected, due) : undefined}
            />
          </>
        ) : (
          <div className="bugs-center">
            <BugsEmptyState
              total={results.length}
              lifecycle={lifecycle}
              onReset={() => {
                clearFilters()
                setLifecycle('todos')
              }}
            />
          </div>
        )}
        </div>
      </div>
    </>
  )
}

function BugsEmptyState({
  total,
  lifecycle,
  onReset,
}: {
  total: number
  lifecycle: LifecycleTab
  onReset: () => void
}) {
  const { title, description } =
    total === 0
      ? {
          title: 'Todavía no hay bugs analizados',
          description: 'Cargá un Excel de QA o un bug a mano para que BugLens los reescriba.',
        }
      : lifecycle === 'activos'
        ? {
            title: 'No hay bugs activos',
            description: 'Todo lo pendiente está al día. El histórico tiene el resto.',
          }
        : lifecycle === 'historicos'
          ? { title: 'No hay bugs en el histórico', description: undefined }
          : {
              title: 'Ningún bug coincide con estos filtros',
              description: 'Probá con menos filtros o buscá otro texto.',
            }

  return (
    <div className="flex min-h-0 flex-1">
      <EmptyState
        title={title}
        description={description}
        action={
          total > 0 ? (
            <button type="button" onClick={onReset} className="btn-secondary">
              {lifecycle !== 'todos' ? 'Ver todos' : 'Limpiar filtros'}
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
