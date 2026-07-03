import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const OPENCODE_BIG_PICKLE_MODEL = 'opencode/big-pickle'

interface ShellResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface OpenCodeStatus {
  installed: boolean
  version?: string
  hasBigPickle: boolean
  model: string
  commandPath?: string
  pathAdded?: string[]
  error?: string
}

export interface OpenCodeRepairResult extends OpenCodeStatus {
  ok: boolean
  installedPackage?: boolean
  output?: string
}

function splitPathEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueExistingDirs(dirs: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  return dirs
    .filter((dir): dir is string => Boolean(dir?.trim()))
    .map((dir) => path.resolve(dir))
    .filter((dir) => {
      if (!fs.existsSync(dir)) return false
      const key = process.platform === 'win32' ? dir.toLowerCase() : dir
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function commonNodeBinDirs(): string[] {
  const env = process.env
  const home = env['USERPROFILE'] ?? env['HOME']
  return uniqueExistingDirs([
    env['APPDATA'] ? path.join(env['APPDATA'], 'npm') : undefined,
    env['LOCALAPPDATA'] ? path.join(env['LOCALAPPDATA'], 'Programs', 'nodejs') : undefined,
    env['ProgramFiles'] ? path.join(env['ProgramFiles'], 'nodejs') : undefined,
    env['ProgramFiles(x86)'] ? path.join(env['ProgramFiles(x86)'], 'nodejs') : undefined,
    home ? path.join(home, 'AppData', 'Roaming', 'npm') : undefined,
    home ? path.join(home, '.npm-global', 'bin') : undefined,
    home ? path.join(home, '.local', 'bin') : undefined,
    'C:\\nvm4w\\nodejs',
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ])
}

function prependToProcessPath(dirs: string[]): string[] {
  const current = splitPathEnv(process.env['PATH'])
  const currentKeys = new Set(
    current.map((item) => (process.platform === 'win32' ? item.toLowerCase() : item)),
  )
  const added = dirs.filter((dir) => {
    const key = process.platform === 'win32' ? dir.toLowerCase() : dir
    return !currentKeys.has(key)
  })
  if (added.length > 0) {
    process.env['PATH'] = [...added, ...current].join(path.delimiter)
  }
  return added
}

function runShell(command: string, timeoutMs = 30_000): Promise<ShellResult> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const child = cp.spawn(command, {
      shell: process.env['SHELL'] || process.env['ComSpec'],
      windowsHide: true,
      env: process.env,
    })
    const timeout = setTimeout(() => {
      if (!settled) child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve({ ok: false, stdout, stderr: stderr || err.message, exitCode: null })
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve({ ok: code === 0, stdout, stderr, exitCode: code })
    })
  })
}

async function detectOpenCodePath(): Promise<string | undefined> {
  const result = await runShell(
    process.platform === 'win32' ? 'where opencode' : 'command -v opencode',
  )
  return result.ok ? result.stdout.trim().split(/\r?\n/)[0]?.trim() : undefined
}

async function getOpenCodeStatus(pathAdded: string[] = []): Promise<OpenCodeStatus> {
  const versionResult = await runShell('opencode --version')
  if (!versionResult.ok) {
    return {
      installed: false,
      hasBigPickle: false,
      model: OPENCODE_BIG_PICKLE_MODEL,
      pathAdded,
      error: (
        versionResult.stderr ||
        versionResult.stdout ||
        'OpenCode no esta disponible.'
      ).trim(),
    }
  }

  const modelsResult = await runShell('opencode models opencode', 60_000)
  const modelsOutput = `${modelsResult.stdout}\n${modelsResult.stderr}`
  const hasBigPickle = modelsOutput.includes(OPENCODE_BIG_PICKLE_MODEL)
  return {
    installed: true,
    version: versionResult.stdout.trim().split(/\s+/)[0],
    hasBigPickle,
    model: OPENCODE_BIG_PICKLE_MODEL,
    commandPath: await detectOpenCodePath(),
    pathAdded,
    error: hasBigPickle
      ? undefined
      : `OpenCode esta instalado, pero no lista ${OPENCODE_BIG_PICKLE_MODEL}. Actualiza OpenCode o revisa providers.`,
  }
}

export async function checkOpenCode(): Promise<OpenCodeStatus> {
  const added = prependToProcessPath(commonNodeBinDirs())
  return getOpenCodeStatus(added)
}

export async function repairOpenCode(): Promise<OpenCodeRepairResult> {
  const added = prependToProcessPath(commonNodeBinDirs())
  let status = await getOpenCodeStatus(added)
  if (status.installed && status.hasBigPickle) return { ...status, ok: true }

  const npmResult = await runShell('npm install -g opencode-ai', 180_000)
  const addedAfterInstall = prependToProcessPath(commonNodeBinDirs())
  status = await getOpenCodeStatus([...added, ...addedAfterInstall])
  return {
    ...status,
    ok: status.installed && status.hasBigPickle,
    installedPackage: npmResult.ok,
    output: [npmResult.stdout.trim(), npmResult.stderr.trim()].filter(Boolean).join('\n'),
    error:
      status.error ??
      (npmResult.ok
        ? undefined
        : (npmResult.stderr || npmResult.stdout || 'No se pudo instalar OpenCode.').trim()),
  }
}
