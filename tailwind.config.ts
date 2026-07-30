import type { Config } from 'tailwindcss'

// Las clases utilitarias `bl-*` referencian las CSS vars definidas en
// renderer/styles.css :root (origen único de los valores). El patrón
// `rgb(var(--c-x) / <alpha-value>)` mantiene el soporte de modificadores de
// opacidad de Tailwind (ej. `border-bl-border/60`).
const tw = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`

const sans = ['"Public Sans"', '-apple-system', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif']
const mono = ['"Iosevka Nerd Font Mono"', 'ui-monospace', 'monospace']

// Clases de `@layer components` (styles.css) que el código arma por
// interpolación: `log-${level}`, `avatar-tone-${n}`, etc. Tailwind purga lo que
// no encuentra escrito literal, así que una clase interpolada desaparece del CSS
// de producción — el bug que dejaba a los badges de estado y severidad sin color.
// Si agregás una familia dinámica nueva, sumala acá.
//
// Preferí siempre el nombre completo y literal en el código (ver
// SEVERITY_BADGE_CLASS en bugPresentation.ts); este safelist es la red para los
// casos donde la interpolación es realmente más clara.
const dynamicComponentClasses = [
  'rewrite-panel-actual',
  'rewrite-panel-expected',
  'row-strip-critical',
  'row-strip-high',
  'row-strip-medium',
  'row-strip-low',
  'row-strip-critical-focused',
  'row-strip-high-focused',
  'row-strip-medium-focused',
  'row-strip-low-focused',
  'log-info',
  'log-warn',
  'log-error',
  'cloud-agent-coverage-covered',
  'cloud-agent-coverage-partial',
  'cloud-agent-coverage-failed',
  'cloud-agent-coverage-unknown',
  'agent-running-task-active',
  'agent-running-task-done',
  'avatar-tone-1',
  'avatar-tone-2',
  'avatar-tone-3',
  'avatar-tone-4',
  'avatar-tone-5',
  'avatar-tone-6',
]

export default {
  content: ['./renderer/**/*.{ts,tsx,html}'],
  safelist: dynamicComponentClasses,
  theme: {
    extend: {
      fontFamily: { sans, mono },
      // Escala tipográfica completa (origen único en styles.css :root). Tailwind
      // ya trae xs/sm/base…, así que las redefinimos para que las clases usen
      // los mismos valores que los tokens.
      fontSize: {
        '3xs': ['var(--text-3xs)', { lineHeight: '0.875rem' }],
        '2xs': ['var(--text-2xs)', { lineHeight: '1rem' }],
        xs: ['var(--text-xs)', { lineHeight: '1.125rem' }],
        sm: ['var(--text-sm)', { lineHeight: '1.25rem' }],
        md: ['var(--text-md)', { lineHeight: '1.375rem' }],
        lg: ['var(--text-lg)', { lineHeight: '1.5rem' }],
        xl: ['var(--text-xl)', { lineHeight: '1.5rem' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '1.625rem' }],
        '3xl': ['var(--text-3xl)', { lineHeight: '1.75rem' }],
        '4xl': ['var(--text-4xl)', { lineHeight: '1.875rem' }],
        '5xl': ['var(--text-5xl)', { lineHeight: '2rem' }],
      },
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        modal: 'var(--shadow-modal)',
        float: 'var(--shadow-float)',
      },
      colors: {
        bl: {
          canvas: tw('canvas'),
          surface: tw('surface'),
          subtle: tw('subtle'),
          sunken: tw('sunken'),
          accent: tw('accent'),
          accentsoft: tw('accent-soft'),
          fg: tw('fg'),
          fgstrong: tw('fg-strong'),
          fgbody: tw('fg-body'),
          fgmuted: tw('fg-muted'),
          fgdim: tw('fg-dim'),
          border: tw('border'),
          bordercard: tw('border-card'),
          bordersoft: tw('border-soft'),
          critical: tw('critical'),
          warn: tw('warn'),
          solved: tw('solved'),
          code: tw('code'),
          codebg: tw('code-bg'),
        },
      },
      width: {
        rail: 'var(--rail-w)',
        issuelist: 'var(--issue-list-w)',
        properties: 'var(--properties-w)',
      },
    },
  },
} satisfies Config
