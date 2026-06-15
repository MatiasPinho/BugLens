import { useEffect, useRef } from 'react'
import type { LogLine } from '../App'
import { alpha, col } from '../theme'

interface Props {
  logs: LogLine[]
}

const levelColor: Record<LogLine['level'], string> = {
  info: col.muted,
  warn: col.amber,
  error: col.red,
}

const levelTextColor: Record<LogLine['level'], string> = {
  info: col.fgDim,
  warn: col.cream,
  error: col.red,
}

const levelIndicator: Record<LogLine['level'], string> = {
  info: '›',
  warn: '!',
  error: '✕',
}

export default function ProgressLog({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="flex h-full flex-col" style={{ background: col.base }}>
      <div
        className="flex flex-shrink-0 items-center gap-2 px-4 py-2"
        style={{ borderBottom: `1px solid ${alpha(col.border, 0.18)}` }}
      >
        <span className="font-mono text-xs uppercase tracking-wider" style={{ color: col.border }}>
          log
        </span>
        {logs.length > 0 && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{ color: col.muted, background: alpha(col.muted, 0.2) }}
          >
            {logs.length}
          </span>
        )}
        {logs.some((l) => l.level === 'error') && (
          <span className="ml-auto font-mono text-xs" style={{ color: col.red }}>
            {logs.filter((l) => l.level === 'error').length} error
            {logs.filter((l) => l.level === 'error').length > 1 ? 'es' : ''}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto p-3 font-mono text-xs">
        {logs.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-3"
            style={{ color: col.dim }}
          >
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              style={{ opacity: 0.5 }}
            >
              <rect
                x="3"
                y="3"
                width="20"
                height="20"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <line
                x1="7"
                y1="8"
                x2="13"
                y2="8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line
                x1="7"
                y1="12"
                x2="17"
                y2="12"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line
                x1="7"
                y1="16"
                x2="11"
                y2="16"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-mono text-xs" style={{ color: col.dim }}>
              esperando actividad...
            </span>
          </div>
        ) : (
          logs.map((line) => (
            <div
              key={line.id}
              className="flex gap-2 rounded px-1 py-0.5 leading-relaxed"
              style={{
                borderLeft: `2px solid ${levelColor[line.level]}`,
                paddingLeft: '0.5rem',
                background: line.level === 'error' ? alpha(col.red, 0.04) : 'transparent',
              }}
            >
              <span className="w-16 flex-shrink-0 text-right" style={{ color: col.dim }}>
                {new Date(line.timestamp).toLocaleTimeString('es', { hour12: false })}
              </span>
              <span
                className="w-3 flex-shrink-0 text-center font-bold"
                style={{ color: levelColor[line.level] }}
              >
                {levelIndicator[line.level]}
              </span>
              <span className="break-all" style={{ color: levelTextColor[line.level] }}>
                {line.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
