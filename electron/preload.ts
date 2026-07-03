import { contextBridge, ipcRenderer } from 'electron'
import type {
  AnalyzedBug,
  BugComment,
  ExternalAgentProgress,
  ExternalAgentResult,
  IPCEvent,
} from '../src/shared/contracts/index.js'
import type { IPC_CHANNELS as SHARED_IPC_CHANNELS } from '../src/shared/ipc/channels.js'

const IPC_CHANNELS = {
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsPickDirectory: 'settings:pick-directory',
  supabaseStatus: 'supabase:status',
  supabaseStartGoogleAuth: 'supabase:start-google-auth',
  supabaseSelectProject: 'supabase:select-project',
  supabaseCreateProject: 'supabase:create-project',
  supabaseSignOut: 'supabase:sign-out',
  googleAuthStatus: 'google:auth-status',
  googleStartAuth: 'google:start-auth',
  googleRevoke: 'google:revoke',
  browserAuthStatus: 'browser-auth:status',
  browserAuthStartLogin: 'browser-auth:start-login',
  browserAuthRevoke: 'browser-auth:revoke',
  analyzeRun: 'analyze:run',
  analyzeManualBug: 'analyze:manual-bug',
  bugsLoadRemote: 'bugs:load-remote',
  bugsWatchRemote: 'bugs:watch-remote',
  bugSetStatus: 'bug:set-status',
  bugAddComment: 'bug:add-comment',
  bugDelete: 'bug:delete',
  bugAnalyzeExternalAgent: 'bug:analyze-external-agent',
  externalAgentProgress: 'external-agent-progress',
  cacheStats: 'cache:stats',
  cacheClear: 'cache:clear',
  appReset: 'app:reset',
  exportExcel: 'export:excel',
  exportBugs: 'export:bugs',
  exportFullData: 'export:full-data',
  dialogOpenExcel: 'dialog:open-excel',
  llmCheckOllama: 'llm:check-ollama',
  llmStartOllama: 'llm:start-ollama',
  hardwareProbe: 'hardware:probe',
  opencodeCheck: 'opencode:check',
  opencodeRepair: 'opencode:repair',
  progress: 'progress',
  log: 'log',
  analysisComplete: 'analysis-complete',
  bugResult: 'bug-result',
  remoteBugsChanged: 'remote-bugs-changed',
} as const satisfies typeof SHARED_IPC_CHANNELS

// Expose a typed API to the renderer via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.settingsSave, settings),
  pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.settingsPickDirectory),

  // Supabase team auth
  getSupabaseStatus: () => ipcRenderer.invoke(IPC_CHANNELS.supabaseStatus),
  startSupabaseGoogleAuth: () => ipcRenderer.invoke(IPC_CHANNELS.supabaseStartGoogleAuth),
  selectSupabaseProject: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.supabaseSelectProject, { projectId }),
  createSupabaseProject: (name: string, slug: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.supabaseCreateProject, { name, slug }),
  signOutSupabase: () => ipcRenderer.invoke(IPC_CHANNELS.supabaseSignOut),

  // Google Auth (OAuth)
  getAuthStatus: () => ipcRenderer.invoke(IPC_CHANNELS.googleAuthStatus),
  startAuth: () => ipcRenderer.invoke(IPC_CHANNELS.googleStartAuth),
  revokeAuth: () => ipcRenderer.invoke(IPC_CHANNELS.googleRevoke),

  // Google Auth (Browser session — no OAuth needed)
  getBrowserAuthStatus: () => ipcRenderer.invoke(IPC_CHANNELS.browserAuthStatus),
  startBrowserLogin: () => ipcRenderer.invoke(IPC_CHANNELS.browserAuthStartLogin),
  revokeBrowserAuth: () => ipcRenderer.invoke(IPC_CHANNELS.browserAuthRevoke),

  // Analysis
  runAnalysis: (excelPath: string) => ipcRenderer.invoke(IPC_CHANNELS.analyzeRun, excelPath),
  analyzeManualBug: (fields: Record<string, string>) =>
    ipcRenderer.invoke(IPC_CHANNELS.analyzeManualBug, fields),
  loadRemoteBugs: () => ipcRenderer.invoke(IPC_CHANNELS.bugsLoadRemote),
  watchRemoteBugs: () => ipcRenderer.invoke(IPC_CHANNELS.bugsWatchRemote),

  // Estado de bugs (persistente)
  setBugStatus: (bug: AnalyzedBug, status: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.bugSetStatus, { bug, status }),
  addBugComment: (
    bug: AnalyzedBug,
    body: string,
  ): Promise<{ ok: boolean; comment?: BugComment; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.bugAddComment, { bug, body }),
  deleteBug: (bug: AnalyzedBug) => ipcRenderer.invoke(IPC_CHANNELS.bugDelete, { bug }),
  analyzeWithExternalAgent: (bug: AnalyzedBug): Promise<ExternalAgentResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.bugAnalyzeExternalAgent, { bug }),
  onExternalAgentProgress: (cb: (event: ExternalAgentProgress) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: ExternalAgentProgress) => cb(data)
    ipcRenderer.on(IPC_CHANNELS.externalAgentProgress, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.externalAgentProgress, handler)
  },

  // Cache
  cacheStats: () => ipcRenderer.invoke(IPC_CHANNELS.cacheStats),
  clearCache: () => ipcRenderer.invoke(IPC_CHANNELS.cacheClear),

  // Reset (restablecer + reiniciar)
  resetApp: (scope: 'bug-data' | 'config') => ipcRenderer.invoke(IPC_CHANNELS.appReset, { scope }),
  exportExcel: (originalPath: string, results: AnalyzedBug[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportExcel, { originalPath, results }),
  exportBugs: (results: AnalyzedBug[]) => ipcRenderer.invoke(IPC_CHANNELS.exportBugs, { results }),
  exportFullData: (excelPath: string | null, results: AnalyzedBug[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportFullData, { excelPath, results }),

  // Dialogs
  openExcelDialog: () => ipcRenderer.invoke(IPC_CHANNELS.dialogOpenExcel),

  // LLM
  checkOllama: () => ipcRenderer.invoke(IPC_CHANNELS.llmCheckOllama),
  startOllama: () => ipcRenderer.invoke(IPC_CHANNELS.llmStartOllama),
  probeHardware: () => ipcRenderer.invoke(IPC_CHANNELS.hardwareProbe),
  checkOpenCode: () => ipcRenderer.invoke(IPC_CHANNELS.opencodeCheck),
  repairOpenCode: () => ipcRenderer.invoke(IPC_CHANNELS.opencodeRepair),

  // Event listeners
  onProgress: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on(IPC_CHANNELS.progress, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.progress, handler)
  },
  onLog: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on(IPC_CHANNELS.log, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.log, handler)
  },
  onAnalysisComplete: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on(IPC_CHANNELS.analysisComplete, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.analysisComplete, handler)
  },
  onBugResult: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on(IPC_CHANNELS.bugResult, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.bugResult, handler)
  },
  onRemoteBugsChanged: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on(IPC_CHANNELS.remoteBugsChanged, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.remoteBugsChanged, handler)
  },
})
