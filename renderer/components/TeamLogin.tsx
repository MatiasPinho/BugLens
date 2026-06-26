import { BugUnderLensMark } from './decor/BugMotifs'
import { IconCheck } from './icons'
import { alpha, col } from '../theme'
import { LoadingInline } from './Loading'

export interface TeamAuthStatus {
  configured: boolean
  authenticated: boolean
  user?: { id: string; email?: string }
  project?: { id: string; name: string; slug: string }
  projects?: Array<{ id: string; name: string; slug: string }>
  error?: string
}

interface Props {
  status: TeamAuthStatus | null
  loading: boolean
  onLogin: () => void
}

export default function TeamLogin({ status, loading, onLogin }: Props) {
  const configured = status?.configured ?? true
  return (
    <div className="flex h-screen items-center justify-center bg-om-base p-6 font-mono text-om-fg">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BugUnderLensMark
            className="motif-sway mb-2"
            style={{ width: 42, height: 42, color: col.cream }}
          />
          <div className="font-semibold text-sm" style={{ color: col.cream }}>
            buglens equipo
          </div>
          <p className="mt-1 text-xs" style={{ color: col.fgMuted }}>
            Iniciá sesión para usar el proyecto compartido.
          </p>
        </div>

        <div className="card">
          {status?.authenticated ? (
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: col.fgDim }}>
                <IconCheck size={12} />
                {status.user?.email ?? 'sesión activa'}
              </span>
              {status.project && (
                <div className="text-xs" style={{ color: col.fgMuted }}>
                  proyecto: {status.project.name}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="section-label mb-3">acceso requerido</div>
              <p className="mb-4 text-xs" style={{ color: col.fgMuted }}>
                Los bugs, estados y análisis se guardan en Supabase. El modo local queda fuera del
                flujo principal del MVP.
              </p>

              <button
                type="button"
                className="btn-primary w-full"
                onClick={onLogin}
                disabled={loading || !configured}
              >
                {loading ? <LoadingInline label="esperando login" /> : 'continuar con google'}
              </button>

              {!configured && (
                <p className="mt-2 text-xs" style={{ color: col.border }}>
                  Configurá Supabase en `.env` y reiniciá la app.
                </p>
              )}
            </>
          )}

          {status?.error && (
            <div
              className="mt-3 rounded p-2 text-xs"
              style={{
                color: col.red,
                border: `1px solid ${alpha(col.red, 0.24)}`,
                background: alpha(col.red, 0.06),
              }}
            >
              {status.error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
