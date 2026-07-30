# AGENTS.md

Guía para trabajar **en** este codebase. Para uso/instalación, ver `README.md`.

## Propósito (no perderlo de vista)

buglens **ordena y reescribe** reportes de bugs de QA (desde un Excel): clasifica,
reescribe el reporte en texto claro y estructurado, y lleva un **estado** por bug.
**NO analiza código fuente.**

> Hubo una etapa "forense" (agente que navegaba el repo, índice de embeddings con
> onnxruntime, detección de "ya resuelto") que se **removió a propósito** por frágil y
> fuera de propósito. No reintroducir esas features salvo pedido explícito.

## Comandos

- `npm run dev` — Electron + Vite. Hot reload del **renderer**; el **main NO recarga** →
  reiniciar para cambios en `electron/` o `src/`.
- `npm run lint` — Biome check
- `npm run lint:fix` — Biome check con autofix (`--write`)
- `npm test` · `npm run test:watch` — Vitest
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — renderer (vite) + main (tsc)
- `npm run storybook` · `npm run build-storybook` — taller / documentación de componentes (UI)

## Flujo / arquitectura

```
Excel  ─┐
        ├→ analyze-bugs (evidencia + LLM) → bug-workflow (activos/históricos) → export-bugs
manual ─┘                                      │
                                               └→ projects (Supabase)
```

Dos entradas, mismo pipeline: el Excel (`analyze:run`) y la carga manual
(`analyze:manual-bug`, que appendea sin reemplazar). Los bugs analizados, estados,
imports y corridas se persisten en Supabase; al reabrir se restaura desde el proyecto remoto.

La estructura del proyecto sigue **Screaming Architecture**: la raíz debe gritar el producto
de BugLens (analizar reportes QA, gestionar bugs/proyectos, exportar y configurar), no las
capas técnicas. No volver a organizar el código por carpetas raíz como `pipeline`, `llm`,
`supabase`, `renderer` o `agents` para lógica de negocio.

- `src/features/analyze-bugs/` — Excel/manual input, enriquecimiento con Google Docs,
  análisis LLM, caché, runtime config y progreso de batch.
- `src/features/bug-workflow/` — identidad por contenido, estados, comentarios,
  activos/históricos y soft-delete.
- `src/features/projects/` — proyectos, team auth, imports, restore remoto y realtime.
- `src/features/export-bugs/` — export Excel/JSON.
- `src/features/settings/` — settings, onboarding, reset, Ollama/hardware probe y
  configuración LLM.
- `src/features/external-agent/` — comando externo/OpenCode por bug. Mantenerlo claramente
  secundario: BugLens no analiza código fuente por sí mismo.
- `src/shared/` — contratos compartidos, canales IPC, helpers puros transversales y UI
  realmente genérica.
- `src/platform/` — adaptadores técnicos: filesystem, Ollama, Supabase client y otros
  detalles de infraestructura.
- `electron/main.ts`, `electron/preload.ts` y `renderer/main.tsx` son entrypoints del
  framework. Deben delegar en módulos de `features/`, `shared/` o `platform/`; no concentrar
  ahí reglas de negocio nuevas.
- `renderer/features/*/ui` contiene UI de negocio por feature. `renderer/components/` queda
  para piezas genéricas: rail y topbar del shell, modales, loading, iconos, empty states,
  bloque plegable, decor y controles comunes.
- Dentro de `renderer/features/bug-workflow/ui/` la separación es: `bugPresentation.ts`
  (lógica pura: labels, filtros, agrupación, KPIs), `bugActivity.ts` (lógica pura: árbol de
  hilos, redacción de la actividad, vencimiento), `BugAtoms.tsx` (badges, pestañas, status
  select, acciones), `BugsScreen.tsx` (contenedor de las tres columnas), `BugList`,
  `BugDetail` (reporte del bug), `BugComments` (hilo y voto), `BugPropertiesRail`
  (propiedades y actividad), `BugKpiGrid`, `BugRewrittenReport` (bloque compartido del
  reporte reescrito) y `agentReport.tsx` (parseo + render de la salida del agente externo).
  La lógica pura no importa React.

## Convenciones y constraints

