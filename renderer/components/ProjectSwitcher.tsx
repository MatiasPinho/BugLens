import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
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
  const [projectListOpen, setProjectListOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(0)
  const projectPickerRef = useRef<HTMLDivElement | null>(null)
  const projectListboxId = useId()

  const canCreate = name.trim().length > 0 && !busy
  const projectCount = projects.length

  const updateName = (value: string) => {
    setName(value)
    setSlug(slugify(value))
  }

  useEffect(() => {
    const activeIndex = projects.findIndex((project) => project.id === activeProject?.id)
    setActiveOptionIndex(activeIndex >= 0 ? activeIndex : 0)
  }, [activeProject?.id, projects])

  useEffect(() => {
    if (!projectListOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!projectPickerRef.current?.contains(event.target as Node)) setProjectListOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [projectListOpen])

  const selectProject = (projectId: string) => {
    if (projectId !== activeProject?.id) onSelect(projectId)
    setProjectListOpen(false)
  }

  const handleProjectPickerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (busy || projects.length === 0) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setProjectListOpen(true)
      setActiveOptionIndex((current) => {
        if (event.key === 'ArrowDown') return current >= projects.length - 1 ? 0 : current + 1
        return current <= 0 ? projects.length - 1 : current - 1
      })
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setProjectListOpen(true)
      setActiveOptionIndex(event.key === 'Home' ? 0 : projects.length - 1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (projectListOpen) selectProject(projects[activeOptionIndex]?.id ?? '')
      else setProjectListOpen(true)
      return
    }

    if (event.key === 'Escape') {
      setProjectListOpen(false)
    }
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

      <div ref={projectPickerRef} className="relative space-y-2">
        <button
          type="button"
          role="combobox"
          aria-label="proyecto activo"
          aria-controls={projectListboxId}
          aria-expanded={projectListOpen}
          aria-haspopup="listbox"
          aria-activedescendant={
            projectListOpen && projects[activeOptionIndex]
              ? `dashboard-project-${projects[activeOptionIndex].id}`
              : undefined
          }
          className="project-select-trigger input flex w-full cursor-pointer items-center justify-between gap-2 text-left text-xs"
          onClick={() => {
            if (!busy && projects.length > 0) setProjectListOpen((open) => !open)
          }}
          onKeyDown={handleProjectPickerKeyDown}
          disabled={busy || projects.length === 0}
        >
          <span className="truncate">
            {activeProject ? `${activeProject.name} / ${activeProject.slug}` : 'sin proyecto'}
          </span>
          <span className="project-select-caret" aria-hidden="true" />
        </button>
        {projectListOpen && (
          <div id={projectListboxId} role="listbox" className="project-listbox">
            {projects.map((project, index) => {
              const selected = project.id === activeProject?.id
              const active = index === activeOptionIndex
              return (
                <button
                  key={project.id}
                  id={`dashboard-project-${project.id}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`project-option ${selected ? 'project-option-selected' : ''} ${
                    active ? 'project-option-active' : ''
                  }`}
                  onMouseEnter={() => setActiveOptionIndex(index)}
                  onClick={() => selectProject(project.id)}
                >
                  <span className="truncate">
                    <span>{project.name}</span>
                    <span className="project-option-separator"> / </span>
                    <span className="project-option-slug">{project.slug}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
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
