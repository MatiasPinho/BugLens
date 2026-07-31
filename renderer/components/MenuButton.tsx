/**
 * MenuButton.tsx
 *
 * Botón que despliega un menú. Sirve para sacar del primer plano lo que no
 * compite por atención: acciones destructivas, datos de sesión.
 *
 * Sigue el patrón ARIA de menú: `aria-haspopup`, `aria-expanded`, cierre con
 * Esc o click afuera, y el foco vuelve al disparador al cerrar.
 */

import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

/**
 * Nombres COMPLETOS y literales: Tailwind purga del build toda clase de
 * `@layer components` que no encuentre escrita entera, y una clase armada por
 * interpolación es invisible para el escaneo. Con `menu-panel-${align}` el panel
 * salía sin `right: 0` y se iba fuera de la ventana.
 */
const ALIGN_CLASS = {
  start: 'menu-panel-start',
  end: 'menu-panel-end',
} as const

interface Props {
  /** Contenido del disparador (un icono, un avatar). */
  trigger: ReactNode
  /** Nombre accesible del disparador: no tiene texto visible. */
  label: string
  /** Alineación del panel respecto del disparador. */
  align?: keyof typeof ALIGN_CLASS
  triggerClassName?: string
  children: (close: () => void) => ReactNode
}

export default function MenuButton({
  trigger,
  label,
  align = 'end',
  triggerClassName = 'btn-icon',
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()

  const close = () => {
    setOpen(false)
    // Sin esto el foco se pierde al final del documento cuando el menú se va.
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="menu-button">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>

      {open && (
        <div id={menuId} role="menu" className={`menu-panel ${ALIGN_CLASS[align]}`}>
          {children(close)}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item ${danger ? 'menu-item-danger' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
