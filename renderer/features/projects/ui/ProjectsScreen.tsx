// ProjectsScreen.tsx
//
// Lista los proyectos del equipo y permite cambiar el activo o crear uno nuevo.
// Un usuario puede tener varios proyectos; el activo es el que usan todos los IPC
// de bugs.

import { initialsOf } from '../../../components/avatarTone'
import EmptyState from '../../../components/EmptyState'
import { IconCheck, IconChevronRight, IconFolder, IconPlus } from '../../../components/icons'
import { col } from '../../../theme'
import type { ProjectOption } from './ProjectSwitcher'

interface Props {
  projects: ProjectOption[]
  activeProjectId?: string
  activeProjectBugCount?: number
  busy?: boolean
  onSelect: (projectId: string) => void
  onCreate: () => void
}

export default function ProjectsScreen({
  projects,
  activeProjectId,
  activeProjectBugCount,
  busy = false,
  onSelect,
  onCreate,
}: Props) {
  return (
    <div className="screen-scroll projects-screen" aria-busy={busy}>
      <div className="page-heading">
        <div className="grid gap-1.5">
          <span className="page-eyebrow">
            <span className="page-eyebrow-dot" aria-hidden="true" />
            Espacios de trabajo
          </span>
          <h2 className="page-title">Proyectos</h2>
          <p className="page-description">
            Cada proyecto es un espacio separado de bugs, estados y notas. El activo es el que ves
            en la pantalla de Bugs.
          </p>
        </div>
        <button type="button" className="btn-primary btn-lg page-action" onClick={onCreate}>
          <IconPlus size={14} className="button-icon button-icon-plus" />
          Nuevo proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="projects-empty card">
          <EmptyState
            title="Todavía no hay proyectos"
            description="Creá el primer espacio para organizar bugs, estados y comentarios del equipo."
            motif={<IconFolder size={28} />}
            action={
              <button type="button" className="btn-primary btn-lg" onClick={onCreate}>
                <IconPlus size={14} />
                Crear proyecto
              </button>
            }
          />
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelect(project.id)}
                disabled={busy || isActive}
                aria-current={isActive}
                aria-label={`${project.name}${isActive ? ', proyecto activo' : ', cambiar a este proyecto'}`}
                className={`project-card ${isActive ? 'project-card-active' : ''}`}
              >
                <div className="project-card-head">
                  <span className="project-mark">{initialsOf(project.name)}</span>
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate font-semibold text-md">{project.name}</span>
                    <span className="mono truncate text-2xs" style={{ color: col.fgDim }}>
                      {project.slug}
                    </span>
                  </div>
                  {isActive && (
                    <span className="badge badge-accent ml-auto">
                      <IconCheck size={11} />
                      Activo
                    </span>
                  )}
                </div>
                <span className="project-card-divider" aria-hidden="true" />
                <span className="project-card-footer">
                  <span>
                    {isActive && activeProjectBugCount !== undefined
                      ? `${activeProjectBugCount} bug${activeProjectBugCount === 1 ? '' : 's'} cargados`
                      : isActive
                        ? 'Proyecto activo'
                        : 'Cambiar a este proyecto'}
                  </span>
                  {!isActive && <IconChevronRight size={12} />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
