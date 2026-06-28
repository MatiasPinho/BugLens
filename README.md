# buglens

App de escritorio (Electron + React) que **ordena y reescribe** reportes de bugs.
Cargás bugs **desde un Excel** o **a mano** (típicamente escritos por QA, a veces
incoherentes), y la app los clasifica, los reescribe en texto claro y estructurado, y
te deja llevar un **estado** por bug (nuevo / en progreso / solucionado / cerrado /
no replicado). Los bugs analizados y sus estados se **sincronizan con Supabase** para
trabajar en equipo.

> No analiza el código fuente: su trabajo es de **intake + clasificación + reescritura**.
> El análisis puede correr local con Ollama (gratis, sin API key), o con un proveedor cloud opcional.

## Qué hace

1. Cargás bugs **desde un Excel** (con links a Google Docs en cualquier celda, opcional)
   o **uno a uno a mano** (botón "cargar bug manual"), que se appendea a la tabla.
2. La app lee los documentos de evidencia de Google Docs (texto + capturas).
3. Por cada bug, **una sola llamada al LLM** produce:
   - **Clasificación**: categoría, severidad, tipo, área/pantalla afectada, confianza.
   - **Reescritura**: qué pasa / qué debería pasar / pasos / ambiente, en texto claro.
     Si el reporte junta **problemas independientes**, los **separa numerados** (los pasos
     de un mismo bug no cuentan como problemas distintos).
   - **Datos que faltan**: lo que el QA no informó (para pedírselo) — nunca rechaza con
     "información insuficiente".
4. Marcás el **estado** de cada bug; persiste en Supabase y lo ve todo el equipo.
   La tabla separa **activos** (nuevo / en progreso) de **históricos** (solucionado /
   cerrado / no replicado) con un control de pestañas (navegable con flechas).
