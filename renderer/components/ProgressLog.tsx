import { useEffect, useRef } from 'react'
import type { LogLine } from '../App'
import { col } from '../theme'

interface Props {
  logs: LogLine[]
}

export default function ProgressLog({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const errorCount = logs.filter((line) => line.level === 'error').length

  // Seguir la cola del log a medida que llegan líneas nuevas.
  useEffect(() => {
    if (logs.length === 0) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div className="panel-card flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className="flex flex-shrink-0 items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: `1px solid ${col.borderFaint}` }}
      >
        <span className="kicker">Log</span>
        {logs.length > 0 && <span className="count-chip">{logs.length}</span>}
        {errorCount > 0 && (
          <span className="ml-auto font-semibold text-2xs" style={{ color: col.critical }}>
            {errorCount} error{errorCount > 1 ? 'es' : ''}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-3">
        {logs.length === 0 ? (
          <p className="m-auto text-sm" style={{ color: col.fgDim }}>
            Esperando actividad…
          </p>
        ) : (
          logs.map((line) => (
            <div key={line.id} className="log-line">
              <span className="log-time">
                {new Date(line.timestamp).toLocaleTimeString('es', { hour12: false })}
              </span>
              <span className={`log-${line.level} break-words`}>{line.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
