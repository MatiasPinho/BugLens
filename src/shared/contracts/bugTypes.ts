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
  error?: string
  processingMs: number
}

export interface BugComment {
  id: string
  body: string
  createdAt: string
  updatedAt?: string
  authorEmail?: string
}
