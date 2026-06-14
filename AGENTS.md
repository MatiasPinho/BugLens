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
- `npm test` · `npm run test:watch` — Vitest
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — renderer (vite) + main (tsc)
- `npm run storybook` · `npm run build-storybook` — taller / documentación de componentes (UI)

## Flujo / arquitectura

```
Excel → bugEnricher (trae Google Docs) → fastTriage.analyzeBug (1 llamada LLM:
        clasifica + reescribe + lista faltantes) → tabla con estados → exportar
```

- `src/pipeline/` — `excelReader`, doc readers (`googleDocsReader`/`browserDocsReader`),
  `bugEnricher`, estados (`bugStatusKey`, `bugRecordsStore`)
- `src/llm/` — `fastTriage` (el pipeline real), `client` (config de LLM), `analysisCache`
- `electron/main.ts` — IPC + orquestación del batch · `renderer/` — UI (`App`, `BugTable`, …)

## Convenciones y constraints

- **LLM por defecto: Ollama `qwen2.5:7b`** (local, gratis). 4 proveedores soportados
  (ollama/anthropic/gemini/openai) en `fastTriage.ts`. El parseo del LLM debe ser
  **robusto** (`parseAnalysis` tolera ` ```fences``` ` y campos faltantes) — nunca asumir
  JSON perfecto del modelo.
- **El análisis SIEMPRE produce salida útil** — nunca "información insuficiente" ni rechazo:
  reescribe lo que haya y lo que falta va en `missingInformation`. El parser cae a defaults
  seguros ante campos faltantes/inválidos. (No existe la categoría `insufficient_info`.)
- **Caché por contenido** (`analysisCache`): al cambiar un prompt, **bumpear `PROMPT_VERSION`**
  para invalidar la caché vieja.
- **Estados persistentes**: identidad por **contenido** (`bugRecordKey` = hash de
  título+descripción), no por posición de fila. Persisten en `bug-records.json` (userData);
  solo se guardan los ≠ `nuevo`.
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
- **Electron Linux**: `app.disableHardwareAcceleration()` evita un crash de GPU (SIGTRAP).
  No correr onnxruntime/embeddings en el proceso main (era la causa del crash del índice removido).

## Disciplina de trabajo

- **Verificar antes de decir "listo"**: correr `typecheck` + `test` (y `build` si se tocó la UI
  o `main`). Distinguir lo verificado por unit de lo que necesita correrse de verdad
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

Vitest + React Testing Library (jsdom). Cubre **lógica pura** (excelReader, parseo del LLM,
caché, estados, dedup del enricher) + la interacción de estados en `BugTable`. La
**integración** (LLM real, IPC de Electron, doc readers con red/auth) **no** se testea por
unit — se verifica corriendo. CI corre `typecheck → test → build` en cada push.

## Git

- **Commits**: Conventional Commits en español — `feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`, `perf:`, `ci:`. Una línea clara; cuerpo cuando el *porqué* no sea obvio.
- **Sin** trailer de co-autoría (`Co-Authored-By: …`).
- **Ramas**: una por feature/fix (`feat/x`, `fix/y`) que sale de `main`. `main` siempre estable.
- **Integración**: todo entra a `main` vía **Pull Request** (aunque lo revise el mismo autor) —
  deja historial y corre el CI.
- **El agente NO commitea/pushea por defecto**: solo cuando se lo piden explícitamente.
