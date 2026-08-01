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
import MenuButton, { MenuItem } from './MenuButton'

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
  /** Acciones que cierran la columna central, antes del rail de propiedades. */
  actions?: React.ReactNode
  /** Acciones que viven sobre el rail de propiedades, antes de la cuenta. */
  asideActions?: React.ReactNode
  /** Miembros del proyecto activo, para los avatares del equipo. */
  members?: TeamMember[]
  user?: TopbarUser
  onSignOut?: () => void
}

export default function AppTopbar({
  breadcrumb,
  projectSlot,
  statusSlot,
  actions,
  asideActions,
  members = [],
  user,
  onSignOut,
}: Props) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-main">
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
        </div>
      </div>

      <div className="app-topbar-aside">
        {asideActions}

        {/* Identidad y equipo detrás del avatar: en el topbar competían con las
            acciones de trabajo y ocupaban un cuarto del ancho. */}
        {user && (
          <MenuButton
            label="cuenta y equipo"
            triggerClassName="app-topbar-avatar"
            trigger={
              <span
                className={`avatar avatar-md ${avatarToneClass(user.id ?? user.email)}`}
                aria-hidden="true"
              >
                {initialsOf(user.email ?? '')}
              </span>
            }
          >
            {(close) => (
              <>
                <div className="menu-meta">
                  <span className="menu-meta-name">{user.email ?? 'sesión activa'}</span>
                  <span className="text-2xs" style={{ color: col.fgDim }}>
                    {user.provider ?? 'Google Auth'}
                  </span>
                </div>

                {members.length > 0 && (
                  <div className="menu-meta">
                    <span className="kicker-xs">Equipo</span>
                    <ul className="menu-member-list">
                      {members.map((member) => (
                        <li key={member.id} className="menu-member">
                          <span
                            className={`avatar avatar-sm ${avatarToneClass(member.id)}`}
                            aria-hidden="true"
                          >
                            {initialsOf(member.displayName ?? member.email ?? '')}
                          </span>
                          <span className="truncate">{member.displayName ?? member.email}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {onSignOut && (
                  <MenuItem
                    onClick={() => {
                      close()
                      onSignOut()
                    }}
                  >
                    <IconLogout size={14} />
                    Cerrar sesión
                  </MenuItem>
                )}
              </>
            )}
          </MenuButton>
        )}
      </div>
    </header>
  )
}
