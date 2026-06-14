// theme.ts
//
// Tokens de color para estilos inline. Los VALORES viven en un solo lugar:
// `renderer/styles.css :root` (como canales RGB `--c-*`). Acá solo se referencian
// con var(), así cambiar un color en :root lo cambia en todos lados (estilos
// inline, clases Tailwind `om-*` y reglas CSS). Origen ÚNICO = styles.css :root.

const v = (name: string) => `rgb(var(--c-${name}))`

export const col = {
  base: v('base'),
  surface: v('surface'),
  raised: v('raised'),
  code: v('code'),
  dim: v('dim'),
  muted: v('muted'),
  border: v('border'),
  fgMuted: v('fg-muted'),
  fgDim: v('fg-dim'),
  fg: v('fg'),
  cream: v('cream'),
  warm: v('warm'),
  red: v('red'),
  amber: v('amber'),
  green: v('green'),
  terracotta: v('terracotta'),
  gray: v('gray'),
  done: v('done'),
  amberDeep: v('amber-deep'),
  amberStrip: v('amber-strip'),
} as const

// Inyecta opacidad en un color del palette:
// alpha(col.border, 0.25) === 'rgb(var(--c-border) / 0.25)'
export function alpha(color: string, a: number): string {
  return color.replace(/\)\s*$/, ` / ${a})`)
}
