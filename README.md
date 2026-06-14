# buglens

App de escritorio (Electron + React) que **ordena y reescribe** reportes de bugs.
Cargás un Excel de bugs (típicamente escritos por QA, a veces incoherentes), y la
app los clasifica, los reescribe en texto claro y estructurado, y te deja llevar un
**estado** por bug (nuevo / en progreso / solucionado / cerrado / no replicado).

> No analiza el código fuente: su trabajo es de **intake + clasificación + reescritura**.
> Corre 100% local con Ollama (gratis, sin API key), o con un proveedor cloud opcional.

## Qué hace

1. Cargás un Excel con bugs (con links a Google Docs en cualquier celda, opcional).
2. La app lee los documentos de evidencia de Google Docs (texto + capturas).
3. Por cada bug, **una sola llamada al LLM** produce:
   - **Clasificación**: categoría, severidad, tipo, área/pantalla afectada, confianza.
   - **Reescritura**: qué pasa / qué debería pasar / pasos / ambiente, en texto claro.
     Si el reporte junta varios problemas, los **separa numerados**.
   - **Datos que faltan**: lo que el QA no informó (para pedírselo) — nunca rechaza con
     "información insuficiente".
4. Marcás el **estado** de cada bug; persiste entre corridas (incluso si reordenás el Excel).
5. Filtrás/agrupás/buscás, y exportás un Excel enriquecido.

---

## Requisitos

- Node.js 20+ y npm 9+
- [Ollama](https://ollama.com) corriendo (para el modo local, por defecto)

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
- Persiste en un JSON local, identificado por **contenido** del bug (título + descripción),
  así sobrevive aunque reordenes o re-exportes el Excel.
- Los bugs `solucionado`/`cerrado` se atenúan; el resumen muestra el conteo por estado.

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
| `excelReader.mapHeader(h)` / `extractGoogleLinks(t)` | Helpers puros: mapeo de cabeceras ES/EN y detección de links Docs/Drive. |
| `bugEnricher.BugEnricher.enrich(bug)` | Trae los Google Docs del bug. **Cachea por URL** para no re-descargar el mismo doc (un doc suele documentar varios bugs). |
| `bugStatusKey.bugRecordKey(raw)` | Clave de identidad **estable por contenido** (título+descripción). Permite que el estado reencuentre al bug aunque cambie de posición. |
| `bugRecordsStore.readRecords / setBugStatus` | Persistencia del estado de cada bug en `bug-records.json` (solo guarda los ≠ `nuevo`). |
| `googleDocsReader` / `browserDocsReader` | Lectura de Google Docs vía OAuth (texto) o sesión de navegador (texto + capturas). |

### `src/llm/` — análisis

| Función | Qué hace |
|---|---|
| `fastTriage.analyzeBug(enriched, config, cacheDir?)` | **El pipeline**: una llamada LLM por bug → clasifica + reescribe + lista faltantes. Con caché. |
| `fastTriage.parseAnalysis(raw)` | Parsea la respuesta del LLM de forma robusta: tolera ` ```fences``` `, texto extra, campos faltantes/inválidos → defaults seguros. |
| `fastTriage.extractRelevantDocSection(bug, text)` | Ventana deslizante que elige la sección del doc más relevante al bug (un doc puede documentar varios). |
| `client.getLLMConfig(override?)` | Resuelve provider / modelo / baseUrl / apiKey desde env + overrides. |
| `analysisCache.makeCacheKey / load / save` | Caché por **contenido** (bug + docs + modelo + versión de prompt): re-correr el mismo Excel = 0 llamadas. |

### `electron/main.ts` — proceso main

| Handler | Qué hace |
|---|---|
| `analyze:run` | Orquesta el batch: lee Excel → enricher → `analyzeBug` por bug (con concurrencia) → adjunta el estado persistido. Emite resultados al renderer en streaming. |
| `bug:set-status` | Persiste el cambio de estado de un bug. |
| `ensureOllamaRunning(baseUrl)` | Levanta Ollama si no corre (con el override de GPU AMD y paralelismo). |

### `renderer/` — UI

| Pieza | Qué hace |
|---|---|
| `App.tsx` | Estado global, eventos IPC, atajos de teclado, handler de cambio de estado. |
| `BugTable.tsx` | Tabla con filtros (categoría/severidad/estado), búsqueda, agrupación por pantalla, detalle con el reporte reescrito, y selector de estado inline. |
| `Settings.tsx` | Modelo LLM, acceso a Google, caché. |

---

## Estructura del proyecto

```
buglens/
├── electron/
│   ├── main.ts            # Main process: IPC, ventana, orquestación del pipeline
│   └── preload.ts         # Expone electronAPI al renderer (contextBridge)
├── src/
│   ├── pipeline/
│   │   ├── excelReader.ts        # Lee/escribe Excel (SheetJS)
│   │   ├── googleDocsReader.ts   # Google Docs vía OAuth2
│   │   ├── browserDocsReader.ts  # Google Docs vía sesión de navegador (+ capturas)
│   │   ├── bugEnricher.ts        # Trae los docs del bug (con dedup por URL)
│   │   ├── bugStatusKey.ts       # Clave de identidad estable por contenido
│   │   └── bugRecordsStore.ts    # Persistencia del estado de los bugs
│   ├── llm/
│   │   ├── fastTriage.ts         # Pipeline de análisis (clasificar + reescribir)
│   │   ├── client.ts             # Config de LLM (ollama / anthropic / gemini / openai)
│   │   └── analysisCache.ts      # Caché de análisis por contenido
│   └── types/index.ts            # Tipos TypeScript compartidos
├── renderer/
│   ├── components/        # BugTable, Settings, FileUpload, ProgressLog, EmptyState
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

La suite (Vitest + React Testing Library) cubre la **lógica de negocio**: identidad y
persistencia de estados, parsing del Excel, parseo robusto del LLM, caché, selección de
sección de doc, dedup de docs, y la interacción de estados en la tabla. La integración
(LLM real, IPC, lectores de docs) se verifica corriendo la app.

El **CI** (`.github/workflows/ci.yml`) corre `typecheck → test → build` en cada push y PR.

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
