/**
 * analyze.ts (histórico: fastTriage.ts)
 *
 * El único pipeline de la app: por cada bug, clasifica + REESCRIBE el reporte
 * (a veces incoherente) del QA en texto claro + lista qué datos faltan.
 *
 * No toca el repositorio ni usa agente. Una sola llamada LLM corta por bug:
 * texto con qwen2.5:7b, y capturas con un modelo vision local si está configurado.
 */

import type { BugAnalysis, EnrichedBug, LLMConfig, RawBug } from '../types/index.js'
import { loadCachedAnalysis, makeCacheKey, saveCachedAnalysis } from './analysisCache.js'
import { resolveOllamaTimeoutMs } from './runtimeConfig.js'

// ─── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente que ordena y REESCRIBE reportes de bugs de QA. Los reportes suelen venir incoherentes, incompletos o mal redactados. Tu trabajo:
1. Clasificar el bug (área, tipo, severidad).
2. REESCRIBIR el reporte en español claro y estructurado.
3. Listar qué información falta.

Respondé SOLO un JSON con este formato. Todo en español.

{
  "category": "frontend" | "backend" | "database" | "config" | "data" | "otro",
  "bugType": "ui" | "validation" | "routing" | "permissions" | "api" | "database" | "configuration" | "data_quality" | "unknown",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0,
  "affectedArea": "pantalla / módulo / ruta afectada (o 'No informado')",
  "summary": "UNA oración clara: qué está roto",
  "rewritten": {
    "observed": "qué pasa hoy, reescrito claro y ordenado (no copies el texto crudo: mejoralo)",
    "expected": "qué debería pasar (o 'No informado')",
    "steps": ["paso 1 para reproducir", "paso 2"],
    "environment": "dev / prod / local (o 'No informado')"
  },
  "problemCount": 1,
  "missingInformation": ["qué dato falta para entender o reproducir el bug"]
}

REGLAS:
- SIEMPRE producí una reescritura con lo que haya. Nunca digas "no se puede" ni "información insuficiente": si falta algo, escribilo en "missingInformation" y poné "No informado" en el campo que corresponda.
- REESCRIBÍ, no copies: arreglá la redacción, ordená los pasos, separá "qué pasa" de "qué debería pasar". No inventes hechos que el reporte no dice.
- PASOS NO SON PROBLEMAS (IMPORTANTE): los pasos para reproducir, el flujo de uso, y la separación "qué pasa" vs "qué debería pasar" de UN MISMO bug NO son problemas distintos. Los pasos van SIEMPRE en "steps", NUNCA numerados dentro de "observed"/"expected". Un bug con muchos pasos o varios síntomas del mismo origen sigue siendo UN problema.
- VARIOS PROBLEMAS EN UN MISMO REPORTE: numerá "observed"/"expected" SOLO si el reporte mezcla defectos INDEPENDIENTES, cada uno arreglable por separado (ej: "no guarda" + "se ve mal en mobile"). En ese caso escribí UN problema por línea, numerados ("1. ...\\n2. ..."), en el MISMO orden en ambos campos (el punto 2 de observed se corresponde con el punto 2 de expected), y poné "problemCount" con la cantidad de defectos. Si es UN solo bug (aunque tenga varios pasos), "observed"/"expected" en una sola línea SIN numerar y "problemCount": 1.
- No inventes archivos, rutas, roles ni endpoints.
- Si recibís capturas, usalas solo para extraer hechos visibles: texto de errores, pantalla afectada, estado de UI, campos, botones y diferencias visibles. No inventes nada que no esté en el texto o en la imagen.
- "steps" en orden lógico, con los pasos que el reporte mencione. Si no hay pasos, dejá [].

CATEGORÍAS:
- frontend: UI, CSS, navegación, formularios, validaciones de cliente
- backend: API, lógica de servidor, auth, jobs
- database: queries, índices, integridad de datos
- config: variables de entorno, docker, permisos
- data: datos corruptos como input
- otro: no encaja claramente en las anteriores

SEVERIDAD:
- critical: sistema caído / pérdida de datos / seguridad
- high: funcionalidad clave rota sin workaround
- medium: secundaria afectada o con workaround
- low: cosmético / menor

