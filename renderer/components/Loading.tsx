import { col } from '../theme'

interface LoadingGlyphProps {
  size?: 12 | 16 | 20 | 24
}

export function LoadingGlyph({ size = 16 }: LoadingGlyphProps) {
  return (
    <span
      className="buglens-loader"
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  )
}

export function LoadingInline({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <LoadingGlyph size={12} />
      <span className="truncate">{label}</span>
    </span>
  )
}

export function LoadingPanel({ title, detail }: { title: string; detail?: string }) {
  return (
    <div role="status" aria-live="polite" className="loading-panel animate-fade-in rounded-md p-4">
      <div className="mb-2 flex items-center gap-2">
        <LoadingGlyph size={16} />
        <span className="font-mono font-semibold text-xs" style={{ color: col.cream }}>
          {title}
        </span>
      </div>
      {detail && (
        <p className="font-mono text-xs" style={{ color: col.fgMuted }}>
          {detail}
        </p>
      )}
    </div>
  )
}

export function LoadingOverlay({
  visible,
  title,
  detail,
}: {
  visible: boolean
  title: string
  detail?: string
}) {
  if (!visible) return null

  return (
    <div className="loading-overlay pointer-events-auto absolute inset-0 z-40 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <LoadingPanel title={title} detail={detail} />
      </div>
    </div>
  )
}