- **LLM de producto: Ollama local**. La UI expone solo dos modos: `qwen2.5:7b`
  para texto y `qwen2.5vl:7b` para texto + capturas. Puede quedar soporte legacy
  interno de otros providers, pero no exponerlo ni documentarlo como feature probada.
  El parseo del LLM debe ser **robusto** (`parseAnalysis` tolera ` ```fences``` ` y
  campos faltantes) — nunca asumir JSON perfecto del modelo.
- **El análisis SIEMPRE produce salida útil** — nunca "información insuficiente" ni rechazo:
  reescribe lo que haya y lo que falta va en `missingInformation`. El parser cae a defaults
  seguros ante campos faltantes/inválidos. (No existe la categoría `insufficient_info`.)
- **Rendimiento GPU/CPU** (`runtimeConfig`): `performanceMode` (`'gpu'`/`'cpu'`) define
  paralelismo + timeout de Ollama. Precedencia de cada valor: **env var
  (`LLM_CONCURRENCY`/`OLLAMA_TIMEOUT_MS`/`LLM_PERFORMANCE_MODE`) > modo > default del
  proveedor**. El modo lo elige el usuario (wizard de primer arranque / config), ayudado por
  `hardware:probe` (sondea Ollama: `size_vram` de `/api/ps` → GPU vs CPU). El sondeo y el IPC
  son **integración** (no se testean por unit; la lógica de precedencia sí).
- **Primer arranque**: `AppSettings.onboarded` (en `settings.json`) gatea el wizard
  (`Onboarding`); arranca en `false` y pasa a `true` al completarlo. Todo lo del wizard queda
  editable después en `Settings`.
- **Caché por contenido** (`analysisCache`): al cambiar un prompt, **bumpear `PROMPT_VERSION`**
  para invalidar la caché vieja.
- **Persistencia compartida**: Supabase es la fuente de verdad para bugs, estados, imports
  y análisis. La identidad sigue siendo por **contenido** (`bugRecordKey` = hash de
  título+descripción), no por posición de fila. Al reabrir, `App` carga con
  `bugs:load-remote`; realtime (`bugs:watch-remote`) dispara refresh del listado.
- **Personas y colaboración** (migraciones `0010`-`0012`): un bug tiene **varios responsables**
  (`bug_assignees`, no la columna `bugs.assigned_to` del esquema original), una **fecha límite**
  (`bugs.due_date`, de tipo `date` — es un día, no un instante: construirla en horario local o
  se corre un día), **comentarios con hilo** (`bug_comments.parent_id`) y **voto** por persona
  (`bug_comment_votes`, un voto por usuario y comentario, valor `-1`/`1`).
  `list_project_bugs` devuelve todo eso más el feed de `bug_events` (últimos 50) ya con el
  perfil del actor resuelto. Los comentarios llegan **planos con `parentId`**: el árbol lo arma
  `buildCommentThread` en `bugActivity.ts`, que tolera padres ausentes y ciclos.
  `list_project_members` alimenta el selector de responsables y los avatares del equipo.
- **Toda escritura de colaboración va por RPC**, nunca por insert directo: el servidor valida
  permisos por rol, que el responsable sea miembro del proyecto y que el comentario padre
  pertenezca al mismo bug. Cada RPC deja su rastro en `bug_events`.
- **Proyectos**: un usuario puede tener varios proyectos. `settings.json` guarda
  `supabaseActiveProjectId`; si falta o no existe, se cae al proyecto default por slug y luego
  al primer proyecto disponible. Todo IPC de bugs usa siempre el proyecto activo resuelto por
  `getSupabaseTeamStatus`.
- **Reimportar no pisa estados**: `save_analysis_result` conserva el estado remoto existente
  en conflictos por `(project_id, content_key)`. Bugs nuevos entran como `nuevo`.
- **Activos vs históricos**: la lista separa por **estado** (`isActiveStatus` en
  `bugPresentation.ts`): activos = `nuevo`/`en_progreso`; históricos =
  `solucionado`/`cerrado`/`no_replicado`. Es derivado, no un campo aparte. El control de
  pestañas sigue el patrón ARIA tablist (roving tabindex + flechas/Home/End).
- **Pantalla de Bugs en tres columnas**: `BugList` (KPI, buscador, pestañas, filtros y
  lista) · `BugDetail` + `BugComments` (el reporte del bug elegido) · `BugPropertiesRail`
  (responsables, fecha límite, estado, contexto y actividad). `BugsScreen` es dueña del
  estado compartido — filtros y bug seleccionado — y las columnas solo renderizan.
