import { BugLensMark } from '../../../components/decor/BugMotifs'
import { IconCheck, IconFolder } from '../../../components/icons'
import { LoadingInline } from '../../../components/Loading'
import { col } from '../../../theme'

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
    <div className="team-login window-drag-surface flex h-screen items-center justify-center p-10">
      <div className="team-login-shell">
        <div className="team-login-panel">
          <div className="team-login-identity">
            <div className="grid gap-3.5">
              <span className="app-brand-mark" style={{ width: '2.75rem', height: '2.75rem' }}>
                <BugLensMark compact style={{ width: 24 }} />
              </span>
              <div className="grid gap-1.5">
                <span className="font-bold text-3xl" style={{ letterSpacing: '-0.02em' }}>
                  BugLens para tu equipo
                </span>
                <p
                  className="max-w-[38ch] text-md"
                  style={{ color: col.fgMuted, textWrap: 'pretty' }}
                >
                  Intake compartido de reportes de QA: clasificación, reescritura, estados y notas —
                  todo sincronizado.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: col.fgMuted }}>
              <IconFolder size={14} />
              <span>{status?.project?.name ?? 'Proyecto compartido'}</span>
            </div>
          </div>

          <div className="team-login-card grid content-start gap-3.5">
            {status?.authenticated ? (
              <>
                <span className="kicker">Sesión activa</span>
                <span
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: col.solved }}
                >
                  <IconCheck size={14} />
                  {status.user?.email ?? 'usuario conectado'}
                </span>
                {status.project && (
                  <span className="text-sm" style={{ color: col.fgMuted }}>
                    Proyecto: {status.project.name}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="kicker">Acceso requerido</span>
                <p className="text-sm" style={{ color: col.fgMuted, lineHeight: 1.6 }}>
                  Iniciá sesión para cargar el proyecto remoto y sus bugs.
                </p>

                <button
                  type="button"
                  className="btn-primary btn-lg w-full"
                  onClick={onLogin}
                  disabled={loading || !configured}
                >
                  {loading ? <LoadingInline label="esperando login" /> : 'Continuar con Google'}
                </button>

                <p className="text-2xs" style={{ color: col.fgDim, lineHeight: 1.5 }}>
                  {configured
                    ? 'Se usa Supabase Auth con la publishable key. Nunca se guardan claves de servicio.'
                    : 'Configurá Supabase en `.env` y reiniciá la app.'}
                </p>
              </>
            )}

            {status?.error && (
              <div
                className="rounded-md p-2.5 text-xs"
                style={{
                  color: col.critical,
                  border: `1px solid ${col.criticalLine}`,
                  background: col.criticalBg,
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
