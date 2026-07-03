import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface OllamaStartupResult {
  started: boolean
  alreadyRunning: boolean
}

export interface OllamaAvailability {
  available: boolean
  models: string[]
}

let ollamaProcess: cp.ChildProcess | null = null

export function findOllamaBin(env: NodeJS.ProcessEnv = process.env): string | null {
  const candidates: Array<string | null | undefined> = [env['OLLAMA_BIN']]

  if (process.platform === 'win32') {
    const localApp = env['LOCALAPPDATA']
    const programFiles = env['ProgramFiles']
    candidates.push(
      localApp ? path.join(localApp, 'Programs', 'Ollama', 'ollama.exe') : null,
      programFiles ? path.join(programFiles, 'Ollama', 'ollama.exe') : null,
    )
  } else {
    candidates.push(
      env['HOME'] ? path.join(env['HOME'], '.local', 'bin', 'ollama') : null,
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
      '/opt/homebrew/bin/ollama',
    )
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  return null
}

export async function pingOllama(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function checkOllamaAvailability(baseUrl: string): Promise<OllamaAvailability> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return { available: false, models: [] }
    const data = (await response.json()) as { models?: Array<{ name: string }> }
    return { available: true, models: data.models?.map((model) => model.name) ?? [] }
  } catch {
    return { available: false, models: [] }
  }
}

export async function ensureOllamaRunning(
  baseUrl: string,
  onLog?: (message: string) => void,
): Promise<OllamaStartupResult> {
  if (await pingOllama(baseUrl)) return { started: false, alreadyRunning: true }

  const bin = findOllamaBin()
  if (!bin) return { started: false, alreadyRunning: false }

  onLog?.(`Levantando Ollama: ${bin}`)
  ollamaProcess = cp.spawn(bin, ['serve'], {
    detached: false,
    stdio: 'ignore',
    env: {
      ...process.env,
      ...(process.platform === 'linux' ? { HSA_OVERRIDE_GFX_VERSION: '10.3.0' } : {}),
      OLLAMA_NUM_PARALLEL: '3',
    },
  })
  ollamaProcess.unref()

  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    if (await pingOllama(baseUrl)) {
      onLog?.('Ollama levantado correctamente')
      return { started: true, alreadyRunning: false }
    }
  }

  return { started: false, alreadyRunning: false }
}

export function stopManagedOllama(): void {
  if (!ollamaProcess) return
  ollamaProcess.kill()
  ollamaProcess = null
}
