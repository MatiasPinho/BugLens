// ProjectsScreen.tsx
//
// Lista los proyectos del equipo y permite cambiar el activo o crear uno nuevo.
// Un usuario puede tener varios proyectos; el activo es el que usan todos los IPC
// de bugs.

import { initialsOf } from '../../../components/avatarTone'
import { IconCheck, IconPlus } from '../../../components/icons'
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

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
      >
        {projects.map((project) => {
          const isActive = project.id === activeProjectId
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              disabled={busy || isActive}
              aria-current={isActive}
              className={`choice-card ${isActive ? 'choice-card-selected' : ''} flex-col gap-2`}
              style={isActive ? { cursor: 'default' } : undefined}
            >
              <div className="flex items-center gap-2.5">
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
              {isActive && activeProjectBugCount !== undefined && (
                <span className="text-xs" style={{ color: col.fgMuted }}>
                  {activeProjectBugCount} bug{activeProjectBugCount === 1 ? '' : 's'} cargados
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
