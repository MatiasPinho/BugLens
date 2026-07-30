/**
 * BugPropertiesRail.tsx
 *
 * Columna derecha: lo que se puede *cambiar* de un bug (responsables, fecha
 * límite, estado) y lo que *pasó* con él (quién lo reportó, la actividad).
 *
 * Todo lo editable viaja por callback: el rail no habla con el IPC.
 */

import { useState } from 'react'
import type {
  AnalyzedBug,
  BugStatus,
  Severity,
  TeamMember,
} from '../../../../src/shared/contracts'
import { avatarToneClass, initialsOf } from '../../../components/avatarTone'
import { IconCheck, IconPlus, IconWarning, IconX } from '../../../components/icons'
import { col } from '../../../theme'
import { actorNameOf, describeActivity, formatDueDate, showsOverdueWarning } from './bugActivity'
import { CategoryBadge, ConfidenceBar, SeverityBadge, StatusSelect } from './BugAtoms'
import { formatTimelineDate, screenPathOf, severityLabel } from './bugPresentation'

interface Props {
  bug: AnalyzedBug
  /** Comando del agente externo configurado, si lo hay. */
  agent?: { command: string; repository?: string; branch?: string }
  /** Miembros del proyecto: a quiénes se puede asignar. */
  members?: TeamMember[]
  onSetStatus?: (status: BugStatus) => void
  onSetAssignees?: (userIds: string[]) => void
  onSetDueDate?: (dueDate: string | null) => void
  onClose?: () => void
}