- **`BugList` es hermana del rail, no una columna interna**: arranca en el borde superior
  de la ventana y el topbar empieza a su derecha. Por eso `BugsScreen` recibe el topbar
  como prop (`topbar`) y renderiza `<BugList/>` + `<div className="app-content">`, en vez
  de vivir dentro de `.app-main` como el resto de las pantallas. **No** hay banda de
  encabezado que cruce la pantalla: el texto más grande es el título del bug, en el centro.
  Las acciones de trabajo (cargar manual, exportar, analizar) van en el topbar.
  Ya **no** existen los dos layouts (`cards`/`split`), la paginación, ni el detalle como
  pantalla dedicada: el bug elegido siempre está a la vista en la columna central. Si el
  filtro deja afuera al bug enfocado, se muestra el primero visible.
- **Un control por cosa**: el estado se **cambia** solo en el rail de propiedades; en la
  columna central se **muestra** como badge. Dos controles para lo mismo en la misma
  pantalla se contradicen.
- **Pantalla afectada**: `screenPathOf` devuelve la ruta de la URL del reporte o el área
  del análisis, y `null` si el reporte no informó ninguna — en la UI eso se muestra como
  "Sin pantalla informada", nunca inventado. `screenOf` agrega el fallback al título y se
  usa **solo** como clave de agrupación.
- **Borrar bug**: hace soft-delete remoto (`deleted_at`) vía `bug:delete` y lo saca de la
  lista. La caché por contenido se conserva. Usa el sistema de modales de confirmación
  compartido (sin `confirm()` nativo).
- **Decorados** (`decor/BugMotifs`): motivos temáticos lineales a un trazo (`currentColor`),
  **decorativos** (`aria-hidden`, sin alt). `BugUnderLensMark` es además la marca de la app
  (sobre el cuadrado de acento). Animaciones sutiles vía clases en `styles.css`
  (`.motif-sway`) que el corte global de `prefers-reduced-motion` neutraliza. No decorar la
  lista densa (baja legibilidad): van en el chrome y los vacíos.
- **TS configs (3)**: `tsconfig.json` (typecheck; incluye `vitest.setup.ts` para los matchers
  de jest-dom), `tsconfig.electron.json` (build del main; **excluye `*.test.ts`**),
  `vitest.config.ts` (tests, root en la raíz para cubrir `src/` y `renderer/`).
- **Estética**: **claro y aireado, acento azul**. Fondo `canvas` gris muy claro, contenido
  en tarjetas blancas con borde de 1px y sombra mínima, navegación por **rail de iconos**
  (no tabs, no sidebar ancho). Estilos inline + Tailwind. La definición completa y el mapa
  de pantallas viven en [`docs/design-system.md`](docs/design-system.md); no crear una
  paleta, fuente o shell alternativos.
- **Shell**: `AppRail` (56px, solo iconos) + `AppTopbar` (proyecto, migas, estado, usuario)
  + `app-content`. Como el rail no tiene texto, **todo botón necesita `aria-label` + `title`**
  y los contadores se repiten dentro del label. El contexto global (proyecto activo,
  identidad, estado del motor) va en el topbar, no en la navegación. Cada pantalla es dueña
  de su propio índice interno — Configuración lleva el suyo (`settings-index`).
- **Identidad de personas**: los avatares toman su tono de `avatarToneOf` (hash del id del
  perfil) y sus iniciales de `initialsOf`, ambos en `renderer/components/avatarTone.ts`.
  No elegir el tono en el componente: rompe que una persona tenga el mismo color en toda
  la app. Los tonos `--c-avatar-*` son de identidad, **no** semánticos.
- **Tipografía**: **Public Sans** para todo el producto (vendorizada en
  `renderer/assets/fonts/public-sans/`, subsets latin + latin-ext, variable 300–800 — la app
  es Electron offline, no se usa el CDN de Google Fonts). **Iosevka** queda reservada para
  **código, rutas, keys y timestamps del log**: se aplica con la clase `.mono` (o
  `font-mono`), nunca al chrome ni al cuerpo de texto.
- **Accesibilidad**: focus-visible global y `prefers-reduced-motion` (en `styles.css`) —
  respetarlos; `aria-label` en controles de solo-icono y en los selects de filtro; los badges
  comunican con **color + texto**, no solo color.
