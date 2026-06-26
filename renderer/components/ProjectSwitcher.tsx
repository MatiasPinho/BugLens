import { useState } from 'react'
import { alpha, col } from '../theme'
import { ActionModal } from './ActionModal'
import { IconFolder, IconPlus } from './icons'
import { LoadingInline } from './Loading'

export interface ProjectOption {
  id: string
  name: string
  slug: string
}

interface Props {
  activeProject?: ProjectOption
  projects: ProjectOption[]
  busy?: boolean
  onSelect: (projectId: string) => void
  onCreate: (name: string, slug: string) => void
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function ProjectSwitcher({
  activeProject,
  projects,
  busy = false,
  onSelect,
  onCreate,
}: Props) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const canCreate = name.trim().length > 0 && !busy
  const projectCount = projects.length

  const updateName = (value: string) => {
    setName(value)
    setSlug(slugify(value))
  }

  const submit = () => {
    if (!canCreate) return
    onCreate(name.trim(), slugify(slug || name))
    setName('')
    setSlug('')
    setCreating(false)
  }

  return (
    <section
      className="project-switcher rounded-md p-3"
      style={{
        border: `1px solid ${alpha(col.cream, 0.2)}`,
        background: alpha(col.cream, 0.035),
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded"
            style={{
              color: col.cream,
              border: `1px solid ${alpha(col.cream, 0.22)}`,
              background: alpha(col.cream, 0.08),
            }}
          >
            <IconFolder size={16} />
          </span>
          <div className="min-w-0">
            <div className="section-label mb-0">proyecto</div>
            <div className="truncate text-xs" style={{ color: col.fg }}>
              {activeProject?.name ?? 'sin proyecto'}
            </div>
          </div>
        </div>

        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-2xs"
          style={{ color: col.fgMuted, border: `1px solid ${alpha(col.border, 0.28)}` }}
        >
          {projectCount}
        </span>
      </div>

      <div className="space-y-2">
        <label className="sr-only" htmlFor="dashboard-project">
          proyecto activo
        </label>
        <select
          id="dashboard-project"
          className="project-select input text-xs"
          value={activeProject?.id ?? ''}
          onChange={(event) => onSelect(event.target.value)}
          disabled={busy || projects.length === 0}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} / {project.slug}
            </option>
          ))}
        </select>
        <div className="h-5 truncate text-xs" style={{ color: col.fgMuted }}>
          {busy && <LoadingInline label="sincronizando proyecto" />}
        </div>
      </div>

      <button
        type="button"
        className="btn-secondary side-action mt-3 w-full"
        onClick={() => setCreating(true)}
        disabled={busy}
      >
        {busy ? (
          <LoadingInline label="esperando" />
        ) : (
          <>
            <IconPlus size={12} />
            nuevo proyecto
          </>
        )}
      </button>

      <ActionModal
        open={creating}
        title="nuevo proyecto"
        description="Creá un espacio separado para bugs, estados y análisis."
        onClose={() => setCreating(false)}
      >
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="dashboard-new-project-name">
              nombre
            </label>
            <input
              id="dashboard-new-project-name"
              type="text"
              className="input text-xs"
              value={name}
              onChange={(event) => updateName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
                if (event.key === 'Escape') setCreating(false)
              }}
              placeholder="cliente / producto"
            />
          </div>
          <div>
            <label className="label" htmlFor="dashboard-new-project-slug">
              slug
            </label>
            <input
              id="dashboard-new-project-slug"
              type="text"
              className="input text-xs"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
                if (event.key === 'Escape') setCreating(false)
              }}
              placeholder="cliente-producto"
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCreating(false)}
              disabled={busy}
            >
              cancelar
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={!canCreate}>
              {busy ? <LoadingInline label="creando" /> : 'crear'}
            </button>
          </div>
        </div>
      </ActionModal>
    </section>
  )
}
