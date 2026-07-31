// theme.ts
//
// Tokens de color para estilos inline. Los VALORES viven en un solo lugar:
// `renderer/styles.css :root` (como canales RGB `--c-*`). Acá solo se referencian
// con var(), así cambiar un color en :root lo cambia en todos lados (estilos
// inline, clases Tailwind `bl-*` y reglas CSS). Origen ÚNICO = styles.css :root.

const v = (name: string) => `rgb(var(--c-${name}))`

export const col = {
  // ── Superficies ──────────────────────────────────────────────────────────
  canvas: v('canvas'),
  chrome: v('chrome'),
  surface: v('surface'),
  subtle: v('subtle'),
  sunken: v('sunken'),
  selected: v('selected'),
  chip: v('chip'),

  // ── Acento (azul) ────────────────────────────────────────────────────────
  accent: v('accent'),
  accentHover: v('accent-hover'),
  accentBright: v('accent-bright'),
  accentPale: v('accent-pale'),
  accentSoft: v('accent-soft'),
  accentLine: v('accent-line'),

  // ── Texto (de más fuerte a más tenue) ────────────────────────────────────
  fg: v('fg'),
  fgStrong: v('fg-strong'),
  fgBody: v('fg-body'),
  fgMuted: v('fg-muted'),
  fgDim: v('fg-dim'),
  fgFaint: v('fg-faint'),
  fgDisabled: v('fg-disabled'),

  // ── Bordes (de más marcado a más tenue) ──────────────────────────────────
  borderStrong: v('border-strong'),
  border: v('border'),
  borderCard: v('border-card'),
  borderSoft: v('border-soft'),
  borderFaint: v('border-faint'),

  // ── Neutro (severidad baja, estado cerrado, categorías) ──────────────────
  neutralBg: v('neutral-bg'),
  neutralLine: v('neutral-line'),

  // ── Severidad ────────────────────────────────────────────────────────────
  critical: v('critical'),
  criticalBg: v('critical-bg'),
  criticalLine: v('critical-line'),
  criticalTint: v('critical-tint'),
  criticalSolid: v('critical-solid'),
  high: v('high'),
  highBg: v('high-bg'),
  highLine: v('high-line'),
  medium: v('medium'),
  mediumBg: v('medium-bg'),
  mediumLine: v('medium-line'),

  // ── Datos que faltan / advertencia ───────────────────────────────────────
  warn: v('warn'),
  warnBg: v('warn-bg'),
  warnLine: v('warn-line'),
  warnSolid: v('warn-solid'),

  // ── Estados del workflow ─────────────────────────────────────────────────
  statusNew: v('status-new'),
  statusNewBg: v('status-new-bg'),
  statusNewLine: v('status-new-line'),
  progress: v('progress'),
  progressBg: v('progress-bg'),
  progressLine: v('progress-line'),
  solved: v('solved'),
  solvedBg: v('solved-bg'),
  solvedLine: v('solved-line'),
  solvedTint: v('solved-tint'),
  solvedSolid: v('solved-solid'),
  notRepro: v('not-repro'),
  notReproBg: v('not-repro-bg'),
  notReproLine: v('not-repro-line'),

  // ── Código inline (endpoints, errores, rutas dentro del reporte) ─────────
  code: v('code'),
  codeBg: v('code-bg'),
  codeLine: v('code-line'),

  // ── Voto de comentarios ──────────────────────────────────────────────────
  voteUp: v('vote-up'),
  voteDown: v('vote-down'),
} as const

// Tonos de avatar. No se eligen a mano: `avatarToneOf` los asigna por hash del id
// del perfil para que una persona conserve su color en toda la app.
export const AVATAR_TONE_COUNT = 6

// Inyecta opacidad en un color del palette:
// alpha(col.border, 0.25) === 'rgb(var(--c-border) / 0.25)'
export function alpha(color: string, a: number): string {
  return color.replace(/\)\s*$/, ` / ${a})`)
}

// Tokens de tamaño para estilos inline (mismo origen único que `col`: las CSS
// vars de styles.css :root). Preferir clases (text-2xs, rounded-md, .btn-mini,
// .input); usar `sz`/`radius` solo donde haga falta tamaño en `style`.
export const sz = {
  text3xs: 'var(--text-3xs)',
  text2xs: 'var(--text-2xs)',
  textXs: 'var(--text-xs)',
  textSm: 'var(--text-sm)',
  textMd: 'var(--text-md)',
  textLg: 'var(--text-lg)',
  textXl: 'var(--text-xl)',
  text2xl: 'var(--text-2xl)',
  text3xl: 'var(--text-3xl)',
  text4xl: 'var(--text-4xl)',
  text5xl: 'var(--text-5xl)',
  text6xl: 'var(--text-6xl)',
  ctlXs: 'var(--ctl-h-xs)',
  ctlSm: 'var(--ctl-h-sm)',
  ctlMd: 'var(--ctl-h-md)',
  ctlLg: 'var(--ctl-h-lg)',
} as const

export const radius = {
  xs: 'var(--radius-xs)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  xxl: 'var(--radius-2xl)',
  xxxl: 'var(--radius-3xl)',
  pill: 'var(--radius-pill)',
} as const

export const shadow = {
  card: 'var(--shadow-card)',
  pop: 'var(--shadow-pop)',
  modal: 'var(--shadow-modal)',
  accent: 'var(--shadow-accent)',
  float: 'var(--shadow-float)',
} as const