Respondé SOLO el JSON.`

// ─── Relevant doc section extractor ─────────────────────────────────────────
// Un doc puede documentar 7-8 bugs. Tomar los primeros chars puede traer la
// sección de otro bug. Ventana deslizante de párrafos para hallar la sección
// con más señal sobre el bug actual (por título, descripción y columnas).

export function extractRelevantDocSection(bug: RawBug, docText: string, maxChars = 2000): string {
  const paragraphs = docText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 15)

  if (paragraphs.length <= 5) return docText.slice(0, maxChars)

  const titleTerms = bug.title
    .toLowerCase()
    .split(/[\s/\-_]+/)
    .filter((w) => w.length > 3)
  const descTerms = bug.description
    .toLowerCase()
    .split(/[\s/\-_]+/)
    .filter((w) => w.length > 3)
  const rowTerms = Object.values(bug.rawRow)
    .flatMap((v: string) => v.toLowerCase().split(/[\s/\-_.,;]+/))
    .filter((w: string) => w.length > 3)

  const scores = paragraphs.map((p) => {
    const lp = p.toLowerCase()
    let score = 0
    if (lp.includes(bug.title.toLowerCase())) score += 10
    for (const t of titleTerms) if (lp.includes(t)) score += 2
    for (const t of descTerms) if (lp.includes(t)) score += 1
    for (const t of rowTerms) if (lp.includes(t)) score += 1
    return score
  })

  const W = 4
  let bestStart = 0,
    bestScore = -1
  for (let i = 0; i <= paragraphs.length - W; i++) {
    const ws = scores.slice(i, i + W).reduce((a, b) => a + b, 0)
    if (ws > bestScore) {
      bestScore = ws
      bestStart = i
    }
  }

  if (bestScore < 2) return docText.slice(0, maxChars)

  const startIdx = Math.max(0, bestStart - 1)
  const result: string[] = []
  let total = 0
  for (let i = startIdx; i < paragraphs.length && total < maxChars; i++) {
    result.push(paragraphs[i])
    total += paragraphs[i].length + 2
  }

  return result.join('\n\n').slice(0, maxChars)
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

const MAX_IMAGES_FOR_ANALYSIS = 3

interface AnalysisRequest {
  prompt: string
  images: string[]
}

function collectAnalysisImages(enriched: EnrichedBug): string[] {
  return enriched.googleDocs
    .filter((d) => d.accessible)
    .flatMap((d) => d.images ?? [])
    .filter((img) => img.data && img.mimeType.startsWith('image/'))
    .slice(0, MAX_IMAGES_FOR_ANALYSIS)
    .map((img) => img.data)
}

function hasAnalysisImages(enriched: EnrichedBug): boolean {
  return collectAnalysisImages(enriched).length > 0
}

export function selectLLMConfigForBug(enriched: EnrichedBug, config: LLMConfig): LLMConfig {
  if (config.provider !== 'ollama') return config
  if (!config.visionModel?.trim()) return config
  if (!hasAnalysisImages(enriched)) return config
  return { ...config, model: config.visionModel.trim() }
}

function buildAnalysisRequest(enriched: EnrichedBug, config: LLMConfig): AnalysisRequest {
  const { raw, googleDocs } = enriched
  const sections: string[] = []
  const images =
    config.provider === 'ollama' && config.visionModel && config.model === config.visionModel
      ? collectAnalysisImages(enriched)
      : []

  sections.push('=== BUG REPORTADO (fuente: excel) ===')
  sections.push(`Título: ${raw.title}`)
  if (raw.description) sections.push(`Descripción: ${raw.description}`)
  if (raw.stepsToReproduce) sections.push(`Pasos: ${raw.stepsToReproduce}`)
  if (raw.expectedResult) sections.push(`Esperado: ${raw.expectedResult}`)
  if (raw.actualResult) sections.push(`Actual: ${raw.actualResult}`)
  if (raw.environment) sections.push(`Entorno: ${raw.environment}`)

  const knownFields = new Set([
    'Título',
    'Title',
    'Summary',
    'Descripción',
    'Description',
    'Pasos',
    'Steps',
    'Esperado',
    'Expected',
    'Actual',
    'Entorno',
    'Environment',
  ])
  const extraCols = Object.entries(raw.rawRow).filter(
    ([k, v]) => !knownFields.has(k) && v && v.trim(),
  )
  for (const [k, v] of extraCols.slice(0, 6)) {
    sections.push(`${k}: ${String(v).slice(0, 200)}`)
  }

  const accessible = googleDocs.filter((d) => d.accessible)
  if (accessible.length > 0) {
    sections.push('\n=== DOCUMENTO (sección relevante al bug) ===')
    for (const doc of accessible) {
      sections.push(extractRelevantDocSection(raw, doc.text))
      const imgCount = doc.images?.length ?? 0
      if (imgCount > 0) {
        sections.push(
          images.length > 0
            ? `[El documento tiene ${imgCount} captura(s); se enviaron hasta ${MAX_IMAGES_FOR_ANALYSIS} al modelo de visión.]`
            : `[El documento tiene ${imgCount} captura(s) adjunta(s), pero este modelo no las recibe.]`,
        )
      }
    }
  }

  sections.push('\nClasificá y reescribí el bug. Solo JSON.')
  return { prompt: sections.join('\n'), images }
}

// ─── LLM calls ─────────────────────────────────────────────────────────────────

const MAX_TOKENS = 1024

async function callOllama(request: AnalysisRequest, config: LLMConfig): Promise<string> {
  const baseUrl = config.baseUrl ?? 'http://localhost:11434'
  const model = config.model ?? 'qwen2.5:7b'
  const userMessage =
    request.images.length > 0
      ? { role: 'user', content: request.prompt, images: request.images }
      : { role: 'user', content: request.prompt }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { temperature: 0.1, num_predict: MAX_TOKENS },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, userMessage],
    }),
    signal: AbortSignal.timeout(
      resolveOllamaTimeoutMs({ performanceMode: config.performanceMode }),
    ),
  })

  if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`)
  const data = (await response.json()) as { message?: { content: string } }
  return (data.message?.content ?? '').trim()
}

