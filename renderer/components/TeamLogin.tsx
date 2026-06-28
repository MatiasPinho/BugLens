import { alpha, col } from '../theme'
import { BugUnderLensMark } from './decor/BugMotifs'
import { IconCheck, IconFolder } from './icons'
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
    <div className="team-login flex h-screen items-center justify-center p-6 font-mono text-om-fg">
      <div className="team-login-shell">
        <div className="team-login-panel">
          <div className="team-login-identity flex flex-col justify-between p-5">
            <div>
              <BugUnderLensMark
                className="motif-sway mb-3"
                style={{ width: 44, height: 44, color: col.cream }}
              />
              <div className="font-semibold text-sm" style={{ color: col.cream }}>
                buglens equipo
              </div>
              <p className="mt-2 max-w-xs text-xs" style={{ color: col.fgMuted }}>
                Intake compartido para reportes de QA, estados y análisis.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs" style={{ color: col.fgMuted }}>
              <IconFolder size={12} />
              <span>{status?.project?.name ?? 'proyecto compartido'}</span>
            </div>
          </div>

          <div className="team-login-card p-4">
            {status?.authenticated ? (
              <div className="space-y-3">
                <div className="section-label mb-2">sesión activa</div>
                <span
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: col.fgDim }}
                >
                  <IconCheck size={12} />
                  {status.user?.email ?? 'usuario conectado'}
                </span>
                {status.project && (
                  <div className="text-xs" style={{ color: col.fgMuted }}>
                    proyecto: {status.project.name}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="section-label mb-2">acceso requerido</div>
                <p className="mb-4 text-xs" style={{ color: col.fgMuted }}>
                  Iniciá sesión para cargar el proyecto remoto.
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
    </div>
  )
}