export default function BugPropertiesRail({
  bug,
  agent,
  members = [],
  onSetStatus,
  onSetAssignees,
  onSetDueDate,
  onClose,
}: Props) {
  const assignees = bug.assignees ?? []
  const overdue = showsOverdueWarning(bug.dueDate, bug.status)

  return (
    <aside className="bug-properties" aria-label="propiedades del bug">
      <div className="bug-properties-head">
        <h3 className="bug-properties-title">Propiedades</h3>
        {onClose && (
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={onClose}
            title="cerrar propiedades"
            aria-label="cerrar propiedades"
          >
            <IconX size={12} />
          </button>
        )}
      </div>

      <div className="bug-properties-body">
        <AssigneeField
          assignees={assignees}
          members={members}
          onChange={onSetAssignees}
        />

        <DueDateField dueDate={bug.dueDate ?? null} overdue={overdue} onChange={onSetDueDate} />

        <Field label="Categoría">
          <CategoryBadge>{bug.analysis.category}</CategoryBadge>
        </Field>

        {onSetStatus ? (
          <Field label="Estado">
            <StatusSelect status={bug.status} onChange={onSetStatus} />
          </Field>
        ) : null}

        <div className="bug-properties-meta">
          <MetaRow label="Reportado por">
            {bug.reportedBy ? (
              <MemberChip member={bug.reportedBy} />
            ) : (
              <span className="text-xs" style={{ color: col.fgDim }}>
                Sin autor registrado
              </span>
            )}
          </MetaRow>

          <MetaRow label="Severidad">
            <SeverityBadge severity={bug.analysis.severity} />
          </MetaRow>

          <SeverityMeter severity={bug.analysis.severity} />

          <MetaRow label="Pantalla">
            <ContextValue
              value={screenPathOf(bug)}
              // `screenPathOf` devuelve null cuando el reporte no informó
              // ninguna: se dice, no se inventa.
              fallback="Sin pantalla informada"
            />
          </MetaRow>

          <MetaRow label="Ambiente">
            <ContextValue
              value={
                bug.analysis.rewritten.environment === 'No informado'
                  ? null
                  : bug.analysis.rewritten.environment
              }
              fallback="No informado"
            />
          </MetaRow>

          <MetaRow label="Tipo">
            <ContextValue value={bug.analysis.bugType || null} fallback="No informado" />
          </MetaRow>

          <div className="bug-properties-confidence">
            <span className="bug-properties-meta-label">Confianza del análisis</span>
            <ConfidenceBar value={bug.analysis.confidence} showLabel={false} />
          </div>
        </div>

        {bug.analysis.missingInformation.length > 0 && (
          <section className="warn-card">
            <span className="kicker" style={{ color: col.warn }}>
              Datos que faltan
            </span>
            <ul className="missing-list">
              {bug.analysis.missingInformation.map((item) => (
                <li key={item} className="missing-item">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {agent && (
          <div className="bug-properties-field">
            <span className="kicker-xs">Agente configurado</span>
            {agent.command ? (
              <div className="grid gap-1.5">
                <code className="code-inline">{agent.command}</code>
                <span className="text-xs" style={{ color: col.fgMuted }}>
                  {agent.repository
                    ? `${agent.repository}${agent.branch ? ` · rama ${agent.branch}` : ''}`
                    : 'sin repositorio configurado'}
                </span>
              </div>
            ) : (
              <span className="text-xs" style={{ color: col.fgMuted }}>
                No hay agente externo configurado para este entorno.
              </span>
            )}
          </div>
        )}

        <BugActivityFeed bug={bug} />
      </div>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bug-properties-field">
      <span className="kicker-xs">{label}</span>
      {children}
    </div>
  )
}

/** Valor de contexto que puede no estar informado. Nunca inventa un relleno. */
function ContextValue({ value, fallback }: { value: string | null; fallback: string }) {
  if (!value) {
    return (
      <span className="text-xs" style={{ color: col.fgDim }}>
        {fallback}
      </span>
    )
  }
  return <span className="text-xs">{value}</span>
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bug-properties-meta-row">
      <span className="bug-properties-meta-label">{label}</span>
      <span className="bug-properties-meta-value">{children}</span>
    </div>
  )
}

export function MemberChip({ member }: { member: TeamMember }) {
  const name = member.displayName ?? member.email ?? 'sin nombre'
  return (
    <span className="member-chip" title={member.email ?? name}>
      <span className={`avatar avatar-sm ${avatarToneClass(member.id)}`} aria-hidden="true">
        {initialsOf(name)}
      </span>
      <span className="member-chip-name">{name}</span>
    </span>
  )
}

function AssigneeField({
  assignees,
  members,
  onChange,
}: {
  assignees: TeamMember[]
  members: TeamMember[]
  onChange?: (userIds: string[]) => void
}) {
  const [picking, setPicking] = useState(false)
  const assignedIds = new Set(assignees.map((member) => member.id))

  const toggle = (memberId: string) => {
    if (!onChange) return
    const next = new Set(assignedIds)
    if (next.has(memberId)) next.delete(memberId)
    else next.add(memberId)
    // Se manda el conjunto completo, no un delta: así dos clientes en paralelo
    // convergen al mismo estado.
    onChange([...next])
  }

  return (
    <div className="bug-properties-field">
      <span className="kicker-xs">Responsables</span>

      <div className="assignee-row">
        {assignees.length === 0 && (
          <span className="text-xs" style={{ color: col.fgDim }}>
            Sin asignar
          </span>
        )}
        {assignees.map((member) => (
          <MemberChip key={member.id} member={member} />
        ))}

        {onChange && members.length > 0 && (
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={() => setPicking((open) => !open)}
            aria-expanded={picking}
            title="cambiar responsables"
            aria-label="cambiar responsables"
          >
            <IconPlus size={12} />
          </button>
        )}
      </div>

      {picking && (
        <div className="assignee-picker">
          {members.map((member) => {
            const assigned = assignedIds.has(member.id)
            const name = member.displayName ?? member.email ?? member.id
            return (
              <button
                key={member.id}
                type="button"
                className={`assignee-option ${assigned ? 'assignee-option-on' : ''}`}
                aria-pressed={assigned}
                onClick={() => toggle(member.id)}
              >
                <span
                  className={`avatar avatar-sm ${avatarToneClass(member.id)}`}
                  aria-hidden="true"
                >
                  {initialsOf(name)}
                </span>
                <span className="truncate">{name}</span>
                {assigned && <IconCheck size={12} className="ml-auto" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DueDateField({
  dueDate,
  overdue,
  onChange,
}: {
  dueDate: string | null
  overdue: boolean
  onChange?: (dueDate: string | null) => void
}) {
  return (
    <div className="bug-properties-field">
      <span className="kicker-xs">Fecha límite</span>

      {onChange ? (
        <div className="due-date-row">
          <input
            type="date"
            className="input"
            aria-label="fecha límite"
            value={dueDate ?? ''}
            onChange={(event) => onChange(event.target.value || null)}
          />
          {dueDate && (
            <button
              type="button"
              className="btn-icon btn-icon-sm"
              onClick={() => onChange(null)}
              title="quitar la fecha límite"
              aria-label="quitar la fecha límite"
            >
              <IconX size={12} />
            </button>
          )}
        </div>
      ) : (
        <span className="text-sm">{dueDate ? formatDueDate(dueDate) : 'Sin fecha'}</span>
      )}

      {overdue && dueDate && (
        <span className="due-date-overdue" role="status">
          <IconWarning size={12} />
          Venció el {formatDueDate(dueDate)}
        </span>
      )}
    </div>
  )
}

/**
 * Barra de severidad. Es el equivalente a la barra de "priority" de la maqueta,
 * pero atada a la severidad real que asignó el análisis — no a un campo nuevo.
 */
function SeverityMeter({ severity }: { severity: Severity }) {
  const fill: Record<Severity, number> = { low: 25, medium: 50, high: 75, critical: 100 }
  return (
    <div className="severity-meter">
      <div
        className={`severity-meter-track severity-meter-${severity}`}
        role="img"
        aria-label={`severidad ${severityLabel[severity]}`}
      >
        <span className="severity-meter-fill" style={{ width: `${fill[severity]}%` }} />
      </div>
    </div>
  )
}

function BugActivityFeed({ bug }: { bug: AnalyzedBug }) {
  const activity = bug.activity ?? []

  return (
    <section className="bug-activity">
      <span className="kicker-xs">Actividad</span>

      {activity.length === 0 ? (
        <p className="text-xs" style={{ color: col.fgDim }}>
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <ol className="bug-activity-list">
          {activity.map((entry) => (
            <li key={entry.id} className="bug-activity-item">
              <span
                className={`avatar avatar-sm ${avatarToneClass(entry.actorId ?? entry.actorEmail)}`}
                aria-hidden="true"
              >
                {initialsOf(entry.actorName ?? entry.actorEmail ?? '')}
              </span>
              <span className="bug-activity-copy">
                <span className="bug-activity-text">
                  <strong>{actorNameOf(entry)}</strong> {describeActivity(entry)}
                </span>
                <time className="bug-activity-time mono" dateTime={entry.createdAt}>
                  {formatTimelineDate(entry.createdAt)}
                </time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
