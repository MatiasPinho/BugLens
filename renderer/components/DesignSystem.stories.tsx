import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import type { BugStatus, Severity } from '../../src/shared/contracts'
import {
  CategoryBadge,
  ConfidenceBar,
  CopyButton,
  MissingInfoBadge,
  ProblemCountBadge,
  SectionCard,
  SeverityBadge,
  StatusBadge,
} from '../features/bug-workflow/ui/BugAtoms'
import { BugKpiGrid } from '../features/bug-workflow/ui/BugKpiGrid'
import { col } from '../theme'
import { avatarToneClass, initialsOf } from './avatarTone'

// Kitchen-sink del design system: badges, controles y superficies con los tokens
// reales del código. Documentación viva de la paleta clara.
const meta: Meta = { title: 'buglens/DesignSystem' }
export default meta
type Story = StoryObj

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
const STATUSES: BugStatus[] = ['nuevo', 'en_progreso', 'solucionado', 'cerrado', 'no_replicado']
const CATEGORIES = ['frontend', 'backend', 'database', 'config', 'data', 'otro']

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export const Badges: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <Row label="Severidad">
        {SEVERITIES.map((severity) => (
          <SeverityBadge key={severity} severity={severity} />
        ))}
      </Row>
      <Row label="Estado">
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </Row>
      <Row label="Categoría y área">
        {CATEGORIES.map((category) => (
          <CategoryBadge key={category}>{category}</CategoryBadge>
        ))}
      </Row>
      <Row label="Señales del análisis">
        <MissingInfoBadge count={3} />
        <ProblemCountBadge count={3} />
      </Row>
    </div>
  ),
}

export const Controles: Story = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <Row label="Botones">
        <button type="button" className="btn-primary">
          Analizar bugs
        </button>
        <button type="button" className="btn-secondary">
          Exportar Excel
        </button>
        <button type="button" className="btn-danger">
          Borrar
        </button>
        <button type="button" className="btn-primary" disabled>
          Deshabilitado
        </button>
      </Row>
      <Row label="Botones chicos y de ícono">
        <button type="button" className="btn-mini">
          Mini
        </button>
        <button type="button" className="btn-icon" aria-label="ayuda">
          ?
        </button>
        <button type="button" className="btn-quiet">
          Limpiar
        </button>
      </Row>
      <Row label="Inputs">
        <input className="input" placeholder="Título del bug" style={{ maxWidth: 240 }} />
        <select className="input" style={{ maxWidth: 160 }} aria-label="severidad">
          <option>Severidad</option>
        </select>
      </Row>
      <Row label="Teclas">
        <kbd>j</kbd>
        <kbd>k</kbd>
        <kbd>esc</kbd>
        <kbd>1–5</kbd>
      </Row>
      <Row label="Confianza del análisis">
        <ConfidenceBar value={0.88} />
        <ConfidenceBar value={0.34} />
      </Row>
      <Row label="Copiar">
        <CopyButton text="texto a copiar" />
      </Row>
    </div>
  ),
}

export const Superficies: Story = {
  render: () => (
    <div className="grid gap-4" style={{ padding: 24, maxWidth: 720 }}>
      <BugKpiGrid active={17} critical={3} missingInfo={6} solved={5} />

      <SectionCard title="Reporte reescrito" count={2}>
        <div className="bug-rewrite-grid">
          <div className="rewrite-panel rewrite-panel-actual">
            <span className="rewrite-panel-title">Qué pasa</span>
            <p className="rewrite-panel-body">
              Al enviar credenciales válidas el botón queda con el spinner activo.
            </p>
          </div>
          <div className="rewrite-panel rewrite-panel-expected">
            <span className="rewrite-panel-title">Qué debería pasar</span>
            <p className="rewrite-panel-body">
              Debería navegar al dashboard o mostrar el error y liberar la carga.
            </p>
          </div>
        </div>
      </SectionCard>

      <section className="warn-card">
        <span className="kicker" style={{ color: col.warn }}>
          Datos que faltan
        </span>
        <ul className="missing-list">
          <li className="missing-item">El mensaje exacto de la consola</li>
          <li className="missing-item">Si pasa también en Chrome iOS</li>
        </ul>
      </section>

      <div className="dropzone">
        <span className="font-semibold text-md">Arrastrá el Excel o hacé click para elegirlo</span>
        <span className="mono text-2xs" style={{ color: col.fgDim }}>
          .xlsx · .xls · .csv
        </span>
      </div>
    </div>
  ),
}

const MIEMBROS = [
  { id: 'perfil-ana', displayName: 'Ana Lopez', email: 'ana.lopez@empresa.com' },
  { id: 'perfil-bruno', displayName: null, email: 'bruno.diaz@empresa.com' },
  { id: 'perfil-carla', displayName: 'Carla Mendez', email: 'carla@empresa.com' },
  { id: 'perfil-diego', displayName: 'Diego Ruiz', email: 'diego@empresa.com' },
  { id: 'perfil-elsa', displayName: 'Elsa Fernandez Prat', email: 'elsa@empresa.com' },
]

function Avatar({
  member,
  size = 'avatar-md',
}: {
  member: (typeof MIEMBROS)[number]
  size?: string
}) {
  return (
    <span
      className={`avatar ${size} ${avatarToneClass(member.id)}`}
      title={member.displayName ?? member.email}
    >
      {initialsOf(member.displayName ?? member.email)}
    </span>
  )
}

export const Identidad: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <Row label="Tonos de avatar (asignados por hash del id, no a mano)">
        {MIEMBROS.map((member) => (
          <Avatar key={member.id} member={member} />
        ))}
      </Row>

      <Row label="Tamaños">
        <Avatar member={MIEMBROS[0]} size="avatar-sm" />
        <Avatar member={MIEMBROS[0]} size="avatar-md" />
        <Avatar member={MIEMBROS[0]} size="avatar-lg" />
      </Row>

      <Row label="Grupo de personas (sin superponer: son iniciales, no fotos)">
        <span className="avatar-row">
          {MIEMBROS.slice(0, 4).map((member) => (
            <Avatar key={member.id} member={member} size="avatar-sm" />
          ))}
        </span>
      </Row>

      <Row label="Sin datos">
        <span className="avatar avatar-md avatar-muted">{initialsOf('')}</span>
      </Row>
    </div>
  ),
}

export const CodigoEnProsa: Story = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <Row label="Literal técnico dentro de un párrafo">
        <p className="text-md" style={{ color: col.fgBody }}>
          Al confirmar el alta, el backend devuelve <code className="code-chip">500</code> en{' '}
          <code className="code-chip">POST /v1/altas</code> y la consola registra un{' '}
          <code className="code-chip">Uncaught TypeError</code> antes de limpiar el formulario.
        </p>
      </Row>

      <Row label="Bloque de una línea (ruta, key)">
        <span className="code-inline">renderer/features/bug-workflow/ui/BugDetail.tsx</span>
      </Row>
    </div>
  ),
}
