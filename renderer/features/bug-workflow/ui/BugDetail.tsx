// BugDetail.tsx
//
// Columna central de la pantalla de Bugs: el reporte reescrito del bug elegido,
// las capturas, el agente externo y el reporte original.
//
// Las propiedades editables y la actividad viven en `BugPropertiesRail`, y los
// comentarios en `BugComments`: acá solo se lee y se trabaja el reporte.

import React, { useState } from 'react'
import type {
  AnalyzedBug,
  BugStatus,
  ExternalAgentProgress,
  ExternalAgentResult,
} from '../../../../src/shared/contracts'
import { ActionModal } from '../../../components/ActionModal'
import CollapsibleBlock from '../../../components/CollapsibleBlock'
import { IconChevronLeft } from '../../../components/icons'
import { col } from '../../../theme'
import {
  AgentAccessIssueCard,
  AgentRunningProgress,
  CloudAgentReport,
  parseAgentAccessIssue,
  parseResolvedSuggestion,
  ResolvedSuggestionCard,
} from './agentReport'
import {
  CategoryBadge,
  CopyButton,
  DeleteControl,
  DocImageGallery,
  MissingInfoBadge,
  ProblemCountBadge,
  SectionCard,
  SeverityBadge,
  StatusBadge,
} from './BugAtoms'
import { bugReportAsText, formatAgentDuration, formatTimelineDate } from './bugPresentation'
import { BugRewrittenReport } from './BugRewrittenReport'

export interface BugDetailAgentInfo {
  command: string
  repository?: string
  branch?: string
}

export interface BugDetailProject {
  name: string
  slug: string
  bugCount?: number
}

interface Props {
  bug: AnalyzedBug
  project?: BugDetailProject
  onBack?: () => void
  onSetStatus?: (status: BugStatus) => void
  onDelete?: () => void
  onAnalyzeExternalAgent?: (bug: AnalyzedBug) => Promise<ExternalAgentResult>
}

