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
        ├→ bugEnricher (trae Google Docs) → fastTriage.analyzeBug (1 llamada LLM:
manual ─┘   clasifica + reescribe + lista faltantes) → tabla (activos/históricos) → exportar
```

Dos entradas, mismo pipeline: el Excel (`analyze:run`) y la carga manual
(`analyze:manual-bug`, que appendea sin reemplazar). Los bugs analizados, estados,
imports y corridas se persisten en Supabase; al reabrir se restaura desde el proyecto remoto.

- `src/pipeline/` — `excelReader` (lee + exporta; `writeBugsExcel` exporta desde cero),
  `manualBugBuilder` (RawBug desde el form), doc readers
  (`googleDocsReader`/`browserDocsReader`), `bugEnricher`, identidad (`bugStatusKey`)
- `src/supabase/` — `teamClient` (auth/cliente) y `teamBugs` (imports, análisis,
  estados, soft-delete, restore remoto)
- `src/llm/` — `fastTriage` (el pipeline real), `client` (config de LLM), `analysisCache`
- `electron/main.ts` — IPC (`analyze:run`/`analyze:manual-bug`, `export:excel`/`export:bugs`,
  `bugs:load-remote`/`bugs:watch-remote`, `bug:set-status`/`bug:delete`) + orquestación
  del batch · `renderer/` — UI (`App`, `BugTable`, `ManualBugForm`, `decor/BugMotifs`, …)

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
  `bugs:load-remote`; realtime (`bugs:watch-remote`) dispara refresh de la tabla.
- **Proyectos**: un usuario puede tener varios proyectos. `settings.json` guarda
  `supabaseActiveProjectId`; si falta o no existe, se cae al proyecto default por slug y luego
  al primer proyecto disponible. Todo IPC de bugs usa siempre el proyecto activo resuelto por
  `getSupabaseTeamStatus`.
- **Reimportar no pisa estados**: `save_analysis_result` conserva el estado remoto existente
  en conflictos por `(project_id, content_key)`. Bugs nuevos entran como `nuevo`.
- **Activos vs históricos**: la tabla separa por **estado** (`isActiveStatus` en `BugTable`):
  activos = `nuevo`/`en_progreso`; históricos = `solucionado`/`cerrado`/`no_replicado`.
  Es derivado, no un campo aparte. El control de pestañas sigue el patrón ARIA tablist
  (roving tabindex + flechas/Home/End).
- **Borrar bug**: hace soft-delete remoto (`deleted_at`) vía `bug:delete` y lo saca de la
  tabla. La caché por contenido se conserva. Usa el sistema de modales de confirmación
  compartido (sin `confirm()` nativo).
- **Decorados** (`decor/BugMotifs`): motivos temáticos line-art mono a un trazo (`currentColor`),
  **decorativos** (`aria-hidden`, sin alt). Animaciones sutiles vía clases en `styles.css`
  (`.motif-sway`) que el corte global de `prefers-reduced-motion` neutraliza. No decorar la
  tabla densa (baja legibilidad): van en el chrome y los vacíos.
- **TS configs (3)**: `tsconfig.json` (typecheck; incluye `vitest.setup.ts` para los matchers
  de jest-dom), `tsconfig.electron.json` (build del main; **excluye `*.test.ts`**),
  `vitest.config.ts` (tests, root en la raíz para cubrir `src/` y `renderer/`).
- **Estética**: dark/mono (paleta omarchy), estilos inline + Tailwind.
- **Accesibilidad**: focus-visible global y `prefers-reduced-motion` (en `styles.css`) —
  respetarlos; `aria-label` en controles de solo-icono y en los selects de filtro; los badges
  comunican con **color + texto**, no solo color.
- **Colores — origen único**: los valores viven en `renderer/styles.css :root` como
  canales RGB (`--c-*`). Se referencian con `var()` desde: `theme.ts` (`col.x` para
  estilos inline + `alpha(col.x, op)` para tints), `tailwind.config.ts` (clases `om-*`),
  y las reglas de `styles.css`. **No hardcodear hex/rgba** en componentes — usar `col`/`alpha`.
  **Color nuevo**: definir el valor en `:root`, y exponerlo en `theme.ts` y/o `tailwind.config.ts`
  solo donde se vaya a usar.
- **Tamaños — origen único** (igual que el color): la escala vive en `styles.css :root`:
  tipografía `--text-2xs|xs|sm` (11/12/14px), radios `--radius-sm|md` (4/6px), altura de
  controles `--ctl-h-sm|md` (28/32px). Se consume vía **clases** (`text-2xs`, `rounded`/`rounded-md`,
  `.btn-mini` para micro-controles, `.input`/`.btn-*` que ya traen `min-height`) o vía `sz`/`radius`
  de `theme.ts` para `style` inline. **No hardcodear px/rem de tamaño** en componentes. El spacing
  usa la escala default de Tailwind (base 4px) — no inventar paddings fuera de grilla.
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
    Nombre de archivo = lo que exporta (componente → `BugTable.tsx`; módulo de lógica →
    `excelReader.ts`, `bugStatusKey.ts`).
  - **Sin abreviaturas crípticas** — preferí el nombre completo. Los términos ya consolidados
    del dominio (`bug`, `QA`, `LLM`, `doc`, `raw`) sí se usan tal cual.
- **No hardcodear colores** — usar `col` / `alpha` / clases `om-*` / `var(--c-*)`.
- **Exportar** funciones/componentes internos solo cuando haga falta testearlos o storyarlos.
- **Dependencias**: preguntar antes de agregar una nueva.
- **Tests obligatorios para lógica nueva**: toda función / lógica pura no trivial que se
  integre viene **con sus tests** en el mismo cambio. Componentes de UI nuevos → su historia
  en Storybook + test de la interacción clave. La integración (LLM real, IPC, red/auth) **no**
  se testea por unit — se verifica corriendo.

## Tests

Vitest + React Testing Library (jsdom). Cubre **lógica pura** (excelReader, `buildManualBug`,
mapper Supabase, parseo del LLM, caché, identidad por contenido, dedup del enricher) + las interacciones de
`BugTable` (estados + pestañas activos/históricos + teclado + borrado) y `ManualBugForm`. La **integración** (LLM
real, IPC de Electron, doc readers con red/auth, auth/realtime de Supabase) **no** se testea
por unit — se verifica corriendo. CI corre `lint → typecheck → test → build` en cada push.

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
