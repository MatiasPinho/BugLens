import type { Meta, StoryObj } from '@storybook/react-vite'
import { alpha, col } from '../../theme'
import { BeetleMark, BugUnderLensMark } from './BugMotifs'

// Galería de motivos decorativos (bichos / bugs) para complementar la UI.
// Line-art mono a un trazo (currentColor). Heredan color del contenedor; acá se
// muestran sobre el fondo base de la app.
const meta: Meta = {
  title: 'buglens/decor/BugMotifs',
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded p-6"
      style={{ background: col.surface, border: `1px solid ${alpha(col.border, 0.25)}` }}
    >
      <div className="font-mono text-xs uppercase tracking-wider" style={{ color: col.muted }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export const Galeria: Story = {
  render: () => (
    <div
      className="grid min-h-screen grid-cols-2 gap-5 p-8 md:grid-cols-3"
      style={{ background: col.base }}
    >
      <Frame label="escarabajo · cream">
        <BeetleMark style={{ width: 120, color: col.cream }} />
      </Frame>
      <Frame label="escarabajo · fgDim">
        <BeetleMark style={{ width: 120, color: col.fgDim }} />
      </Frame>
      <Frame label="escarabajo · watermark">
        <BeetleMark style={{ width: 120, color: col.fgDim, opacity: 0.18 }} />
      </Frame>
      <Frame label="lupa + bicho · cream">
        <BugUnderLensMark style={{ width: 120, color: col.cream }} />
      </Frame>
      <Frame label="lupa + bicho · warm">
        <BugUnderLensMark style={{ width: 120, color: col.warm }} />
      </Frame>
    </div>
  ),
}

// Cómo se ve de fondo/marca de agua (como en el EmptyState).
export const ComoWatermark: Story = {
  render: () => (
    <div
      className="relative flex h-screen items-center justify-center overflow-hidden"
      style={{ background: col.base }}
    >
      <BeetleMark
        className="pointer-events-none absolute"
        style={{ right: -28, bottom: -24, width: 210, color: col.fgDim, opacity: 0.13 }}
      />
      <span className="relative font-mono text-sm" style={{ color: col.cream }}>
        contenido encima · el escarabajo asoma en la esquina
      </span>
    </div>
  ),
}
