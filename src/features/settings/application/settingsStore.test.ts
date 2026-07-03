import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appSettingsPath,
  loadAppSettings,
  saveAppSettings,
  settingsToSupabaseTeamConfig,
} from './settingsStore.js'

const tempDirs: string[] = []

function makeTempSettingsPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-settings-'))
  tempDirs.push(dir)
  return appSettingsPath(dir)
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('settingsStore', () => {
  it('carga defaults desde env cuando no existe settings.json', () => {
    const configPath = makeTempSettingsPath()
    const settings = loadAppSettings(configPath, {
      LLM_PERFORMANCE_MODE: 'cpu',
      OLLAMA_MODEL: 'qwen-test',
      EXTERNAL_AGENT_WORKING_DIRECTORY: 'C:/repo',
    })

    expect(settings.performanceMode).toBe('cpu')
    expect(settings.llmModel).toBe('qwen-test')
    expect(settings.externalAgentRepositories).toEqual([{ path: 'C:/repo', branch: '' }])
  })

  it('normaliza timeout y migra working directory legacy a repositorios', () => {
    const configPath = makeTempSettingsPath()
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        externalAgentTimeoutMs: 1000,
        externalAgentWorkingDirectory: 'C:/legacy-repo',
      }),
    )

    const settings = loadAppSettings(configPath, {})

    expect(settings.externalAgentTimeoutMs).toBe(20 * 60 * 1000)
    expect(settings.externalAgentWorkingDirectory).toBe('C:/legacy-repo')
    expect(settings.externalAgentRepositories).toEqual([{ path: 'C:/legacy-repo', branch: '' }])
  })

  it('guarda patches preservando defaults y proyecta config de Supabase', () => {
    const configPath = makeTempSettingsPath()

    saveAppSettings(
      configPath,
      {
        supabaseUrl: 'https://example.supabase.co',
        supabasePublishableKey: 'pub',
        supabaseActiveProjectId: 'project-1',
      },
      {},
    )

    const settings = loadAppSettings(configPath, {})

    expect(settingsToSupabaseTeamConfig(settings)).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'pub',
      defaultProjectSlug: 'buglens-default',
      defaultProjectName: 'buglens',
      activeProjectId: 'project-1',
    })
  })
})
