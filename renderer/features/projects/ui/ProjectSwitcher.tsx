import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { initialsOf } from '../../../components/avatarTone'
import { IconPlus } from '../../../components/icons'
import { LoadingInline } from '../../../components/Loading'
import { col } from '../../../theme'
import NewProjectModal from './NewProjectModal'

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

export default function ProjectSwitcher({
  activeProject,
  projects,
  busy = false,
  onSelect,
  onCreate,
}: Props) {
  const [creating, setCreating] = useState(false)
  const [projectListOpen, setProjectListOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(0)
  const projectPickerRef = useRef<HTMLDivElement | null>(null)
  const projectListboxId = useId()

  const projectCount = projects.length

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

  return (
    <div ref={projectPickerRef} className="project-switcher" aria-busy={busy}>
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
        className="project-select"
        onClick={() => {
          if (!busy && projects.length > 0) setProjectListOpen((open) => !open)
        }}
        onKeyDown={handleProjectPickerKeyDown}
        disabled={busy || projects.length === 0}
      >
        <span className="project-mark project-mark-sm" aria-hidden="true">
          {initialsOf(activeProject?.name ?? '')}
        </span>
        <span className="project-select-trigger truncate">
          {activeProject?.name ?? 'sin proyecto'}
        </span>
        {busy && <LoadingInline label="sincronizando proyecto" />}
        <span className="project-select-caret" aria-hidden="true" />
      </button>

      {projectListOpen && (
        <div className="project-popover">
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

          <div className="project-popover-footer">
            <span className="text-2xs" style={{ color: col.fgDim }}>
              {projectCount} {projectCount === 1 ? 'proyecto' : 'proyectos'}
            </span>
            <button
              type="button"
              className="btn-secondary btn-mini"
              onClick={() => {
                setProjectListOpen(false)
                setCreating(true)
              }}
              disabled={busy}
            >
              <IconPlus size={12} className="button-icon button-icon-plus" />
              Nuevo proyecto
            </button>
          </div>
        </div>
      )}

      <NewProjectModal
        open={creating}
        busy={busy}
        onClose={() => setCreating(false)}
        onCreate={onCreate}
      />
    </div>
  )
}
