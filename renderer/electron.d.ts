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
    onboarded: boolean
  }>
  saveSettings(settings: Record<string, string | boolean>): Promise<{ ok: boolean }>
  pickDirectory(): Promise<string | null>

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

  // Estado de bugs (persistente)
  setBugStatus(key: string, status: string): Promise<{ ok: boolean }>

  // Sesión (persistente)
  loadSession(): Promise<{ excelPath: string | null; results: AnalyzedBug[] } | null>
  saveSession(excelPath: string | null, results: AnalyzedBug[]): Promise<{ ok: boolean }>
  clearSession(): Promise<{ ok: boolean }>

  // Cache
  cacheStats(): Promise<{ count: number; sizeKB: number }>
  clearCache(): Promise<{ ok: boolean }>
  exportExcel(
    originalPath: string,
    results: AnalyzedBug[],
  ): Promise<{ ok: boolean; filePath?: string; error?: string }>
  exportBugs(results: AnalyzedBug[]): Promise<{ ok: boolean; filePath?: string; error?: string }>

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