- **Colores — origen único**: los valores viven en `renderer/styles.css :root` como
  canales RGB (`--c-*`). Se referencian con `var()` desde: `theme.ts` (`col.x` para
  estilos inline + `alpha(col.x, op)` para tints), `tailwind.config.ts` (clases `bl-*`),
  y las reglas de `styles.css`. **No hardcodear hex/rgba** en componentes — usar `col`/`alpha`.
  **Color nuevo**: definir el valor en `:root`, y exponerlo en `theme.ts` y/o `tailwind.config.ts`
  solo donde se vaya a usar.
  Los tokens están agrupados por rol: superficies (`canvas`/`surface`/`subtle`/`sunken`/`chip`),
  acento azul (`accent*`), texto de más fuerte a más tenue
  (`fg` → `fg-strong` → `fg-body` → `fg-muted` → `fg-dim` → `fg-faint` → `fg-disabled`),
  bordes (`border-strong` → `border` → `border-card` → `border-soft` → `border-faint`) y las
  familias semánticas (`critical`/`high`/`medium`/`warn`/`status-new`/`progress`/`solved`/`not-repro`),
  cada una con su terna `fg` + `-bg` + `-line`. Las familias semánticas se consumen **por clase**
  (`.badge-severity-*`, `.badge-status-*`, `.kpi-*`), no armando el badge a mano.
  Aparte quedan `code*` (literales técnicos en prosa, clase `.code-chip`), `avatar-1…6`
  (identidad) y `vote-up`/`vote-down`.
- **Clases de `@layer components` SIEMPRE literales**: Tailwind purga del CSS de producción
  toda clase que no encuentre **escrita completa** en `renderer/**`. Una clase armada por
  interpolación (`badge-status-${status}`) es invisible para el escaneo y **desaparece del
  build** — así se perdieron los colores de todos los badges de estado y severidad. Usar un
  mapa estático (`SEVERITY_BADGE_CLASS`/`STATUS_BADGE_CLASS` en `bugPresentation.ts`). Si la
  interpolación es realmente más clara, sumar la familia al `safelist` de `tailwind.config.ts`.
  Al agregar una familia dinámica, verificar con
  `grep -c "\.mi-clase" dist/renderer/assets/index-*.css` después de `npm run build`.
- **Tamaños — origen único** (igual que el color): la escala vive en `styles.css :root`:
  tipografía `--text-3xs…--text-5xl` (10/11/12/13/14/15/16/18/20/22/24px), radios
  `--radius-xs|sm|md|lg|xl|2xl|3xl` (5/6/8/10/12/14/16px) más `--radius-pill`, altura de
  controles `--ctl-h-xs|sm|md|lg` (24/30/34/38px) y sombras
  `--shadow-card|pop|modal|accent|float`.
  Se consume vía **clases** (`text-2xs`, `rounded-md`, `.btn-mini`, `.btn-lg`, `.input`/`.btn-*`
  que ya traen `min-height`) o vía `sz`/`radius`/`shadow` de `theme.ts` para `style` inline.
  **No hardcodear px/rem de tamaño** en componentes. El spacing usa la escala default de
  Tailwind (base 4px) — no inventar paddings fuera de grilla.
- **Tamaño de íconos**: los SVG van sobre una escala de 4px → **8 / 12 / 16 / 20 / 24 / 28**px
  (8 = carets/disclosure, 12 = acciones chicas, 16 = estándar, 20/24/28 = medios/marcas). No usar
  valores fuera de esa escala. (Los atributos `width`/`height` del SVG no aceptan CSS vars; los
  motivos decorativos de `decor/` se dimensionan aparte, por contexto.)
- **Electron Linux**: `app.disableHardwareAcceleration()` evita un crash de GPU (SIGTRAP).
  No correr onnxruntime/embeddings en el proceso main (era la causa del crash del índice removido).

## Disciplina de trabajo

- **Verificar antes de decir "listo"**: correr `lint` + `typecheck` + `test`
  (y `build` si se tocó la UI o `main`). Distinguir lo verificado por unit de lo que necesita correrse de verdad
  (integración/E2E) y **decirlo explícitamente**.