async function callCloud(request: AnalysisRequest, config: LLMConfig): Promise<string> {
  const { prompt } = request
  if (config.provider === 'anthropic') {
    if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
    const { Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: config.apiKey })
    const msg = await client.messages.create({
      model: config.model ?? 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    })
    const block = msg.content[0]
    if (block?.type !== 'text') throw new Error('Anthropic: respuesta vacía')
    return block.text.trim()
  }

  if (config.provider === 'gemini') {
    if (!config.apiKey) throw new Error('GEMINI_API_KEY no configurada')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({
      model: config.model ?? 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: MAX_TOKENS,
        responseMimeType: 'application/json',
      },
    })
    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  }

  if (config.provider === 'openai') {
    if (!config.apiKey) throw new Error('OPENAI_API_KEY no configurada')
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: config.apiKey })
    const completion = await client.chat.completions.create({
      model: config.model ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
    })
    return (completion.choices[0]?.message.content ?? '').trim()
  }

  throw new Error(`Provider no soportado: ${config.provider}`)
}

// ─── Parse / validate ──────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(['frontend', 'backend', 'database', 'config', 'data', 'otro'])
const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical'])

function extractJSON(text: string): string {
  const stripped = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  return start !== -1 && end !== -1 ? stripped.slice(start, end + 1) : stripped
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x)).filter((s) => s.trim().length > 0)
}

// Cuenta los ítems numerados ("1.", "2)", …) al inicio de línea. Usado para
// derivar problemCount del texto reescrito en vez de confiar en el número que
// reporta el modelo (a veces no coincide con la lista que escribe).
function countNumberedItems(text: string): number {
  return (text.match(/^\s*\d+[.)]\s/gm) ?? []).length
}

function validate(obj: unknown, rawResponse: string): BugAnalysis {
  if (typeof obj !== 'object' || obj === null) throw new Error('Respuesta no es JSON')
  const o = obj as Record<string, unknown>

  const category = VALID_CATEGORIES.has(String(o['category'])) ? String(o['category']) : 'otro'
  const severity = VALID_SEVERITIES.has(String(o['severity'])) ? String(o['severity']) : 'medium'

  const rawConf = Number(o['confidence'])
  const confidence = Number.isFinite(rawConf) ? Math.min(1, Math.max(0, rawConf)) : 0.5

  const r =
    o['rewritten'] && typeof o['rewritten'] === 'object'
      ? (o['rewritten'] as Record<string, unknown>)
      : {}

  const observed = String(r['observed'] ?? 'No informado')
  const expected = String(r['expected'] ?? 'No informado')

  return {
    category: category as BugAnalysis['category'],
    severity: severity as BugAnalysis['severity'],
    bugType: o['bugType'] ? String(o['bugType']) : undefined,
    confidence,
    affectedArea: String(o['affectedArea'] ?? 'No informado'),
    summary: String(o['summary'] ?? ''),
    rewritten: {
      observed,
      expected,
      steps: toStringArray(r['steps']),
      environment: String(r['environment'] ?? 'No informado'),
      // Derivado del TEXTO (líneas numeradas), no del problemCount del modelo:
      // así el badge "N problemas" siempre coincide con la lista que se ve.
      problemCount: Math.max(1, countNumberedItems(observed), countNumberedItems(expected)),
    },
    missingInformation: toStringArray(o['missingInformation']),
    rawResponse,
  }
}

/**
 * Parsea la respuesta cruda del LLM a un BugAnalysis. Tolera ```fences```, texto
 * antes/después del JSON, campos faltantes o inválidos (cae a defaults). Exportado
 * para tests — es el mismo camino que usa analyzeBug.
 */
export function parseAnalysis(raw: string): BugAnalysis {
  return validate(JSON.parse(extractJSON(raw)), raw)
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Clasifica y reescribe un bug. Con cacheDir, verifica cache antes de llamar al LLM.
 */
export async function analyzeBug(
  enriched: EnrichedBug,
  config: LLMConfig,
  cacheDir?: string,
): Promise<{ analysis: BugAnalysis; fromCache: boolean }> {
  const effectiveConfig = selectLLMConfigForBug(enriched, config)

  if (cacheDir) {
    const cached = loadCachedAnalysis(makeCacheKey(enriched, effectiveConfig), cacheDir)
    if (cached) return { analysis: cached, fromCache: true }
  }

  const request = buildAnalysisRequest(enriched, effectiveConfig)

  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw =
        effectiveConfig.provider === 'ollama'
          ? await callOllama(request, effectiveConfig)
          : await callCloud(request, effectiveConfig)
      const analysis = parseAnalysis(raw)

      if (cacheDir) saveCachedAnalysis(makeCacheKey(enriched, effectiveConfig), cacheDir, analysis)
      return { analysis, fromCache: false }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      if (attempt === 1) await new Promise((r) => setTimeout(r, 500))
    }
  }

  throw lastErr ?? new Error('analyzeBug: failed after retries')
}
