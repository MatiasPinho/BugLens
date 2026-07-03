import {
  ensureOllamaRunning,
  type OllamaStartupResult,
} from '../../../platform/ollama/ollamaService.js'
import type { HardwareProbe } from '../../../shared/contracts/settingsTypes.js'

interface OllamaPsModel {
  name: string
  model?: string
  size?: number
  size_vram?: number
}

interface ProbeHardwareDeps {
  ensureRunning?: (baseUrl: string) => Promise<OllamaStartupResult>
  fetch?: typeof fetch
}

export async function probeHardware(
  baseUrl: string,
  model: string,
  deps: ProbeHardwareDeps = {},
): Promise<HardwareProbe> {
  const ensureRunning = deps.ensureRunning ?? ensureOllamaRunning
  const fetchFn = deps.fetch ?? fetch
  const running = await ensureRunning(baseUrl)

  if (!running.started && !running.alreadyRunning) {
    return { accelerator: 'unknown', detail: 'Ollama no esta disponible (instalalo y reintenta)' }
  }

  try {
    const tags = await fetchFn(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    const data = (await tags.json()) as { models?: Array<{ name: string }> }
    const names = data.models?.map((item) => item.name) ?? []
    const isDownloaded = names.some(
      (name) => name === model || name.split(':')[0] === model.split(':')[0],
    )
    if (!isDownloaded) {
      return { accelerator: 'unknown', detail: `El modelo "${model}" no esta descargado todavia` }
    }
  } catch {
    return { accelerator: 'unknown', detail: 'No se pudo consultar Ollama' }
  }

  try {
    await fetchFn(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'hi', stream: false, options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch {
    return { accelerator: 'unknown', detail: 'No se pudo cargar el modelo para el sondeo' }
  }

  try {
    const ps = await fetchFn(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(5000) })
    const data = (await ps.json()) as { models?: OllamaPsModel[] }
    const loaded =
      data.models?.find((item) => (item.model ?? item.name) === model || item.name === model) ??
      data.models?.[0]

    if (!loaded) {
      return { accelerator: 'unknown', detail: 'Ollama no reporto el modelo cargado', model }
    }

    if ((loaded.size_vram ?? 0) > 0) {
      return { accelerator: 'gpu', detail: 'El modelo corre en la GPU', model }
    }

    return {
      accelerator: 'cpu',
      detail: 'El modelo corre en CPU - el analisis sera lento y puede cortar por timeout',
      model,
    }
  } catch {
    return { accelerator: 'unknown', detail: 'No se pudo leer el estado de Ollama', model }
  }
}
