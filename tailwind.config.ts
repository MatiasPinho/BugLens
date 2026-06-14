import type { Config } from 'tailwindcss'

// Las clases utilitarias `om-*` referencian las CSS vars definidas en
// renderer/styles.css :root (origen único de los valores). El patrón
// `rgb(var(--c-x) / <alpha-value>)` mantiene el soporte de modificadores de
// opacidad de Tailwind (ej. `border-om-border/25`).
const tw = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`
const font = ['"Iosevka Nerd Font Mono"', '"Iosevka Nerd Font"', 'monospace']

export default {
  content: ['./renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: { mono: font, sans: font },
      colors: {
        om: {
          base: tw('base'),
          surface: tw('surface'),
          raised: tw('raised'),
          code: tw('code'),
          dim: tw('dim'),
          muted: tw('muted'),
          fg: tw('fg'),
          fgmuted: tw('fg-muted'),
          fgdim: tw('fg-dim'),
          accent: tw('fg-muted'),
          border: tw('border'),
          red: tw('red'),
          cream: tw('cream'),
          warm: tw('warm'),
          amber: tw('amber'),
        },
      },
    },
  },
} satisfies Config
