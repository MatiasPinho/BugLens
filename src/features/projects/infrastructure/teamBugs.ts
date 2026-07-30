import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AnalyzedBug,
  BugActivityEntry,
  BugActivityType,
  BugAnalysis,
  BugComment,
  BugStatus,
  CommentVote,
  CommentVoteTotals,
  GoogleDocContent,
  RawBug,
  TeamMember,
} from '../../../shared/contracts/bugTypes.js'
import type {
  ExternalAgentRepository,
  ExternalAgentResult,
} from '../../../shared/contracts/externalAgentTypes.js'
import { bugRecordKey } from '../../bug-workflow/domain/bugStatusKey.js'
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
  assignees?: unknown[]
  activity?: unknown[]
  dueDate?: string | null
  reportedBy?: unknown
  externalAgentHistory?: unknown[]
  status?: BugStatus
  error?: string | null
  processingMs?: number | null
}

interface RemoteCommentRow {
  id: string
  bug_id: string
  parent_id?: string | null
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

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function countOf(value: unknown): number {
  // Postgres devuelve los agregados como number, pero un `count` grande puede
  // llegar como string. No asumir el tipo.
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toCommentVote(value: unknown): CommentVote {
  const parsed = countOf(value)
  if (parsed === 1) return 1
  if (parsed === -1) return -1
  return 0
}

export function toTeamMember(value: unknown): TeamMember | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const id = optionalString(row['id'])
  if (!id) return null
  return {
    id,
    email: optionalString(row['email']),
    displayName: optionalString(row['displayName']),
    role: optionalString(row['role']),
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
    parentId: optionalString(row['parentId']) ?? null,
    body,
    createdAt,
    updatedAt: optionalString(row['updatedAt']),
    authorId: optionalString(row['authorId']),
    authorEmail: optionalString(row['authorEmail']),
    authorName: optionalString(row['authorName']),
    upvotes: countOf(row['upvotes']),
    downvotes: countOf(row['downvotes']),
    myVote: toCommentVote(row['myVote']),
  }
}

const ACTIVITY_TYPES: readonly BugActivityType[] = [
  'created',
  'imported',
  'analyzed',
  'status_changed',
  'assigned',
  'unassigned',
  'deleted',
  'commented',
  'restored',
  'due_date_changed',
  'voted',
]

function toActivityEntry(value: unknown): BugActivityEntry | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const id = optionalString(row['id'])
  const createdAt = optionalString(row['createdAt'])
  const type = row['type']
  // Un tipo de evento desconocido (agregado por una migración más nueva) se
  // descarta en vez de romper el listado entero.
  if (!id || !createdAt || !ACTIVITY_TYPES.includes(type as BugActivityType)) return null
  return {
    id,
    type: type as BugActivityType,
    fromStatus: optionalString(row['fromStatus']) as BugStatus | undefined,
    toStatus: optionalString(row['toStatus']) as BugStatus | undefined,
    payload:
      row['payload'] && typeof row['payload'] === 'object'
        ? (row['payload'] as Record<string, unknown>)
        : undefined,
    createdAt,
    actorId: optionalString(row['actorId']),
    actorEmail: optionalString(row['actorEmail']),
    actorName: optionalString(row['actorName']),
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
    assignees: Array.isArray(row.assignees)
      ? row.assignees.map(toTeamMember).filter((item): item is TeamMember => Boolean(item))
      : [],
    dueDate: typeof row.dueDate === 'string' ? row.dueDate : null,
    reportedBy: toTeamMember(row.reportedBy),
    activity: Array.isArray(row.activity)
      ? row.activity
          .map(toActivityEntry)
          .filter((item): item is BugActivityEntry => Boolean(item))
      : [],
    error: row.error ?? undefined,
    processingMs: typeof row.processingMs === 'number' ? row.processingMs : 0,
  }
}

// Camino de respaldo: lee `bug_comments` directo cuando el payload del RPC no
// trajo el hilo. Sin agregados de voto disponibles, arranca en cero.
function mapCommentRow(row: RemoteCommentRow): BugComment {
  return {
    id: row.id,
    parentId: row.parent_id ?? null,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    upvotes: 0,
    downvotes: 0,
    myVote: 0,
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
    .select('id, bug_id, parent_id, body, created_at, updated_at')
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

export async function addRemoteBugComment(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  raw: Pick<RawBug, 'title' | 'description'>,
  body: string,
  parentId?: string | null,
): Promise<BugComment> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project || !teamStatus.user) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const trimmedBody = body.trim()
  if (!trimmedBody) throw new Error('El comentario no puede estar vacío.')

  // Por RPC y no por insert directo: el servidor valida que el comentario padre
  // pertenezca a este bug antes de colgarle la respuesta.
  const { data, error } = await client.rpc('add_bug_comment', {
    target_project_id: teamStatus.project.id,
    target_content_key: bugRecordKey(raw),
    comment_body: trimmedBody,
    parent_comment_id: parentId ?? null,
  })

  if (error) throw error
  const comment = toBugComment(data)
  if (!comment) throw new Error('La respuesta del servidor no trae el comentario guardado.')
  return comment
}

export async function setRemoteBugAssignees(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  raw: Pick<RawBug, 'title' | 'description'>,
  userIds: string[],
): Promise<string> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client.rpc('set_bug_assignees', {
    target_project_id: teamStatus.project.id,
    target_content_key: bugRecordKey(raw),
    next_user_ids: userIds,
  })

  if (error) throw error
  return data as string
}

export async function setRemoteBugDueDate(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  raw: Pick<RawBug, 'title' | 'description'>,
  dueDate: string | null,
): Promise<string> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client.rpc('set_bug_due_date', {
    target_project_id: teamStatus.project.id,
    target_content_key: bugRecordKey(raw),
    next_due: dueDate,
  })

  if (error) throw error
  return data as string
}

export async function setRemoteCommentVote(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  commentId: string,
  value: CommentVote,
): Promise<CommentVoteTotals> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client.rpc('set_comment_vote', {
    target_comment_id: commentId,
    next_value: value,
  })

  if (error) throw error
  const row = (data ?? {}) as Record<string, unknown>
  return {
    commentId,
    upvotes: countOf(row['upvotes']),
    downvotes: countOf(row['downvotes']),
    myVote: toCommentVote(row['myVote']),
  }
}

export async function loadRemoteProjectMembers(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
): Promise<TeamMember[]> {
  const teamStatus = await getSupabaseTeamStatus(client, config)
  if (!teamStatus.authenticated || !teamStatus.project) {
    throw new Error('No hay sesión de equipo o proyecto compartido activo.')
  }

  const { data, error } = await client.rpc('list_project_members', {
    target_project_id: teamStatus.project.id,
  })

  if (error) throw error
  return Array.isArray(data)
    ? data.map(toTeamMember).filter((item): item is TeamMember => Boolean(item))
    : []
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
