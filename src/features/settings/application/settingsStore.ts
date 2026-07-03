import {
  childJsonFilePath,
  readJsonFile,
  writeJsonFile,
} from '../../../platform/filesystem/jsonFileStore.js'
import type { ExternalAgentRepository } from '../../../shared/contracts/externalAgentTypes.js'
import type { PerformanceMode } from '../../../shared/contracts/settingsTypes.js'
import type { SupabaseTeamConfig } from '../../projects/infrastructure/teamClient.js'

export interface AppSettings {
  googleClientId: string
  googleClientSecret: string
  llmProvider: string
  llmModel: string
  llmVisionModel: string
  ollamaBaseUrl: string
  performanceMode: PerformanceMode
  supabaseUrl: string
  supabasePublishableKey: string
  supabaseDefaultProjectSlug: string
  supabaseDefaultProjectName: string
  supabaseActiveProjectId: string
  externalAgentCommand: string
  externalAgentTimeoutMs: number
  externalAgentWorkingDirectory: string
  externalAgentRepositories: ExternalAgentRepository[]
  onboarded: boolean
}

export function appSettingsPath(userDataPath: string): string {
  return childJsonFilePath(userDataPath, 'settings.json')
}

function normalizeExternalAgentTimeoutMs(value: unknown): number {
  const fallback = 20 * 60 * 1000
  const timeoutMs = Number(value)
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60 * 1000) return fallback
  return timeoutMs
}

function normalizeExternalAgentRepositories(
  value: unknown,
  legacyWorkingDirectory?: string,
): ExternalAgentRepository[] {
  const repositories = Array.isArray(value)
    ? value
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const repo = item as Partial<ExternalAgentRepository>
          return {
            path: typeof repo.path === 'string' ? repo.path.trim() : '',
            branch: typeof repo.branch === 'string' ? repo.branch.trim() : '',
          }
        })
        .filter((repo): repo is ExternalAgentRepository => Boolean(repo?.path))
    : []
  if (repositories.length > 0) return repositories
  const legacyPath = legacyWorkingDirectory?.trim()
  return legacyPath ? [{ path: legacyPath, branch: '' }] : []
}

function defaultSettings(env: NodeJS.ProcessEnv): AppSettings {
  return {
    googleClientId: env['GOOGLE_CLIENT_ID'] ?? '',
    googleClientSecret: env['GOOGLE_CLIENT_SECRET'] ?? '',
    llmProvider: env['LLM_PROVIDER'] ?? 'ollama',
    llmModel: env['LLM_MODEL'] ?? env['OLLAMA_MODEL'] ?? 'qwen2.5:7b',
    llmVisionModel: env['LLM_VISION_MODEL'] ?? env['OLLAMA_VISION_MODEL'] ?? 'qwen2.5vl:7b',
    ollamaBaseUrl: env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
    performanceMode: env['LLM_PERFORMANCE_MODE'] === 'cpu' ? 'cpu' : 'gpu',
    supabaseUrl: env['SUPABASE_URL'] ?? '',
    supabasePublishableKey: env['SUPABASE_PUBLISHABLE_KEY'] ?? env['SUPABASE_ANON_KEY'] ?? '',
    supabaseDefaultProjectSlug: env['SUPABASE_DEFAULT_PROJECT_SLUG'] ?? 'buglens-default',
    supabaseDefaultProjectName: env['SUPABASE_DEFAULT_PROJECT_NAME'] ?? 'buglens',
    supabaseActiveProjectId: env['SUPABASE_ACTIVE_PROJECT_ID'] ?? '',
    externalAgentCommand: env['EXTERNAL_AGENT_COMMAND'] ?? '',
    externalAgentTimeoutMs: normalizeExternalAgentTimeoutMs(env['EXTERNAL_AGENT_TIMEOUT_MS']),
    externalAgentWorkingDirectory: env['EXTERNAL_AGENT_WORKING_DIRECTORY'] ?? '',
    externalAgentRepositories: normalizeExternalAgentRepositories(
      undefined,
      env['EXTERNAL_AGENT_WORKING_DIRECTORY'],
    ),
    onboarded: false,
  }
}

export function loadAppSettings(configPath: string, env: NodeJS.ProcessEnv): AppSettings {
  const defaults = defaultSettings(env)
  const saved = readJsonFile(configPath)
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults

  const settings = { ...defaults, ...(saved as Partial<AppSettings>) }
  settings.externalAgentTimeoutMs = normalizeExternalAgentTimeoutMs(settings.externalAgentTimeoutMs)
  settings.externalAgentRepositories = normalizeExternalAgentRepositories(
    settings.externalAgentRepositories,
    settings.externalAgentWorkingDirectory,
  )
  settings.externalAgentWorkingDirectory = settings.externalAgentRepositories[0]?.path ?? ''
  return settings
}

export function saveAppSettings(
  configPath: string,
  patch: Partial<AppSettings>,
  env: NodeJS.ProcessEnv,
): void {
  const current = loadAppSettings(configPath, env)
  const updated = { ...current, ...patch }
  writeJsonFile(configPath, updated)
}

export function settingsToSupabaseTeamConfig(settings: AppSettings): SupabaseTeamConfig {
  return {
    url: settings.supabaseUrl,
    publishableKey: settings.supabasePublishableKey,
    defaultProjectSlug: settings.supabaseDefaultProjectSlug,
    defaultProjectName: settings.supabaseDefaultProjectName,
    activeProjectId: settings.supabaseActiveProjectId || undefined,
  }
}
