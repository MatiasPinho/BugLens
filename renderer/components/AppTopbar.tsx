/**
 * AppTopbar.tsx
 *
 * Barra superior del shell. Al comprimirse la navegación a un rail de iconos,
 * el topbar pasa a ser el lugar del contexto global: dónde estoy (breadcrumb),
 * sobre qué proyecto, con qué motor y con qué identidad.
 *
 * Los datos no se arman acá: la pantalla pasa los slots ya resueltos.
 */

import type React from 'react'
import type { TeamMember } from '../../src/shared/contracts'
import { col } from '../theme'
import { avatarToneClass, initialsOf } from './avatarTone'
import { IconChevronRight, IconLogout } from './icons'

export interface TopbarUser {
  id?: string
  email?: string
  provider?: string
}

interface Props {
  /** Migas de pan, de la más general a la más específica. La última es la actual. */
  breadcrumb: string[]
  /** Selector de proyecto, a la izquierda de las migas. */
  projectSlot?: React.ReactNode
  /** Estado del motor de análisis u otros indicadores globales. */
  statusSlot?: React.ReactNode
  actions?: React.ReactNode
  /** Miembros del proyecto activo, para los avatares del equipo. */
  members?: TeamMember[]
  user?: TopbarUser
  onSignOut?: () => void
}

/** Más allá de esto la fila no entra en el topbar y se resume con un contador. */
const MAX_VISIBLE_MEMBERS = 4

export default function AppTopbar({
  breadcrumb,
  projectSlot,
  statusSlot,
  actions,
  members = [],
  user,
  onSignOut,
}: Props) {
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS)
  const hiddenCount = members.length - visibleMembers.length
  return (
    <header className="app-topbar">
      {projectSlot}

      <nav className="app-breadcrumb" aria-label="ubicación">
        <ol className="app-breadcrumb-list">
          {breadcrumb.map((crumb, index) => {
            const isCurrent = index === breadcrumb.length - 1
            return (
              <li key={crumb} className="app-breadcrumb-item">
                {index > 0 && (
                  <IconChevronRight size={12} className="app-breadcrumb-sep" aria-hidden="true" />
                )}
                <span
                  className={isCurrent ? 'app-breadcrumb-current' : 'app-breadcrumb-crumb'}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {crumb}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="app-topbar-end">
        {statusSlot}
        {actions}

        {members.length > 0 && (
          <div className="app-topbar-team">
            <span className="app-topbar-team-label">Equipo</span>
            <span
              className="avatar-row"
              // Los avatares son decorativos; la lista real de nombres va en el
              // título para no obligar a pasar por cada uno.
              title={members.map((member) => member.displayName ?? member.email).join(', ')}
            >
              {visibleMembers.map((member) => (
                <span
                  key={member.id}
                  className={`avatar avatar-sm ${avatarToneClass(member.id)}`}
                  aria-hidden="true"
                >
                  {initialsOf(member.displayName ?? member.email ?? '')}
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="avatar avatar-sm avatar-muted" aria-hidden="true">
                  +{hiddenCount}
                </span>
              )}
            </span>
            <span className="sr-only">
              {members.length} {members.length === 1 ? 'miembro' : 'miembros'} en el proyecto
            </span>
          </div>
        )}

        {user && (
          <div className="app-topbar-user">
            <span
              className={`avatar avatar-md ${avatarToneClass(user.id ?? user.email)}`}
              aria-hidden="true"
            >
              {initialsOf(user.email ?? '')}
            </span>
            <span className="app-topbar-user-copy">
              <span className="app-topbar-user-name">{user.email ?? 'sesión activa'}</span>
              <span className="text-2xs" style={{ color: col.fgDim }}>
                {user.provider ?? 'Google Auth'}
              </span>
            </span>
          </div>
        )}

        {onSignOut && (
          <button
            type="button"
            className="btn-icon"
            onClick={onSignOut}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <IconLogout size={16} />
          </button>
        )}
      </div>
    </header>
  )
}