- **Cambios grandes o destructivos** (borrar features, refactors masivos, renombrar/mover
  archivos): **proponer y confirmar antes** de ejecutar.
- **No reintroducir** el forense removido (ver *Propósito*).
- **Limpiar** los archivos temporales (scripts de prueba `*.cjs`, etc.) al terminar.

## Comunicación

- **Español.**
- **Honestidad sobre qué está verificado vs. no** — no afirmar que algo anda sin haberlo
  corrido; marcar siempre lo que queda pendiente.

## Estilo de código

- **Seguir el estilo del entorno**: densidad de comentarios, naming, idioma.
- **Idioma**: identificadores y código en **inglés**; comentarios y texto de UI en **español**.
- **Nombres claros y autoexplicativos** — el nombre debe decir qué es / qué hace sin tener
  que leer el cuerpo. Si necesitás un comentario para explicar *qué* es algo, primero
  mejorá el nombre.
  - **Funciones**: verbo + sustantivo, describen la acción o lo que devuelven
    (`readExcel`, `extractGoogleLinks`, `writeEnrichedExcel`, `bugRecordKey`). Las que
    devuelven booleano arrancan con `is/has/should` (`isRepeatedHeader`).
  - **Variables/constantes**: sustantivos concretos. Evitar genéricos (`data`, `tmp`, `info`,
    `x`) salvo índices triviales de loop. Constantes de módulo en `UPPER_SNAKE`
    (`PROMPT_VERSION`, `STATUS_OPTIONS`, `GOOGLE_DOC_REGEX`).
  - **Casing**: componentes y tipos en `PascalCase`; funciones/variables en `camelCase`.
    Nombre de archivo = lo que exporta (componente → `BugsScreen.tsx`; módulo de lógica →
    `excelReader.ts`, `bugPresentation.ts`).
  - **Sin abreviaturas crípticas** — preferí el nombre completo. Los términos ya consolidados
    del dominio (`bug`, `QA`, `LLM`, `doc`, `raw`) sí se usan tal cual.
- **No hardcodear colores** — usar `col` / `alpha` / clases `bl-*` / `var(--c-*)`.
- **Exportar** funciones/componentes internos solo cuando haga falta testearlos o storyarlos.
- **Dependencias**: preguntar antes de agregar una nueva.
- **Tests obligatorios para lógica nueva**: toda función / lógica pura no trivial que se
  integre viene **con sus tests** en el mismo cambio. Componentes de UI nuevos → su historia
  en Storybook + test de la interacción clave. La integración (LLM real, IPC, red/auth) **no**
  se testea por unit — se verifica corriendo.

## Tests

Vitest + React Testing Library (jsdom). Cubre **lógica pura** (excelReader, `buildManualBug`,
mapper Supabase, parseo del LLM, caché, identidad por contenido, dedup del enricher,
`bugPresentation`, `bugActivity` (hilos, actividad, vencimiento), `avatarTone`,
`slugifyProjectName`, `normalizeBugsViewMode`) + las interacciones de
`BugsScreen` (estados + pestañas activos/históricos + filtros + selección del bug),
`BugDetail` (borrado, agente externo, notas), `AppRail`/`AppTopbar` (labels accesibles, migas)
y `ManualBugForm`. La **integración** (LLM real, IPC de Electron, doc readers con red/auth,
auth/realtime de Supabase, y **los RPC de Supabase contra la base real**) **no** se testea por
unit — se verifica corriendo. CI corre `lint → typecheck → test → build` en cada push.

## Git

- **Commits**: Conventional Commits en español — `feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`, `perf:`, `ci:`. Una línea clara; cuerpo cuando el *porqué* no sea obvio.
- **Sin** trailer de co-autoría (`Co-Authored-By: …`).
- **Ramas**: una por feature/fix (`feat/x`, `fix/y`) que sale de `main`. `main` siempre estable.
- **Integración**: todo entra a `main` vía **Pull Request** (aunque lo revise el mismo autor) —
  deja historial y corre el CI.
- **Pull Requests**: título y descripción deben describir el producto/cambio, sin prefijos de
  herramienta o autor (`[codex]`, `[agent]`, etc.) y sin notas internas que no aporten al
  reviewer (estado de auth local, limitaciones del agente, detalles del entorno personal).
- **El agente NO commitea/pushea por defecto**: solo cuando se lo piden explícitamente.
