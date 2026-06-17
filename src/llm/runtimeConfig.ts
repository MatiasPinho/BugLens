import type { LLMProvider, PerformanceMode } from '../types/index.js'

// ─── Runtime tunables (overridables por env) ────────────────────────────────────
//
// Pensados para CPU-only (sin GPU): ahí conviene bajar el paralelismo (los workers
// compiten por los mismos cores) y subir el timeout (la inferencia es mucho más lenta).
//
// Precedencia de cada valor: env var explícita > perfil del modo de rendimiento >
// default del proveedor. La env var siempre gana (override de máxima prioridad).

/** Timeout por defecto de una llamada a Ollama, en ms (modo GPU). */
export const DEFAULT_OLLAMA_TIMEOUT_MS = 90_000

/** En CPU la inferencia es mucho más lenta → más margen antes de abortar. */
export const CPU_OLLAMA_TIMEOUT_MS = 240_000

/** Paralelismo por defecto por proveedor. Cloud tolera más; Ollama queuea internamente. */
export const DEFAULT_CONCURRENCY: Record<LLMProvider, number> = {
  anthropic: 8,
  openai: 8,
  gemini: 3,
  ollama: 3,
}

/** En CPU N workers compiten por los mismos cores → serie es más rápido por bug. */
export const CPU_CONCURRENCY = 1

const FALLBACK_CONCURRENCY = 2

interface ResolveOptions {
  env?: NodeJS.ProcessEnv
  performanceMode?: PerformanceMode
}

/** Parsea un entero positivo desde un string de env; cae al fallback si es inválido. */
export function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

/**
 * Timeout de Ollama en ms. Precedencia: `OLLAMA_TIMEOUT_MS` > perfil del modo > default.
 */
export function resolveOllamaTimeoutMs({
  env = process.env,
  performanceMode,
}: ResolveOptions = {}): number {
  const profileDefault =
    performanceMode === 'cpu' ? CPU_OLLAMA_TIMEOUT_MS : DEFAULT_OLLAMA_TIMEOUT_MS
  return parsePositiveIntEnv(env['OLLAMA_TIMEOUT_MS'], profileDefault)
}

/**
 * Paralelismo de bugs simultáneos. Precedencia: `LLM_CONCURRENCY` (override global, aplica
 * a cualquier proveedor) > perfil del modo (cpu → 1) > default del proveedor.
 */
export function resolveConcurrency(
  provider: LLMProvider,
  { env = process.env, performanceMode }: ResolveOptions = {},
): number {
  const profileDefault =
    performanceMode === 'cpu'
      ? CPU_CONCURRENCY
      : (DEFAULT_CONCURRENCY[provider] ?? FALLBACK_CONCURRENCY)
  return parsePositiveIntEnv(env['LLM_CONCURRENCY'], profileDefault)
}
