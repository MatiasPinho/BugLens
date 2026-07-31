/**
 * Detecta clases de `@layer components` que Tailwind purgó del CSS de producción.
 *
 * Tailwind elimina del build toda clase que no encuentre escrita COMPLETA en
 * `renderer/**`. Una clase armada por interpolación (`menu-panel-${align}`) es
 * invisible para el escaneo y desaparece — sin que fallen el typecheck, el lint
 * ni los tests. Así se perdieron los colores de los badges de estado y, más
 * tarde, el `right: 0` del panel de menú.
 *
 * Correr después de `npm run build`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const STYLES = 'renderer/styles.css'
const BUILD_DIR = 'dist/renderer/assets'

function definedComponentClasses() {
  const css = readFileSync(STYLES, 'utf8')
  const layer = css.slice(css.indexOf('@layer components'))
  return new Set([...layer.matchAll(/^\s*\.([a-z][a-z0-9-]*)/gm)].map((match) => match[1]))
}

function builtCss() {
  const file = readdirSync(BUILD_DIR).find((name) => /^index-.*\.css$/.test(name))
  if (!file) {
    console.error(`No se encontró el CSS compilado en ${BUILD_DIR}. Corré "npm run build".`)
    process.exit(1)
  }
  return readFileSync(join(BUILD_DIR, file), 'utf8')
}

const built = builtCss()
const purged = [...definedComponentClasses()].filter((name) => !built.includes(`.${name}`))

if (purged.length === 0) {
  console.log('Ninguna clase de @layer components se perdió en el build.')
  process.exit(0)
}

console.error(`${purged.length} clase(s) definidas en ${STYLES} NO están en el build:\n`)
for (const name of purged) console.error(`  .${name}`)
console.error(
  '\nO son código muerto y hay que borrarlas, o el código las arma por interpolación',
  '\ny Tailwind no las ve. En ese caso usá un mapa estático con el nombre completo',
  '\n(ver ALIGN_CLASS en MenuButton.tsx) o sumalas al safelist de tailwind.config.ts.',
)
process.exit(1)
