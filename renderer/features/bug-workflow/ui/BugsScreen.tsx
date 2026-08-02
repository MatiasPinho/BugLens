// BugsScreen.tsx
//
// Pantalla de Bugs en tres columnas: lista (navegación), reporte del bug elegido
// (lectura y trabajo) y propiedades + actividad.
//
// Es la dueña del estado compartido — filtros, pestañas y cuál es el bug
// seleccionado — porque las tres columnas dependen de lo mismo. Las columnas solo
// renderizan.

import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { bugRecordKey } from '../../../../src/features/bug-workflow/domain/bugStatusKey'
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
import { IconBug, IconSettings } from '../../../components/icons'
import BugComments from './BugComments'
import BugDetail, { type BugDetailAgentInfo, type BugDetailProject } from './BugDetail'
import BugList from './BugList'
import BugPropertiesRail from './BugPropertiesRail'
import {
  type BugFilters,
  type BugKpiFilter,
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
  focusedKey?: string | null
  onFocus?: (key: string) => void
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
  focusedKey,
  onFocus,
  searchInputRef,
}: Props) {
  const [lifecycle, setLifecycle] = useState<LifecycleTab>('activos')
  const [category, setCategory] = useState<BugCategory | 'all'>('all')
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [status, setStatus] = useState<BugStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState<BugKpiFilter | null>('active')
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [bugListOpen, setBugListOpen] = useState(false)
  const commentsRef = useRef<HTMLElement | null>(null)
  const internalSearchInputRef = useRef<HTMLInputElement | null>(null)
  const bugListTriggerRef = useRef<HTMLButtonElement | null>(null)
  const activeSearchInputRef = searchInputRef ?? internalSearchInputRef

  const filters: BugFilters = useMemo(
    () => ({ lifecycle, category, severity, status, search, quickFilter }),
    [lifecycle, category, severity, status, search, quickFilter],
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
    filtered.find((bug) => bugRecordKey(bug.enriched.raw) === focusedKey) ?? filtered[0] ?? null
  const selectedKey = selected ? bugRecordKey(selected.enriched.raw) : null

  useEffect(() => {
    if (!propertiesOpen && !bugListOpen) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPropertiesOpen(false)
      if (bugListOpen) {
        setBugListOpen(false)
        window.setTimeout(() => bugListTriggerRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [bugListOpen, propertiesOpen])

  useEffect(() => {
    if (!bugListOpen) return undefined
    const focusTimer = window.setTimeout(() => activeSearchInputRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [activeSearchInputRef, bugListOpen])

  const closeBugList = () => {
    setBugListOpen(false)
    window.setTimeout(() => bugListTriggerRef.current?.focus(), 0)
  }

  const changeLifecycle = (tab: LifecycleTab) => {
    setPropertiesOpen(false)
    setLifecycle(tab)
    setStatus('all')
    setQuickFilter(tab === 'activos' ? 'active' : null)
  }

  const clearFilters = () => {
    setPropertiesOpen(false)
    setSearch('')
    setCategory('all')
    setSeverity('all')
    setStatus('all')
    setQuickFilter(lifecycle === 'activos' ? 'active' : null)
  }

  const selectKpi = (filter: BugKpiFilter) => {
    setPropertiesOpen(false)
    setSearch('')
    setCategory('all')
    setSeverity(filter === 'critical' ? 'critical' : 'all')
    setStatus(filter === 'solved' ? 'solucionado' : 'all')
    setLifecycle(filter === 'active' ? 'activos' : filter === 'solved' ? 'historicos' : 'todos')
    setQuickFilter(filter)
  }

  const showComments = () => {
    setPropertiesOpen(false)
    commentsRef.current?.scrollIntoView({ block: 'start' })
    commentsRef.current?.focus({ preventScroll: true })
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
        selectedKey={selectedKey}
        onSelect={(key) => {
          setPropertiesOpen(false)
          if (bugListOpen) closeBugList()
          onFocus?.(key)
        }}
        onLifecycleChange={changeLifecycle}
        onSearchChange={(value) => {
          setPropertiesOpen(false)
          setSearch(value)
          setQuickFilter(null)
        }}
        onSeverityChange={(value) => {
          setPropertiesOpen(false)
          setSeverity(value)
          setQuickFilter(null)
        }}
        onCategoryChange={(value) => {
          setPropertiesOpen(false)
          setCategory(value)
          setQuickFilter(null)
        }}
        onStatusChange={(value) => {
          setPropertiesOpen(false)
          setStatus(value)
          setQuickFilter(null)
        }}
        onKpiSelect={selectKpi}
        onClearFilters={clearFilters}
        searchInputRef={activeSearchInputRef}
        overlayOpen={bugListOpen}
        onClose={closeBugList}
      />

      {bugListOpen && (
        <button
          type="button"
          className="bug-list-overlay-scrim"
          onClick={closeBugList}
          aria-label="Cerrar lista de bugs"
          tabIndex={-1}
        />
      )}

      <div className="app-content">
        {topbar}

        <div className="bugs-work">
          {selected ? (
            <>
              <div className="bugs-center">
                <div className="bugs-compact-toolbar">
                  <button
                    ref={bugListTriggerRef}
                    type="button"
                    className="btn-secondary btn-mini bugs-list-trigger"
                    aria-controls="bug-list-panel"
                    aria-expanded={bugListOpen}
                    onClick={() => {
                      setPropertiesOpen(false)
                      setBugListOpen(true)
                    }}
                  >
                    <IconBug size={12} />
                    Bugs
                    <span className="bugs-list-trigger-count">{filtered.length}</span>
                  </button>
                  <span className="bugs-compact-toolbar-hint truncate text-xs">
                    Gestioná estado, responsables y fecha
                  </span>
                  <span className="bugs-compact-position text-xs" aria-live="polite">
                    {filtered.findIndex((bug) => bugRecordKey(bug.enriched.raw) === selectedKey) +
                      1}
                    {' de '}
                    {filtered.length}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-mini"
                    aria-controls="bug-properties-panel"
                    aria-expanded={propertiesOpen}
                    onClick={() => setPropertiesOpen(true)}
                  >
                    <IconSettings size={12} />
                    Propiedades
                  </button>
                </div>
                {/* key por bug: cambiar de bug reinicia el estado interno del
                  detalle (agente externo, borradores) en vez de arrastrarlo. */}
                <BugDetail
                  key={selectedKey}
                  bug={selected}
                  project={project}
                  onSetStatus={onSetStatus ? (next) => onSetStatus(selected, next) : undefined}
                  onDelete={onDelete ? () => onDelete(selected) : undefined}
                  onAnalyzeExternalAgent={onAnalyzeExternalAgent}
                  commentCount={selected.comments?.length ?? 0}
                  onShowComments={showComments}
                />

                <BugComments
                  ref={commentsRef}
                  key={`comments-${selectedKey}`}
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
                overlayOpen={propertiesOpen}
                onClose={propertiesOpen ? () => setPropertiesOpen(false) : undefined}
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