export default function BugDetail({
  bug,
  project,
  onBack,
  onSetStatus,
  onDelete,
  onAnalyzeExternalAgent,
}: Props) {
  const { enriched, analysis } = bug
  const raw = enriched.raw
  const rewritten = analysis.rewritten

  const [externalAgentResult, setExternalAgentResult] = useState<ExternalAgentResult | null>(
    analysis.externalAgent ?? null,
  )
  const [externalAgentRunning, setExternalAgentRunning] = useState(false)
  const [externalAgentProgress, setExternalAgentProgress] = useState<ExternalAgentProgress | null>(
    null,
  )
  const [externalAgentStartedAt, setExternalAgentStartedAt] = useState<number | null>(null)
  const [externalAgentElapsedMs, setExternalAgentElapsedMs] = useState(0)
  const [externalAgentLastOutputAt, setExternalAgentLastOutputAt] = useState<number | null>(null)
  const [externalAgentConfirmOpen, setExternalAgentConfirmOpen] = useState(false)
  const [resolvedSuggestionDismissed, setResolvedSuggestionDismissed] = useState(false)
  const previousBugIdRef = React.useRef(raw.id)
  const externalAgentHistory = analysis.externalAgentHistory ?? []

  const allImages = enriched.googleDocs.flatMap((doc) => doc.images ?? [])
  const runExternalAgent =
    onAnalyzeExternalAgent ??
    (typeof window !== 'undefined' ? window.electronAPI?.analyzeWithExternalAgent : undefined)

  React.useEffect(() => {
    if (externalAgentRunning) return
    if (previousBugIdRef.current !== raw.id) {
      previousBugIdRef.current = raw.id
      setExternalAgentResult(analysis.externalAgent ?? null)
      setResolvedSuggestionDismissed(false)
      return
    }
    if (analysis.externalAgent) setExternalAgentResult(analysis.externalAgent)
  }, [analysis.externalAgent, externalAgentRunning, raw.id])

  React.useEffect(() => {
    if (!externalAgentRunning || !externalAgentStartedAt) return undefined
    const timer = window.setInterval(() => {
      setExternalAgentElapsedMs(Date.now() - externalAgentStartedAt)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [externalAgentRunning, externalAgentStartedAt])

  React.useEffect(() => {
    if (!externalAgentRunning) return undefined
    return window.electronAPI?.onExternalAgentProgress?.((progress) => {
      if (progress.bugId !== raw.id) return
      setExternalAgentProgress(progress)
      setExternalAgentElapsedMs(progress.elapsedMs)
      setExternalAgentLastOutputAt(Date.now())
    })
  }, [externalAgentRunning, raw.id])

  const handleExternalAgent = async () => {
    if (!runExternalAgent || externalAgentRunning) return
    const startedAt = Date.now()
    setExternalAgentRunning(true)
    setExternalAgentResult(null)
    setExternalAgentProgress(null)
    setExternalAgentStartedAt(startedAt)
    setExternalAgentElapsedMs(0)
    setExternalAgentLastOutputAt(null)
    setResolvedSuggestionDismissed(false)
    try {
      setExternalAgentResult(await runExternalAgent(bug))
    } catch (err) {
      setExternalAgentResult({
        ok: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        command: '',
        durationMs: 0,
      })
    } finally {
      setExternalAgentRunning(false)
    }
  }

  const externalAgentSilenceMs = externalAgentRunning
    ? Date.now() - (externalAgentLastOutputAt ?? externalAgentStartedAt ?? Date.now())
    : 0
  const externalAgentRunningOutput = externalAgentProgress?.output.trim()
  const externalAgentStatusText = externalAgentRunningOutput
    ? `última salida hace ${formatAgentDuration(externalAgentSilenceMs)}`
    : `sin salida todavía · ${formatAgentDuration(externalAgentElapsedMs)}`
  const resolvedSuggestion = externalAgentResult?.ok
    ? parseResolvedSuggestion(externalAgentResult.output)
    : null
  const previousExternalAgentRuns = externalAgentHistory.filter(
    (item) =>
      item.createdAt !== externalAgentResult?.createdAt ||
      item.output !== externalAgentResult?.output,
  )

  return (
    <div className="bug-detail flex flex-col">
      <header className="bug-detail-hero">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="btn-icon mt-0.5"
            aria-label="volver a la lista"
            title="volver a la lista (Esc)"
          >
            <IconChevronLeft size={16} />
          </button>
        )}
        <div className="bug-detail-headline">
          <div className="bug-detail-meta">
            <span className="bug-row-number">
              Fila {raw.rowIndex}
              {project ? ` · ${project.name}` : ''}
            </span>
            <SeverityBadge severity={analysis.severity} />
            {/* Solo lectura: cambiar el estado es del rail de propiedades. Dos
                controles para lo mismo en la misma pantalla se contradicen. */}
            <StatusBadge status={bug.status} />
            <CategoryBadge>{analysis.category}</CategoryBadge>
            {rewritten.problemCount > 1 && <ProblemCountBadge count={rewritten.problemCount} />}
            {analysis.missingInformation.length > 0 && (
              <MissingInfoBadge count={analysis.missingInformation.length} />
            )}
          </div>
          <h2 className="bug-detail-title">{raw.title}</h2>
          <p className="bug-detail-summary">{analysis.summary}</p>
        </div>
        <div className="bug-detail-actions">
          <CopyButton text={bugReportAsText(bug)} label="Copiar reporte" />
          <button
            type="button"
            onClick={() => setExternalAgentConfirmOpen(true)}
            className="btn-primary flex-shrink-0"
            disabled={externalAgentRunning || !runExternalAgent}
            title="analizar con el agente externo configurado"
          >
            {externalAgentRunning ? 'Analizando…' : 'Analizar con agente'}
          </button>
          {onDelete && <DeleteControl onConfirm={onDelete} title={raw.title} />}
        </div>
      </header>

      <ExternalAgentConfirmModal
        open={externalAgentConfirmOpen}
        busy={externalAgentRunning}
        onClose={() => setExternalAgentConfirmOpen(false)}
        onConfirm={() => {
          setExternalAgentConfirmOpen(false)
          void handleExternalAgent()
        }}
      />

      <div className="bug-detail-main">
        <SectionCard
          title="Reporte reescrito"
          aside={rewritten.problemCount > 1 ? <ProblemCountBadge count={rewritten.problemCount} /> : undefined}
        >
          {/* Los bloques largos se recortan para que los comentarios queden al
              alcance sin atravesar varias pantallas de reporte. */}
          <CollapsibleBlock label="el reporte">
            <BugRewrittenReport bug={bug} />
          </CollapsibleBlock>
        </SectionCard>

        {(externalAgentResult || externalAgentRunning) && (
          // Mientras corre no se pliega: la salida en vivo es justamente lo que
          // se está mirando.
          <CollapsibleBlock label="el aporte del agente" disabled={externalAgentRunning}>
            <ExternalAgentPanel
              running={externalAgentRunning}
              result={externalAgentResult}
              elapsedMs={externalAgentElapsedMs}
              statusText={externalAgentStatusText}
              runningOutput={externalAgentRunningOutput}
            />
          </CollapsibleBlock>
        )}

        {previousExternalAgentRuns.length > 0 && (
          <ExternalAgentHistoryPanel items={previousExternalAgentRuns} />
        )}

        {resolvedSuggestion && !resolvedSuggestionDismissed && bug.status !== 'solucionado' && (
          <ResolvedSuggestionCard
            reason={resolvedSuggestion.reason}
            onConfirm={() => {
              onSetStatus?.('solucionado')
              setResolvedSuggestionDismissed(true)
            }}
            onDismiss={() => setResolvedSuggestionDismissed(true)}
            canConfirm={Boolean(onSetStatus)}
          />
        )}

        {allImages.length > 0 && (
          <SectionCard title="Capturas del Google Doc" count={allImages.length}>
            <DocImageGallery images={allImages} />
          </SectionCard>
        )}

        <OriginalReportDisclosure bug={bug} />
      </div>
    </div>
  )
}


// Solo muestra hechos con fecha real registrada (notas y corridas del agente) más
// el tiempo de proceso del análisis. Nada inventado: si no hay datos, no se rinde.


// ─── Reporte original (para auditar la reescritura) ──────────────────────────

function OriginalReportDisclosure({ bug }: { bug: AnalyzedBug }) {
  const raw = bug.enriched.raw
  return (
    <details className="panel-card group">
      <summary className="disclosure-summary flex items-center gap-2.5 px-4 py-3.5">
        <span className="-rotate-90 caret-down transition-transform group-open:rotate-0" />
        <span className="font-semibold text-sm" style={{ color: col.fgBody }}>
          Ver el reporte original del QA
        </span>
        <span className="ml-auto text-2xs" style={{ color: col.fgDim }}>
          Para auditar la reescritura
        </span>
      </summary>
      <div
        className="grid gap-2 px-4 pb-4 text-sm"
        style={{ color: col.fgMuted, lineHeight: 1.6 }}
      >
        {raw.description && <p>{raw.description}</p>}
        {raw.stepsToReproduce && <OriginalField label="Pasos" value={raw.stepsToReproduce} />}
        {raw.actualResult && <OriginalField label="Resultado actual" value={raw.actualResult} />}
        {raw.expectedResult && <OriginalField label="Resultado esperado" value={raw.expectedResult} />}
        {raw.environment && <OriginalField label="Ambiente" value={raw.environment} />}
      </div>
    </details>
  )
}

function OriginalField({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold" style={{ color: col.fgStrong }}>
        {label}:{' '}
      </span>
      {value}
    </p>
  )
}

// ─── Agente externo ──────────────────────────────────────────────────────────

function ExternalAgentPanel({
  running,
  result,
  elapsedMs,
  statusText,
  runningOutput,
}: {
  running: boolean
  result: ExternalAgentResult | null
  elapsedMs: number
  statusText: string
  runningOutput?: string
}) {
  const ok = result?.ok
  const duration = running ? elapsedMs : (result?.durationMs ?? 0)
  const agentOutput = running
    ? runningOutput || 'Esperando salida del agente externo. El proceso sigue activo.'
    : result?.output || 'El agente no devolvió salida.'
  const accessIssue = parseAgentAccessIssue(agentOutput)

  return (
    <div className="cloud-agent-panel">
      <div className="cloud-agent-header">
        <div className="min-w-0">
          <div className="cloud-agent-kicker">
            <span className="cloud-agent-mark" aria-hidden="true" />
            Aporte del agente externo
          </div>
          <p className="cloud-agent-lead">
            Revisión adicional hecha por el agente configurado sobre este bug.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <span
            className={`badge ${running ? 'badge-accent' : ok ? 'badge-solved' : 'badge-severity-critical'}`}
          >
            {running ? 'ejecutando' : ok ? 'completado' : 'error'}
          </span>
          <span className="mono text-xs" style={{ color: col.fgDim }}>
            {formatAgentDuration(duration)}
          </span>
        </div>
      </div>

      <div className="cloud-agent-body">
        {running && (
          <div className="text-xs" style={{ color: col.fgMuted }}>
            proceso activo · {statusText}
          </div>
        )}
        {result?.error && (
          <div className="whitespace-pre-line text-sm" style={{ color: col.critical }}>
            {result.error}
          </div>
        )}

        {accessIssue ? (
          <AgentAccessIssueCard path={accessIssue.path} />
        ) : running ? (
          <AgentRunningProgress output={agentOutput} />
        ) : ok ? (
          <CloudAgentReport>{agentOutput}</CloudAgentReport>
        ) : null}

        {!ok && result?.output && result.error && (
          <div>
            <div className="kicker mb-2">salida técnica</div>
            <CloudAgentReport>{result.output}</CloudAgentReport>
          </div>
        )}
      </div>
    </div>
  )
}

function ExternalAgentHistoryPanel({ items }: { items: ExternalAgentResult[] }) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const visibleItems = expanded ? items : items.slice(0, 3)
  const hiddenCount = Math.max(0, items.length - visibleItems.length)

  return (
    <SectionCard title="Historial del agente" count={items.length}>
      <div className="grid gap-3">
        <div className="grid gap-2">
          {visibleItems.map((item, index) => (
            <details
              key={`${item.createdAt ?? index}-${item.command}`}
              className="agent-history-item"
            >
              <summary className="agent-history-summary">
                <span>
                  {item.createdAt ? formatTimelineDate(item.createdAt) : `corrida ${index + 1}`}
                </span>
                <span className="agent-history-status">{item.ok ? 'completado' : 'error'}</span>
              </summary>
              <div className="agent-history-body">
                {item.error && (
                  <p className="mb-2 whitespace-pre-line text-sm" style={{ color: col.critical }}>
                    {item.error}
                  </p>
                )}
                <CloudAgentReport>
                  {item.output || 'El agente no devolvió salida.'}
                </CloudAgentReport>
              </div>
            </details>
          ))}
        </div>

        {items.length > 3 && (
          <button
            type="button"
            className="history-toggle"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'mostrar menos' : `mostrar ${hiddenCount} anteriores`}
          </button>
        )}
      </div>
    </SectionCard>
  )
}

function ExternalAgentConfirmModal({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ActionModal
      open={open}
      title="analizar con el agente externo"
      description="BugLens va a enviar este bug al agente externo configurado para pedir una revisión adicional."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <div className="external-agent-consent-grid">
          <ConsentPoint
            title="calidad variable"
            text="La precisión de la respuesta depende del modelo, provider y configuración elegidos por el usuario."
          />
          <ConsentPoint
            title="tiempo variable"
            text="La velocidad puede cambiar según cola del proveedor, tamaño del repo, timeout y cantidad de contexto."
          />
          <ConsentPoint
            title="acceso al repositorio"
            text="Si hay un repositorio local configurado, el agente recibirá esa ruta y podrá leer archivos para orientar el análisis."
          />
          <ConsentPoint
            title="revisión humana"
            text="El resultado se integra al reporte como ayuda de triage; no reemplaza la validación técnica del equipo."
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy}>
            iniciar análisis
          </button>
        </div>
      </div>
    </ActionModal>
  )
}

function ConsentPoint({ title, text }: { title: string; text: string }) {
  return (
    <div className="external-agent-consent-point">
      <div className="external-agent-consent-title">{title}</div>
      <p className="external-agent-consent-text">{text}</p>
    </div>
  )
}
