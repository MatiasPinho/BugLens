import type { SupabaseClient } from '@supabase/supabase-js'
import { bugRecordKey } from '../pipeline/bugStatusKey.js'
import type {
  AnalyzedBug,
  BugAnalysis,
  BugStatus,
  GoogleDocContent,
  RawBug,
} from '../types/index.js'
import type { SupabaseTeamConfig } from './teamClient.js'
import { getSupabaseTeamStatus } from './teamClient.js'

interface StatusRpcRow {
  bug_id: string
  status: BugStatus
}

interface RemoteBugRow {
  rawBug?: Partial<RawBug>
  analysis?: Partial<BugAnalysis>
  googleDocs?: GoogleDocContent[]
  status?: BugStatus
  error?: string | null
  processingMs?: number | null
}

export interface RemoteBugImportInput {
  sourceType: 'excel' | 'manual'
  sourceName?: string
  sourcePath?: string
  rowCount: number
  metadata?: Record<string, unknown>
}

export interface RemoteAnalysisContext {
  importId: string | null
  sourceType: 'excel' | 'manual'
  provider?: string
  model?: string
  promptVersion?: string
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function toRawBug(row: RemoteBugRow, fallbackId: string): RawBug {
  const raw = row.rawBug ?? {}
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : fallbackId,
    rowIndex: typeof raw.rowIndex === 'number' ? raw.rowIndex : 0,
    title: typeof raw.title === 'string' && raw.title.length > 0 ? raw.title : 'Bug sin título',
    description: typeof raw.description === 'string' ? raw.description : '',
    stepsToReproduce: typeof raw.stepsToReproduce === 'string' ? raw.stepsToReproduce : undefined,
    expectedResult: typeof raw.expectedResult === 'string' ? raw.expectedResult : undefined,
    actualResult: typeof raw.actualResult === 'string' ? raw.actualResult : undefined,
    environment: typeof raw.environment === 'string' ? raw.environment : undefined,
    reporter: typeof raw.reporter === 'string' ? raw.reporter : undefined,
    assignee: typeof raw.assignee === 'string' ? raw.assignee : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    priority: typeof raw.priority === 'string' ? raw.priority : undefined,
    rawRow:
      raw.rawRow && typeof raw.rawRow === 'object' ? (raw.rawRow as Record<string, string>) : {},
    googleDocLinks: stringArray(raw.googleDocLinks),
  }
}

function toAnalysis(row: RemoteBugRow, raw: RawBug): BugAnalysis {
  const analysis = row.analysis ?? {}
  const rewritten: Partial<BugAnalysis['rewritten']> = analysis.rewritten ?? {}
  return {
    category: analysis.category ?? 'otro',
    severity: analysis.severity ?? 'low',
    bugType: analysis.bugType,
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0,
    affectedArea: analysis.affectedArea ?? 'No informado',
    summary: analysis.summary ?? raw.title,
    rewritten: {
      observed: rewritten.observed ?? raw.description,
      expected: rewritten.expected ?? 'No informado',
      steps: stringArray(rewritten.steps),
      environment: rewritten.environment ?? 'No informado',
      problemCount: typeof rewritten.problemCount === 'number' ? rewritten.problemCount : 1,
    },
    missingInformation: stringArray(analysis.missingInformation),
    rawResponse: analysis.rawResponse ?? '',
  }
}

export function mapRemoteBugRow(row: RemoteBugRow, index: number): AnalyzedBug {
  const raw = toRawBug(row, `remote-${index + 1}`)
  return {
    enriched: {
      raw,
      googleDocs: Array.isArray(row.googleDocs) ? row.googleDocs : [],
    },
    analysis: toAnalysis(row, raw),
    status: row.status ?? 'nuevo',
    error: row.error ?? undefined,
    processingMs: typeof row.processingMs === 'number' ? row.processingMs : 0,
  }
}

export async function loadRemoteAnalyzedBugs(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
): Promise<AnalyzedBug[]> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client.rpc('list_project_bugs', {
    target_project_id: teamStatus.project.id,
    result_limit: 500,
  })

  if (error) throw error
  const rows = Array.isArray(data) ? (data as RemoteBugRow[]) : []
  return rows.map(mapRemoteBugRow)
}

export async function createRemoteBugImport(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  input: RemoteBugImportInput,
): Promise<string> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client.rpc('create_bug_import', {
    target_project_id: teamStatus.project.id,
    input_source_type: input.sourceType,
    input_source_name: input.sourceName ?? null,
    input_source_path: input.sourcePath ?? null,
    input_row_count: input.rowCount,
    input_metadata: input.metadata ?? {},
  })

  if (error) throw error
  return data as string
}

export async function saveRemoteAnalysisResult(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  result: AnalyzedBug,
  context: RemoteAnalysisContext,
): Promise<string> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const raw = result.enriched.raw
  const { data, error } = await client.rpc('save_analysis_result', {
    target_project_id: teamStatus.project.id,
    input_source_type: context.sourceType,
    input_source_row_index: raw.rowIndex,
    input_source_bug_id: raw.id,
    target_import_id: context.importId,
    target_content_key: bugRecordKey(raw),
    target_status: result.status,
    input_raw_bug: raw,
    input_google_doc_links: raw.googleDocLinks,
    input_enriched_docs: result.enriched.googleDocs,
    input_analysis: result.analysis,
    input_provider: context.provider ?? null,
    input_model: context.model ?? null,
    input_prompt_version: context.promptVersion ?? null,
    input_error: result.error ?? null,
    input_processing_ms: result.processingMs,
  })

  if (error) throw error
  return data as string
}

export async function setRemoteBugStatus(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  raw: Pick<RawBug, 'title' | 'description'>,
  status: BugStatus,
): Promise<{ bugId: string; status: BugStatus }> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client
    .rpc('upsert_bug_status', {
      target_project_id: teamStatus.project.id,
      target_content_key: bugRecordKey(raw),
      bug_title: raw.title,
      bug_description: raw.description,
      next_status: status,
    })
    .single()

  if (error) throw error
  const row = data as StatusRpcRow
  return { bugId: row.bug_id, status: row.status }
}

export async function deleteRemoteBug(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  raw: Pick<RawBug, 'title' | 'description'>,
): Promise<string> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client.rpc('delete_project_bug', {
    target_project_id: teamStatus.project.id,
    target_content_key: bugRecordKey(raw),
  })

  if (error) throw error
  return data as string
}
