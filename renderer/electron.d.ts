import type { ManualBugFields } from '../src/pipeline/manualBugBuilder'
import type { AnalyzedBug, IPCEvent } from '../src/types/index'

interface ElectronAPI {
  // Settings
  getSettings(): Promise<{
    googleClientId: string
    googleClientSecret: string
    llmProvider: string
    llmModel: string
    ollamaBaseUrl: string
    performanceMode: 'gpu' | 'cpu'
    supabaseUrl: string
    supabasePublishableKey: string
    supabaseDefaultProjectSlug: string
    supabaseDefaultProjectName: string
    supabaseActiveProjectId: string
    onboarded: boolean
  }>
  saveSettings(settings: Record<string, string | boolean>): Promise<{ ok: boolean }>
  pickDirectory(): Promise<string | null>

  // Supabase team auth
  getSupabaseStatus(): Promise<{
    configured: boolean
    authenticated: boolean
    user?: { id: string; email?: string }
    project?: { id: string; name: string; slug: string }
    projects?: Array<{ id: string; name: string; slug: string }>
    error?: string
  }>
  startSupabaseGoogleAuth(): Promise<{
    configured: boolean
    authenticated: boolean
    user?: { id: string; email?: string }
    project?: { id: string; name: string; slug: string }
    projects?: Array<{ id: string; name: string; slug: string }>
    error?: string
  }>
  selectSupabaseProject(projectId: string): Promise<{
    configured: boolean
    authenticated: boolean
    user?: { id: string; email?: string }
    project?: { id: string; name: string; slug: string }
    projects?: Array<{ id: string; name: string; slug: string }>
    error?: string
  }>
  createSupabaseProject(name: string, slug: string): Promise<{
    configured: boolean
    authenticated: boolean
    user?: { id: string; email?: string }
    project?: { id: string; name: string; slug: string }
    projects?: Array<{ id: string; name: string; slug: string }>
    error?: string
  }>
  signOutSupabase(): Promise<{ ok: boolean }>

  // Google Auth (OAuth)
  getAuthStatus(): Promise<{ authenticated: boolean }>
  startAuth(): Promise<{ ok: boolean; error?: string }>
  revokeAuth(): Promise<{ ok: boolean }>

  // Google Auth (Browser session — no OAuth)
  getBrowserAuthStatus(): Promise<{ authenticated: boolean }>
  startBrowserLogin(): Promise<{ ok: boolean; error?: string }>
  revokeBrowserAuth(): Promise<{ ok: boolean }>

  // Analysis
  runAnalysis(excelPath: string): Promise<{ ok: boolean; count?: number; error?: string }>
  analyzeManualBug(
    fields: ManualBugFields,
  ): Promise<{ ok: boolean; count?: number; error?: string }>
  loadRemoteBugs(): Promise<{ ok: boolean; results: AnalyzedBug[]; error?: string }>
  watchRemoteBugs(): Promise<{ ok: boolean; error?: string }>

  // Estado de bugs (persistente)
  setBugStatus(
    bug: AnalyzedBug,
    status: string,
  ): Promise<{ ok: boolean; error?: string }>
  deleteBug(bug: AnalyzedBug): Promise<{ ok: boolean; error?: string }>

  // Cache
  cacheStats(): Promise<{ count: number; sizeKB: number }>
  clearCache(): Promise<{ ok: boolean }>
  resetApp(scope: 'bug-data' | 'config'): Promise<{ ok: boolean }>
  exportExcel(
    originalPath: string,
    results: AnalyzedBug[],
  ): Promise<{ ok: boolean; filePath?: string; error?: string }>
  exportBugs(results: AnalyzedBug[]): Promise<{ ok: boolean; filePath?: string; error?: string }>
  exportFullData(
    excelPath: string | null,
    results: AnalyzedBug[],
  ): Promise<{ ok: boolean; filePath?: string; error?: string }>

  // Dialogs
  openExcelDialog(): Promise<string | null>

  // LLM
  checkOllama(): Promise<{ available: boolean; models?: string[] }>
  startOllama(): Promise<{ ok: boolean; message: string }>
  probeHardware(): Promise<{
    accelerator: 'gpu' | 'cpu' | 'unknown'
    detail: string
    model?: string
  }>

  // Events — return cleanup function
  onProgress(cb: (event: IPCEvent) => void): () => void
  onLog(cb: (event: IPCEvent) => void): () => void
  onAnalysisComplete(cb: (event: IPCEvent) => void): () => void
  onBugResult(cb: (event: IPCEvent) => void): () => void
  onRemoteBugsChanged(cb: () => void): () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
