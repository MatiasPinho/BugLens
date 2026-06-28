import { useState } from 'react'
import { col } from '../theme'
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
    <section className="project-switcher rounded-md p-3" aria-busy={busy}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="project-mark flex h-7 w-7 flex-shrink-0 items-center justify-center rounded">
            <IconFolder size={16} />
          </span>
          <div className="min-w-0">
            <div className="section-label mb-0">proyecto</div>
            <div className="truncate text-xs" style={{ color: col.fg }}>
              {activeProject?.name ?? 'sin proyecto'}
            </div>
            {activeProject?.slug && (
              <div className="truncate text-2xs" style={{ color: col.muted }}>
                {activeProject.slug}
              </div>
            )}
          </div>
        </div>

        <span className="project-count flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded px-1.5 text-2xs">
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
        <div className="project-sync-line truncate text-xs">
          {busy ? <LoadingInline label="sincronizando proyecto" /> : 'proyecto compartido'}
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
            <IconPlus size={12} className="button-icon button-icon-plus" />
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
        <div className="space-y-3.5">
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
            <div className="flex items-center justify-between gap-2">
              <label className="label mb-0" htmlFor="dashboard-new-project-slug">
                slug
              </label>
              <span className="text-2xs" style={{ color: col.dim }}>
                único
              </span>
            </div>
            <input
              id="dashboard-new-project-slug"
              type="text"
              className="input mt-1 text-xs"
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
