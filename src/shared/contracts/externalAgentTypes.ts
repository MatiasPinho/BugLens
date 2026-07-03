export interface ExternalAgentRepository {
  path: string
  branch: string
}

export interface ExternalAgentResult {
  ok: boolean
  output: string
  error?: string
  command: string
  workingDirectory?: string
  repositories?: ExternalAgentRepository[]
  durationMs: number
  createdAt?: string
}

export interface ExternalAgentProgress {
  bugId: string
  output: string
  chunk: string
  stream: 'stdout' | 'stderr'
  command: string
  workingDirectory?: string
  repositories?: ExternalAgentRepository[]
  elapsedMs: number
  silentMs: number
}
