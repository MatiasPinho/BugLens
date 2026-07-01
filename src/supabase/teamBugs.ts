import type { SupabaseClient } from '@supabase/supabase-js'
import { bugRecordKey } from '../pipeline/bugStatusKey.js'
import type {
  AnalyzedBug,
  BugAnalysis,
  BugComment,
  BugStatus,
  ExternalAgentRepository,
  ExternalAgentResult,
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
  bugId?: string
  rawBug?: Partial<RawBug>
  analysis?: Partial<BugAnalysis>
  googleDocs?: GoogleDocContent[]
  comments?: unknown[]
  externalAgentHistory?: unknown[]
  status?: BugStatus
  error?: string | null
  processingMs?: number | null
}

interface RemoteCommentRow {
  id: string
  bug_id: string
  body: string
  created_at: string
  updated_at?: string | null
}

interface RemoteAgentRunRow {
  bug_id: string
  analysis: Partial<BugAnalysis>
  created_at: string
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

function toExternalAgentResult(value: unknown): ExternalAgentResult | undefined {
  if (!value || typeof value !== 'object') return undefined
  const result = value as Partial<ExternalAgentResult>
  if (typeof result.ok !== 'boolean') return undefined
  const repositories = Array.isArray(result.repositories)
    ? result.repositories
        .map((repo) => {
          if (!repo || typeof repo !== 'object') return null
          const candidate = repo as Partial<ExternalAgentRepository>
          return {
            path: typeof candidate.path === 'string' ? candidate.path : '',
            branch: typeof candidate.branch === 'string' ? candidate.branch : '',
          }
        })
        .filter((repo): repo is ExternalAgentRepository => Boolean(repo?.path))
    : undefined
  return {
    ok: result.ok,
    output: typeof result.output === 'string' ? result.output : '',
    error: typeof result.error === 'string' ? result.error : undefined,
    command: typeof result.command === 'string' ? result.command : '',
    workingDirectory:
      typeof result.workingDirectory === 'string' ? result.workingDirectory : undefined,
    repositories,
    durationMs: typeof result.durationMs === 'number' ? result.durationMs : 0,
    createdAt: typeof result.createdAt === 'string' ? result.createdAt : undefined,
  }
}

function toBugComment(value: unknown): BugComment | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const id = typeof row['id'] === 'string' ? row['id'] : ''
  const body = typeof row['body'] === 'string' ? row['body'] : ''
  const createdAt = typeof row['createdAt'] === 'string' ? row['createdAt'] : ''
  if (!id || !body || !createdAt) return null
  return {
    id,
    body,
    createdAt,
    updatedAt: typeof row['updatedAt'] === 'string' ? row['updatedAt'] : undefined,
    authorEmail: typeof row['authorEmail'] === 'string' ? row['authorEmail'] : undefined,
  }
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
    externalAgent: toExternalAgentResult(analysis.externalAgent),
    externalAgentHistory: Array.isArray(row.externalAgentHistory)
      ? row.externalAgentHistory
          .map(toExternalAgentResult)
          .filter((item): item is ExternalAgentResult => Boolean(item))
      : [],
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
    comments: Array.isArray(row.comments)
      ? row.comments.map(toBugComment).filter((item): item is BugComment => Boolean(item))
      : [],
    error: row.error ?? undefined,
    processingMs: typeof row.processingMs === 'number' ? row.processingMs : 0,
  }
}

function mapCommentRow(row: RemoteCommentRow): BugComment {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}

async function hydrateBugTimeline(
  client: SupabaseClient,
  rows: RemoteBugRow[],
  results: AnalyzedBug[],
): Promise<AnalyzedBug[]> {
  if (typeof (client as { from?: unknown }).from !== 'function') return results

  const bugIds = rows
    .map((row) => row.bugId)
    .filter((bugId): bugId is string => typeof bugId === 'string' && bugId.length > 0)
  if (bugIds.length === 0) return results

  const commentsByBugId = new Map<string, BugComment[]>()
  const agentRunsByBugId = new Map<string, ExternalAgentResult[]>()

  const commentsResponse = await client
    .from('bug_comments')
    .select('id, bug_id, body, created_at, updated_at')
    .in('bug_id', bugIds)
    .order('created_at', { ascending: false })
  if (!commentsResponse.error && Array.isArray(commentsResponse.data)) {
    for (const row of commentsResponse.data as RemoteCommentRow[]) {
      const items = commentsByBugId.get(row.bug_id) ?? []
      items.push(mapCommentRow(row))
      commentsByBugId.set(row.bug_id, items)
    }
  }

  const agentRunsResponse = await client
    .from('bug_analysis_runs')
    .select('bug_id, analysis, created_at')
    .in('bug_id', bugIds)
    .eq('provider', 'external-agent')
    .order('created_at', { ascending: false })
  if (!agentRunsResponse.error && Array.isArray(agentRunsResponse.data)) {
    for (const row of agentRunsResponse.data as RemoteAgentRunRow[]) {
      const agentResult = toExternalAgentResult({
        ...row.analysis.externalAgent,
        createdAt: row.created_at,
      })
      if (!agentResult) continue
      const items = agentRunsByBugId.get(row.bug_id) ?? []
      items.push(agentResult)
      agentRunsByBugId.set(row.bug_id, items)
    }
  }

  return results.map((result, index) => {
    const bugId = rows[index]?.bugId
    if (!bugId) return result
    const comments = commentsByBugId.get(bugId)
    const externalAgentHistory = agentRunsByBugId.get(bugId)
    return {
      ...result,
      comments: comments ?? result.comments,
      analysis: {
        ...result.analysis,
        externalAgent: result.analysis.externalAgent ?? externalAgentHistory?.[0],
        externalAgentHistory:
          externalAgentHistory && externalAgentHistory.length > 0
            ? externalAgentHistory
            : result.analysis.externalAgentHistory,
      },
    }
  })
}

async function resolveRemoteBugId(
  client: SupabaseClient,
  projectId: string,
  raw: Pick<RawBug, 'title' | 'description'>,
): Promise<string> {
  const { data, error } = await client
    .from('bugs')
    .select('id')
    .eq('project_id', projectId)
    .eq('content_key', bugRecordKey(raw))
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  const id = typeof data?.id === 'string' ? data.id : ''
  if (!id) throw new Error('No se encontró el bug remoto para guardar el comentario.')
  return id
}

export async function addRemoteBugComment(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  raw: Pick<RawBug, 'title' | 'description'>,
  body: string,
): Promise<BugComment> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project || !teamStatus.user) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const trimmedBody = body.trim()
  if (!trimmedBody) throw new Error('El comentario no puede estar vacío.')

  const bugId = await resolveRemoteBugId(client, teamStatus.project.id, raw)
  const { data, error } = await client
    .from('bug_comments')
    .insert({
      bug_id: bugId,
      project_id: teamStatus.project.id,
      body: trimmedBody,
      created_by: teamStatus.user.id,
    })
    .select('id, body, created_at, updated_at')
    .single()

  if (error) throw error
  return {
    id: data.id,
    body: data.body,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    authorEmail: teamStatus.user.email,
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
  const results = rows.map(mapRemoteBugRow)
  return hydrateBugTimeline(client, rows, results)
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