5. Filtrás/agrupás/buscás/**borrás** bugs, y exportás un Excel enriquecido (incluso sin Excel original)
   o un JSON con los **datos completos** recopilados.
6. Opcionalmente ejecutás un **agente externo por bug** (Codex CLI, OpenCode, Claude Code
   u otro comando local) para contrastar el reporte con repositorios configurados. El aporte
   se guarda junto al bug, muestra logs técnicos cuando falla y puede sugerir, con confirmación
   manual, si el bug parece resuelto.
7. Al reabrir la app, la tabla se restaura desde el proyecto compartido en Supabase.

---

## Requisitos

- Node.js 20+ y npm 9+
- [Ollama](https://ollama.com) corriendo (para el modo local, por defecto)

**Plataformas**: Linux, macOS y Windows. El binario de **Ollama** y el navegador **Chrome/Chromium**
(para capturas de Google Docs) se detectan en las rutas estándar de cada SO. Si los instalaste en
una ubicación no estándar, indicá la ruta con las env vars `OLLAMA_BIN` y/o `CHROME_PATH`.

## Instalación

```bash
git clone <repo>
cd buglens
npm install
cp .env.example .env   # opcional: credenciales de Google / API keys cloud
```

## Scripts

```bash
npm run dev        # Electron + Vite con hot reload del renderer
npm test           # corre la suite de tests (Vitest)
npm run typecheck  # chequeo de tipos (tsc --noEmit)
npm run build      # compila renderer + main
npm run package    # genera el instalador en release/
```

---

## Modelo LLM

Por defecto usa **Ollama local** con `qwen2.5:7b` (rápido, gratis, sin API key).

```bash
curl -fsSL https://ollama.com/install.sh | sh   # instalar Ollama
ollama pull qwen2.5:7b                           # modelo por defecto
ollama pull qwen2.5:14b                          # opcional: mejor calidad, más lento
```

Desde **config → modelo llm** podés cambiar el modelo (chips con hints de
velocidad/calidad). Modelos más grandes razonan mejor pero son más lentos y piden
más VRAM/RAM.

**GPU AMD (ROCm):** las RX 6600/6650 (gfx1032) necesitan un override. La app lo
setea sola al levantar Ollama; manualmente:

```bash
HSA_OVERRIDE_GFX_VERSION=10.3.0 OLLAMA_NUM_PARALLEL=3 ollama serve
```

### Rendimiento (GPU vs CPU)

Al abrir la app por primera vez, un **wizard** te deja elegir lo importante (rendimiento,
modelo, Google Docs). En el paso de rendimiento, **"analizar mi equipo"** le pregunta a
Ollama si el modelo corre en GPU o CPU (lee `size_vram` de `/api/ps`) y marca la opción
recomendada. **Sin placa de video el análisis es mucho más lento y puede cortar por
timeout** — por eso el modo ajusta dos cosas:

| Modo | Paralelismo | Timeout por bug |
| ---- | ----------- | --------------- |
| GPU  | 3 (default del proveedor) | 90 s  |
| CPU  | 1 (serie)   | 240 s |

Se cambia después en **config → rendimiento**. Si necesitás forzar valores, hay env vars
que **ganan** sobre el modo:

```env
LLM_PERFORMANCE_MODE=cpu   # 'gpu' (default) o 'cpu'
LLM_CONCURRENCY=1          # bugs simultáneos (cualquier proveedor)
OLLAMA_TIMEOUT_MS=240000   # ms antes de abortar una llamada a Ollama
```

### Proveedores cloud (opcionales)

Se mantienen 4 proveedores. Configurás uno con `LLM_PROVIDER` en `.env` o desde la UI:

```env
LLM_PROVIDER=anthropic        # o gemini / openai / ollama
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-haiku-4-5-20251001
```

---

## Acceso a Google Docs (opcional)

Si los bugs tienen links a Google Docs, la app lee su texto y **capturas**. Dos formas
de autenticarse (desde **config → acceso a google docs**):

- **Sesión del navegador** (recomendado): te logueás una vez en una ventana; se guardan
  las cookies. Trae texto **y capturas**. No requiere Google Cloud Console.
- **OAuth2**: credenciales de Google Cloud (Docs API + Drive API). Solo texto.

Sin autenticar, la app igual reescribe con el texto del Excel.

---

## Formato del Excel de entrada

Detecta las columnas comunes automáticamente (case-insensitive, ES/EN):

| Columna del Excel | Campo |
|---|---|
| Título / Title / Summary / Resumen | título |
| Descripción / Description | descripción |
| Pasos / Steps | pasos para reproducir |
| Esperado / Expected | resultado esperado |
| Actual | resultado actual |
| Entorno / Environment | entorno |
| Estado / Status, Prioridad / Priority, Reporter, Asignado / Assignee | metadata |

Los links a Google Docs/Drive se detectan en **cualquier celda**. Las columnas no
reconocidas se incluyen igual como contexto extra para el LLM.

---

## Workflow de estados

Cada bug tiene un estado del ciclo de vida, **persistente entre corridas**:

`nuevo` (default) · `en progreso` · `solucionado` · `cerrado` · `no replicado`

- Se marca con el selector inline de cada fila, o con las teclas **1–5** sobre el bug enfocado.
- Persiste en Supabase dentro del proyecto activo, identificado por **contenido** del bug
  (título + descripción), así sobrevive aunque reordenes o re-exportes el Excel.
- Los bugs `solucionado`/`cerrado` se atenúan; el resumen muestra el conteo por estado.

### Activos vs históricos

La tabla separa lo accionable de lo archivado con un control de pestañas
(**activos | históricos | todos**), derivado del estado de cada bug:

- **activos** (vista por defecto): `nuevo`, `en progreso`.
- **históricos**: `solucionado`, `cerrado`, `no replicado`.
- **todos**: ambos.

Mover un bug a un estado resuelto lo manda al histórico automáticamente; el filtro de
estado refina dentro de la pestaña activa. El control de pestañas se navega con
**flechas / Home / End** (patrón ARIA tablist).

## Borrar bugs

Desde el detalle expandido de un bug, el botón **borrar** abre un modal de confirmación
y hace un **soft-delete en Supabase** (`deleted_at`) si se confirma. El bug sale de la
tabla compartida y la caché de análisis (por contenido) se conserva. Como no se edita el
Excel original, un bug que vino de un Excel puede volver a aparecer si se re-analiza. Si
borrás el último bug, la app vuelve al inicio.

## Carga manual de bugs

Además del Excel, podés cargar un bug **a mano** con el botón **"cargar bug manual"**: un
formulario con título, descripción, pasos, esperado, actual y ambiente (basta con título
**o** descripción). Se analiza con el mismo pipeline y se **agrega** a la tabla sin
reemplazar lo ya cargado.

## Persistencia compartida

Supabase es la fuente de verdad para los bugs analizados, estados, imports y corridas de
análisis. Electron usa sesión de usuario con Google Auth y una publishable key; nunca usa
service keys. Al abrir la app, la tabla se hidrata desde Supabase y un canal realtime avisa
cambios remotos para refrescar la vista.

Un usuario puede pertenecer a varios proyectos. El proyecto activo se elige desde
**config → equipo → proyectos**; cada proyecto tiene sus propios bugs, análisis, estados,
imports y eventos realtime.

La colaboración no requiere MCP. MCP solo tendría sentido para integrar herramientas externas
de investigación; la coexistencia real del equipo depende de autenticación, RLS y persistencia
compartida.

La primera base de esta migración está documentada en
[`docs/supabase-migration.md`](docs/supabase-migration.md), con el schema inicial en
[`supabase/migrations/0001_initial_team_schema.sql`](supabase/migrations/0001_initial_team_schema.sql).

El análisis de código es una acción explícita **por bug**, delegada en una herramienta externa
que el usuario ya tenga configurada (Codex CLI, OpenCode, Claude Code u otra). No vuelve al
enfoque forense removido de embeddings/onnxruntime ni corre en batch automático sobre todos
los bugs.

Arquitectura actual:

```text
buglens -> comando local configurado -> agente externo -> repo local
```

BugLens arma un prompt con el reporte reescrito, los pasos reportados, las capturas y los
repositorios configurados. El agente debe responder en español, contrastar cada paso del bug
reportado, separar hallazgos laterales de fallas reales y distinguir evidencia comprobada de
hipótesis. El resultado se persiste en Supabase como parte del análisis del bug.

Si el agente usa modelos cloud, puede consumir tokens del usuario y enviar fragmentos del repo
al proveedor configurado. BugLens muestra esa advertencia antes de ejecutar el análisis.

## Atajos de teclado

| Tecla | Acción |
|---|---|
| `j` / `k` | siguiente / anterior bug |
| `Enter` | expandir / colapsar |
| `1`–`5` | marcar estado (nuevo → no replicado) |
| `/` | enfocar búsqueda |
| `Esc` | cerrar detalle / modal |
| `?` | ayuda |

---

## Arquitectura y funciones clave

Flujo: **Excel → enriquecer (docs) → analizar (LLM) → tabla con estados → exportar**.

### `src/pipeline/` — lectura y datos

| Función | Qué hace |
|---|---|
| `excelReader.readExcel(path)` | Parsea el Excel → `RawBug[]`: mapea columnas, extrae links a docs, filtra filas que son headers repetidos. |
| `excelReader.writeEnrichedExcel(...)` | Exporta el Excel original + columnas del análisis (reescritura, estado, etc.). |
| `excelReader.writeBugsExcel(...)` | Exporta un `.xlsx` **desde cero** (sin Excel original): para bugs manuales o mezclados. |
| `fullDataExport.writeFullDataJson(...)` | Exporta un `.json` completo sin aplanar: fila original, docs leídos, imágenes, análisis, estado, errores, tiempos y respuesta cruda del LLM. |
| `excelReader.mapHeader(h)` / `extractGoogleLinks(t)` | Helpers puros: mapeo de cabeceras ES/EN y detección de links Docs/Drive. |
| `manualBugBuilder.buildManualBug(fields, seq)` | Arma un `RawBug` válido desde los campos del formulario manual (sin Excel). |
| `bugEnricher.BugEnricher.enrich(bug)` | Trae los Google Docs del bug. **Cachea por URL** para no re-descargar el mismo doc (un doc suele documentar varios bugs). |
| `bugStatusKey.bugRecordKey(raw)` | Clave de identidad **estable por contenido** (título+descripción). Vincula el mismo bug con su fila compartida en Supabase aunque cambie de posición. |
| `src/supabase/teamBugs` | Crea imports, guarda análisis, cambia estados, borra bugs con soft-delete y reconstruye la tabla desde Supabase. |
| `googleDocsReader` / `browserDocsReader` | Lectura de Google Docs vía OAuth (texto) o sesión de navegador (texto + capturas). |

### `src/llm/` — análisis

| Función | Qué hace |
|---|---|
| `fastTriage.analyzeBug(enriched, config, cacheDir?)` | **El pipeline**: una llamada LLM por bug → clasifica + reescribe + lista faltantes. Con caché. |
| `fastTriage.parseAnalysis(raw)` | Parsea la respuesta del LLM de forma robusta: tolera ` ```fences``` `, texto extra, campos faltantes/inválidos → defaults seguros. |
| `fastTriage.extractRelevantDocSection(bug, text)` | Ventana deslizante que elige la sección del doc más relevante al bug (un doc puede documentar varios). |
| `client.getLLMConfig(override?)` | Resuelve provider / modelo / baseUrl / apiKey / modo de rendimiento desde env + overrides. |
| `runtimeConfig.resolveConcurrency / resolveOllamaTimeoutMs` | Paralelismo y timeout efectivos. Precedencia: env var > modo de rendimiento (cpu → 1 / 240 s) > default del proveedor. |
| `analysisCache.makeCacheKey / load / save` | Caché por **contenido** (bug + docs + modelo + versión de prompt): re-correr el mismo Excel = 0 llamadas. |

### `src/agents/` — agente externo

| Función | Qué hace |
|---|---|
| `externalAgent.buildExternalAgentPrompt(...)` | Construye el prompt por bug: reporte reescrito, evidencia, repositorios y reglas para evaluar pasos reportados vs. hallazgos laterales. |
| `externalAgent.runExternalAgent(...)` | Ejecuta el comando configurado sin TTY, streamea progreso al renderer, aplica timeout y devuelve salida/error normalizados. |

### `electron/main.ts` — proceso main

| Handler | Qué hace |
|---|---|
| `analyze:run` | Orquesta el batch: lee Excel → enricher → `analyzeBug` por bug (con concurrencia) → adjunta el estado persistido. Emite resultados al renderer en streaming. |
| `analyze:manual-bug` | Arma un bug desde los campos del formulario y lo analiza, streameándolo a la tabla **sin reemplazar** lo ya cargado. |
| `export:excel` / `export:bugs` | Exporta el Excel enriquecido (con original) o un `.xlsx` nuevo desde cero (manual / mezclado). |
| `export:full-data` | Exporta un `.json` completo con todos los bugs analizados y la data recopilada sin aplanar. |
| `bugs:load-remote` / `bugs:watch-remote` | Carga la tabla desde Supabase y escucha cambios realtime del proyecto. |
| `bug:set-status` / `bug:delete` | Persiste cambios de estado y soft-delete remoto. |
| `bug:analyze-external-agent` | Ejecuta el agente externo para un bug seleccionado y guarda el aporte integrado al reporte. |
| `ensureOllamaRunning(baseUrl)` | Levanta Ollama si no corre (con el override de GPU AMD y paralelismo). |
| `hardware:probe` | Sondea si el modelo corre en GPU o CPU: lo carga con una generación mínima y lee `size_vram` de `/api/ps`. Alimenta el wizard / config (recomendado + aviso). |

### `renderer/` — UI

| Pieza | Qué hace |
|---|---|
| `App.tsx` | Estado global, eventos IPC, atajos de teclado, cambio de estado, borrado y restore remoto desde Supabase. |
| `BugTable.tsx` | Tabla con pestañas **activos/históricos/todos** (navegables con flechas), filtros, búsqueda, agrupación por pantalla, detalle con el reporte reescrito, selector de estado inline, **borrado con confirmación** y panel del agente externo. |
| `ManualBugForm.tsx` | Modal para cargar un bug a mano (Esc/Tab-trap/autofocus, ⌘/Ctrl+Enter). |
| `decor/BugMotifs.tsx` | Motivos decorativos temáticos (line-art mono): `BeetleMark` (escarabajo, ambiente) y `BugUnderLensMark` (lupa+bicho, marca/búsqueda). Usados en EmptyState, vacíos de la tabla y el panel izquierdo. |
| `Onboarding.tsx` | Wizard de primer arranque (rendimiento → modelo → Google Docs). Se muestra hasta que `onboarded` queda en `true`. |
| `PerformanceModePicker.tsx` | Selector GPU/CPU con "analizar mi equipo" (sondea Ollama, marca recomendado, avisa si es CPU). Usado por el wizard y Settings. |
| `Settings.tsx` | Modelo LLM, rendimiento (GPU/CPU), acceso a Google, agente externo, caché y proyectos Supabase. |

---

## Estructura del proyecto

```
buglens/
├── electron/
│   ├── main.ts            # Main process: IPC, ventana, orquestación del pipeline
│   └── preload.ts         # Expone electronAPI al renderer (contextBridge)
├── src/
│   ├── pipeline/
│   │   ├── excelReader.ts        # Lee/escribe Excel (SheetJS) + export desde cero
│   │   ├── manualBugBuilder.ts   # Arma un RawBug desde el formulario manual
│   │   ├── googleDocsReader.ts   # Google Docs vía OAuth2
│   │   ├── browserDocsReader.ts  # Google Docs vía sesión de navegador (+ capturas)
│   │   ├── bugEnricher.ts        # Trae los docs del bug (con dedup por URL)
│   │   └── bugStatusKey.ts       # Clave de identidad estable por contenido
│   ├── supabase/
│   │   ├── teamClient.ts         # Auth, storage y cliente Supabase
│   │   └── teamBugs.ts           # Persistencia compartida de bugs/análisis
│   ├── llm/
│   │   ├── fastTriage.ts         # Pipeline de análisis (clasificar + reescribir)
│   │   ├── client.ts             # Config de LLM (ollama / anthropic / gemini / openai)
│   │   ├── runtimeConfig.ts      # Paralelismo + timeout efectivos (modo GPU/CPU + env)
│   │   └── analysisCache.ts      # Caché de análisis por contenido
│   ├── agents/
│   │   └── externalAgent.ts      # Prompt + ejecución del agente externo por bug
│   └── types/index.ts            # Tipos TypeScript compartidos
├── renderer/
│   ├── components/        # BugTable, ManualBugForm, Settings, Onboarding, PerformanceModePicker, FileUpload, ProgressLog, EmptyState
│   │   └── decor/         # Motivos decorativos temáticos (BugMotifs: escarabajo, lupa+bicho)
│   ├── App.tsx            # Root component + estado + atajos
│   ├── main.tsx           # Entry point React
│   ├── styles.css         # Tailwind
│   └── electron.d.ts      # Tipos de window.electronAPI
├── .github/workflows/ci.yml   # CI: typecheck + tests + build
├── vitest.config.ts
└── package.json
```

---

## Tests y CI

```bash
npm test            # corre todo
npm run test:watch  # modo watch
```

La suite (Vitest + React Testing Library) cubre la **lógica de negocio**: identidad por
contenido, parsing del Excel, construcción del bug manual, mapeo Supabase, parseo robusto
del LLM, caché, selección de sección de doc, dedup de docs, prompt/ejecución del agente
externo, persistencia del aporte externo y las interacciones de la tabla (estados, pestañas
activos/históricos, panel del agente, progreso, errores, cobertura por pasos y sugerencia
manual de "resuelto"). La integración (LLM real, IPC, comandos externos, lectores de docs,
auth/red/realtime de Supabase) se verifica corriendo la app.

El **CI** (`.github/workflows/ci.yml`) corre `lint → typecheck → test → build` en cada push
y PR.

## Pull Requests

- Usá títulos descriptivos del cambio, sin prefijos de herramienta o autor como `[codex]`,
  `[agent]` o similares.
- La descripción debe enfocarse en qué cambió, por qué, impacto y validación. Evitá notas
  internas que no aportan al reviewer, como estado de autenticación local, limitaciones del
  agente o detalles personales del entorno.

---

## Solución de problemas

**Electron arranca con pantalla negra / crash de GPU (Linux).**
La app deshabilita la aceleración por hardware en Linux automáticamente (render por
software). Si igual falla, verificá que Vite esté en el puerto 5173.

**Ollama timeout / lento.** Modelos grandes en CPU/GPU modesta tardan. Probá un modelo
más chico (`qwen2.5:7b`) desde config, o subí el timeout en `src/llm/fastTriage.ts`.

**GPU AMD no se usa.** Necesita `HSA_OVERRIDE_GFX_VERSION=10.3.0` (la app lo setea al
levantar Ollama; si lo corrés manual, agregalo).

**Google OAuth: `redirect_uri_mismatch`.** El redirect URI debe ser exactamente
`http://localhost:3000/oauth2callback` en Google Cloud Console.

---

## Licencia

MIT
