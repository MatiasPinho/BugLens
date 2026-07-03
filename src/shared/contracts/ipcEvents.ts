import type { AnalyzedBug } from './bugTypes.js'

export type AnalysisPhase = 'reading_excel' | 'reading_docs' | 'analyzing' | 'done' | 'error'

export interface ProgressEvent {
  type: 'progress'
  message: string
  current: number
  total: number
  phase?: AnalysisPhase
}

export interface LogEvent {
  type: 'log'
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export interface AnalysisCompleteEvent {
  type: 'complete'
  results: AnalyzedBug[]
}

export interface BugResultEvent {
  type: 'bug-result'
  result: AnalyzedBug
  current: number
  total: number
}

export type IPCEvent = ProgressEvent | LogEvent | AnalysisCompleteEvent | BugResultEvent
