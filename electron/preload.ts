import { contextBridge, ipcRenderer } from 'electron'
import type { AnalyzedBug, IPCEvent } from '../src/types/index.js'

// Expose a typed API to the renderer via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', settings),
  pickDirectory: () => ipcRenderer.invoke('settings:pick-directory'),

  // Supabase team auth
  getSupabaseStatus: () => ipcRenderer.invoke('supabase:status'),
  startSupabaseGoogleAuth: () => ipcRenderer.invoke('supabase:start-google-auth'),
  selectSupabaseProject: (projectId: string) =>
    ipcRenderer.invoke('supabase:select-project', { projectId }),
  createSupabaseProject: (name: string, slug: string) =>
    ipcRenderer.invoke('supabase:create-project', { name, slug }),
  signOutSupabase: () => ipcRenderer.invoke('supabase:sign-out'),

  // Google Auth (OAuth)
  getAuthStatus: () => ipcRenderer.invoke('google:auth-status'),
  startAuth: () => ipcRenderer.invoke('google:start-auth'),
  revokeAuth: () => ipcRenderer.invoke('google:revoke'),

  // Google Auth (Browser session — no OAuth needed)
  getBrowserAuthStatus: () => ipcRenderer.invoke('browser-auth:status'),
  startBrowserLogin: () => ipcRenderer.invoke('browser-auth:start-login'),
  revokeBrowserAuth: () => ipcRenderer.invoke('browser-auth:revoke'),

  // Analysis
  runAnalysis: (excelPath: string) => ipcRenderer.invoke('analyze:run', excelPath),
  analyzeManualBug: (fields: Record<string, string>) =>
    ipcRenderer.invoke('analyze:manual-bug', fields),
  loadRemoteBugs: () => ipcRenderer.invoke('bugs:load-remote'),
  watchRemoteBugs: () => ipcRenderer.invoke('bugs:watch-remote'),

  // Estado de bugs (persistente)
  setBugStatus: (bug: AnalyzedBug, status: string) =>
    ipcRenderer.invoke('bug:set-status', { bug, status }),
  deleteBug: (bug: AnalyzedBug) => ipcRenderer.invoke('bug:delete', { bug }),

  // Cache
  cacheStats: () => ipcRenderer.invoke('cache:stats'),
  clearCache: () => ipcRenderer.invoke('cache:clear'),

  // Reset (restablecer + reiniciar)
  resetApp: (scope: 'bug-data' | 'config') => ipcRenderer.invoke('app:reset', { scope }),
  exportExcel: (originalPath: string, results: AnalyzedBug[]) =>
    ipcRenderer.invoke('export:excel', { originalPath, results }),
  exportBugs: (results: AnalyzedBug[]) => ipcRenderer.invoke('export:bugs', { results }),
  exportFullData: (excelPath: string | null, results: AnalyzedBug[]) =>
    ipcRenderer.invoke('export:full-data', { excelPath, results }),

  // Dialogs
  openExcelDialog: () => ipcRenderer.invoke('dialog:open-excel'),

  // LLM
  checkOllama: () => ipcRenderer.invoke('llm:check-ollama'),
  startOllama: () => ipcRenderer.invoke('llm:start-ollama'),
  probeHardware: () => ipcRenderer.invoke('hardware:probe'),

  // Event listeners
  onProgress: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on('progress', handler)
    return () => ipcRenderer.removeListener('progress', handler)
  },
  onLog: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on('log', handler)
    return () => ipcRenderer.removeListener('log', handler)
  },
  onAnalysisComplete: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on('analysis-complete', handler)
    return () => ipcRenderer.removeListener('analysis-complete', handler)
  },
  onBugResult: (cb: (event: IPCEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: IPCEvent) => cb(data)
    ipcRenderer.on('bug-result', handler)
    return () => ipcRenderer.removeListener('bug-result', handler)
  },
  onRemoteBugsChanged: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('remote-bugs-changed', handler)
    return () => ipcRenderer.removeListener('remote-bugs-changed', handler)
  },
})
