import type { ExternalAgentResult } from './externalAgentTypes.js'

export interface RawBug {
  id: string
  rowIndex: number
  title: string
  description: string
  stepsToReproduce?: string
  expectedResult?: string
  actualResult?: string
  environment?: string
  reporter?: string
  assignee?: string
  status?: string
  priority?: string
  rawRow: Record<string, string>
  googleDocLinks: string[]
}

export interface DocImage {
  data: string
  mimeType: string
  alt?: string
}

export interface GoogleDocContent {
  url: string
  title: string
  text: string
  accessible: boolean
  error?: string
  images?: DocImage[]
}

export interface EnrichedBug {
  raw: RawBug
  googleDocs: GoogleDocContent[]
}

export type BugCategory = 'frontend' | 'backend' | 'database' | 'config' | 'data' | 'otro'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface RewrittenReport {
  observed: string
  expected: string
  steps: string[]
  environment: string
  problemCount: number
}

export interface BugAnalysis {
  category: BugCategory
  severity: Severity
  bugType?: string
  confidence: number
  affectedArea: string
  summary: string
  rewritten: RewrittenReport
  missingInformation: string[]
  rawResponse: string
  externalAgent?: ExternalAgentResult
  externalAgentHistory?: ExternalAgentResult[]
}

export type BugStatus = 'nuevo' | 'en_progreso' | 'solucionado' | 'cerrado' | 'no_replicado'

export interface AnalyzedBug {
  enriched: EnrichedBug
  analysis: BugAnalysis
  status: BugStatus
  comments?: BugComment[]
  /** Responsables del bug. Vacío = sin asignar. */
  assignees?: TeamMember[]
  /** Fecha límite en formato `YYYY-MM-DD`. Es un día, no un instante. */
  dueDate?: string | null
  /** Quién cargó el bug. Sale de `bugs.created_by`. */
  reportedBy?: TeamMember | null
  /** Historial de cambios, del más reciente al más viejo. */
  activity?: BugActivityEntry[]
  error?: string
  processingMs: number
}

/** Persona del equipo: miembro del proyecto, responsable, autor o actor. */
export interface TeamMember {
  id: string
  email?: string
  displayName?: string
  role?: string
}

export type CommentVote = -1 | 0 | 1

export interface BugComment {
  id: string
  /** Comentario del que cuelga esta respuesta. `null` = raíz del hilo. */
  parentId?: string | null
  body: string
  createdAt: string
  updatedAt?: string
  authorId?: string
  authorEmail?: string
  authorName?: string
  upvotes: number
  downvotes: number
  /** Voto del usuario actual, para pintar el botón activo. */
  myVote: CommentVote
}

/** Totales de voto de un comentario, tal como los devuelve el servidor. */
export interface CommentVoteTotals {
  commentId: string
  upvotes: number
  downvotes: number
  myVote: CommentVote
}

export type BugActivityType =
  | 'created'
  | 'imported'
  | 'analyzed'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'deleted'
  | 'commented'
  | 'restored'
  | 'due_date_changed'
  | 'voted'

export interface BugActivityEntry {
  id: string
  type: BugActivityType
  fromStatus?: BugStatus
  toStatus?: BugStatus
  payload?: Record<string, unknown>
  createdAt: string
  actorId?: string
  actorEmail?: string
  actorName?: string
}
