import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyzedBug } from '../../../shared/contracts/bugTypes.js'
import type { LLMConfig } from '../../../shared/contracts/settingsTypes.js'
import {
  createRemoteBugImport,
  type RemoteAnalysisContext,
  type RemoteBugImportInput,
  saveRemoteAnalysisResult,
} from '../infrastructure/teamBugs.js'
import type { SupabaseTeamConfig } from '../infrastructure/teamClient.js'

interface ProjectAnalysisRunDeps {
  createImport?: typeof createRemoteBugImport
  saveAnalysisResult?: typeof saveRemoteAnalysisResult
}

export interface ProjectAnalysisRun {
  context: RemoteAnalysisContext
  saveResult(result: AnalyzedBug, analysisConfig?: LLMConfig): Promise<unknown>
}

export function saveProjectAnalysisResult(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  result: AnalyzedBug,
  context: RemoteAnalysisContext,
): Promise<string> {
  return saveRemoteAnalysisResult(client, config, result, context)
}

export async function startProjectAnalysisRun(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  input: RemoteBugImportInput,
  llmConfig: LLMConfig,
  deps: ProjectAnalysisRunDeps = {},
): Promise<ProjectAnalysisRun> {
  const createImport = deps.createImport ?? createRemoteBugImport
  const saveAnalysisResult = deps.saveAnalysisResult ?? saveProjectAnalysisResult
  const importId = await createImport(client, config, input)
  const context: RemoteAnalysisContext = {
    importId,
    sourceType: input.sourceType,
    provider: llmConfig.provider,
    model: llmConfig.model,
  }

  return {
    context,
    saveResult: (result, analysisConfig) =>
      saveAnalysisResult(client, config, result, {
        ...context,
        model: analysisConfig?.model ?? context.model,
      }),
  }
}
