import { alpha, col } from '../theme'
/**
 * EmptyState.tsx
 *
 * Pantalla inicial cuando no hay análisis aún. Guía al usuario por los pasos:
 *  - sin nada cargado → "cargá un Excel o un bug a mano para empezar"
 *  - Excel cargado pero idle → "tocá 'analizar bugs'"
 *
 * Reemplaza al ProgressLog vacío que no daba contexto. La entrada se revela de
 * forma escalonada (clase `.reveal-up` + delay), respetando prefers-reduced-motion.
 */

import React from 'react'

interface Props {
  hasExcel: boolean
}

export default function EmptyState({ hasExcel }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Logo / icon principal, con un glow radial sutil para dar profundidad */}
        <div className="reveal-up flex justify-center">
          <div className="relative inline-flex items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute inset-0 -m-6"
              style={{
                background: `radial-gradient(circle, ${alpha(col.cream, 0.1)}, transparent 70%)`,
              }}
            />
            <div
              className="relative inline-flex h-16 w-16 items-center justify-center rounded-lg"
              style={{
                background: alpha(col.cream, 0.06),
                border: `1px solid ${alpha(col.cream, 0.18)}`,
              }}
            >
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                style={{ color: col.cream }}
              >
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="11" cy="11" r="2" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>

        <div className="reveal-up" style={{ animationDelay: '60ms' }}>
          <div
            className="mb-1 font-mono text-sm uppercase tracking-wider"
            style={{ color: col.cream }}
          >
            buglens
          </div>
          <p className="font-mono text-xs leading-relaxed" style={{ color: col.fgMuted }}>
            ordena y reescribe en texto claro los bugs reportados por QA
          </p>
        </div>

        {/* Pasos visuales del flujo */}
        <div className="reveal-up space-y-2 text-left" style={{ animationDelay: '120ms' }}>
          <Step
            number={1}
            label="cargar un Excel — o un bug a mano"
            done={hasExcel}
            active={!hasExcel}
            arrow="↖ panel izquierdo"
          />
          <Step
            number={2}
            label="clasificar y reescribir automáticamente"
            done={false}
            active={hasExcel}
            arrow={hasExcel ? '↖ analizar bugs' : undefined}
          />
          <Step
            number={3}
            label="abrir cada bug para ver la versión clara"
            done={false}
            active={false}
            arrow={undefined}
          />
        </div>

        {/* Atajos de teclado */}
        <div
          className="reveal-up pt-4"
          style={{ borderTop: `1px solid ${alpha(col.border, 0.18)}`, animationDelay: '200ms' }}
        >
          <div
            className="mb-2 font-mono text-xs uppercase tracking-wider"
            style={{ color: col.border }}
          >
            atajos
          </div>
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs"
            style={{ color: col.muted }}
          >
            <Shortcut keys={['j', 'k']} label="navegar bugs" />
            <Shortcut keys={['/']} label="buscar" />
            <Shortcut keys={['enter']} label="expandir bug" />
            <Shortcut keys={['1-5']} label="marcar estado" />
            <Shortcut keys={['esc']} label="cerrar" />
            <Shortcut keys={['?']} label="ayuda" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({
  number,
  label,
  done,
  active,
  arrow,
}: {
  number: number
  label: string
  done: boolean
  active: boolean
  arrow?: string
}) {
  const textColor = done ? col.fgDim : active ? col.fg : col.muted
  const dotColor = done ? col.fgDim : active ? col.cream : col.dim

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs"
        style={{
          background: done ? alpha(col.fgDim, 0.1) : active ? alpha(col.cream, 0.1) : 'transparent',
          border: `1px solid ${dotColor}`,
          color: dotColor,
        }}
      >
        {done ? (
          <svg aria-hidden="true" width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          number
        )}
      </div>
      <span className="flex-1 font-mono text-xs" style={{ color: textColor }}>
        {label}
      </span>
      {arrow && active && (
        <span className="font-mono text-xs" style={{ color: col.amber }}>
          {arrow}
        </span>
      )}
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            <kbd
              className="rounded px-1.5 py-0.5 font-mono text-xs"
              style={{
                background: alpha(col.muted, 0.3),
                border: `1px solid ${alpha(col.border, 0.3)}`,
                color: col.fgMuted,
                minWidth: '1.4em',
                textAlign: 'center',
              }}
            >
              {k}
            </kbd>
            {i < keys.length - 1 && <span style={{ color: col.dim }}>/</span>}
          </React.Fragment>
        ))}
      </div>
      <span style={{ color: col.border }}>{label}</span>
    </div>
  )
}
