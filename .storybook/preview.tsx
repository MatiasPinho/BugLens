import type { Decorator, Preview } from '@storybook/react-vite'
import '../renderer/styles.css' // Tailwind + tokens del design system (fuente, colores)

// Mock de window.electronAPI: fuera de Electron no existe, y Settings/FileUpload
// lo llaman. Devuelve valores razonables para que las historias rendericen.
const supabaseStatus = {
  configured: true,
  authenticated: true,
  user: { id: 'user-1', email: 'matias@estudio.com' },
  project: { id: 'project-1', name: 'Finn App', slug: 'finn-app' },
  projects: [
    { id: 'project-1', name: 'Finn App', slug: 'finn-app' },
    { id: 'project-2', name: 'Portal QA', slug: 'portal-qa' },
  ],
}

if (typeof window !== 'undefined' && !(window as { electronAPI?: unknown }).electronAPI) {
  const onSub = () => () => {}
  ;(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    getSettings: async () => ({
      googleClientId: '',
      googleClientSecret: '',
      llmProvider: 'ollama',
      llmModel: 'qwen2.5:7b',
      ollamaBaseUrl: 'http://localhost:11434',
      performanceMode: 'gpu',
      supabaseUrl: '',
      supabasePublishableKey: '',
      supabaseDefaultProjectSlug: 'buglens-default',
      supabaseDefaultProjectName: 'buglens',
      supabaseActiveProjectId: '',
      externalAgentCommand: 'codex exec',
      externalAgentTimeoutMs: 20 * 60 * 1000,
      externalAgentWorkingDirectory: '',
      externalAgentRepositories: [],
      bugsViewMode: 'split',
      onboarded: true,
    }),
    saveSettings: async () => ({ ok: true }),
    pickDirectory: async () => null,
    getAuthStatus: async () => ({ authenticated: false }),
    startAuth: async () => ({ ok: true }),
    revokeAuth: async () => ({ ok: true }),
    getBrowserAuthStatus: async () => ({ authenticated: false }),
    startBrowserLogin: async () => ({ ok: true }),
    revokeBrowserAuth: async () => ({ ok: true }),
    runAnalysis: async () => ({ ok: true }),
    analyzeManualBug: async () => ({ ok: true }),
    loadRemoteBugs: async () => ({ ok: true, results: [] }),
    watchRemoteBugs: async () => ({ ok: true }),
    setBugStatus: async () => ({ ok: true }),
    deleteBug: async () => ({ ok: true }),
    analyzeWithExternalAgent: async () => ({
      ok: true,
      output: 'Salida mock del agente externo.',
      command: 'codex exec',
      durationMs: 1000,
    }),
    cacheStats: async () => ({ count: 0, sizeKB: 0 }),
    clearCache: async () => ({ ok: true }),
    resetApp: async () => ({ ok: true }),
    exportExcel: async () => ({ ok: true }),
    exportBugs: async () => ({ ok: true }),
    exportFullData: async () => ({ ok: true }),
    openExcelDialog: async () => null,
    checkOllama: async () => ({ available: true, models: ['qwen2.5:7b', 'qwen2.5:14b'] }),
    startOllama: async () => ({ ok: true, message: 'mock' }),
    checkOpenCode: async () => ({
      installed: true,
      version: '1.17.11',
      hasBigPickle: true,
      model: 'opencode/big-pickle',
      commandPath: 'opencode',
    }),
    repairOpenCode: async () => ({
      ok: true,
      installed: true,
      version: '1.17.11',
      hasBigPickle: true,
      model: 'opencode/big-pickle',
      commandPath: 'opencode',
    }),
    probeHardware: async () => ({ accelerator: 'gpu', detail: 'El modelo corre en la GPU' }),
    // Equipo / proyectos (Supabase)
    getSupabaseStatus: async () => supabaseStatus,
    startSupabaseGoogleAuth: async () => supabaseStatus,
    selectSupabaseProject: async () => supabaseStatus,
    createSupabaseProject: async () => supabaseStatus,
    signOutSupabase: async () => ({ ok: true }),
    addBugComment: async () => ({
      ok: true,
      comment: {
        id: `mock-${Date.now()}`,
        body: 'nota mock',
        createdAt: new Date().toISOString(),
        authorEmail: 'qa@estudio.com',
      },
    }),
    onProgress: onSub,
    onExternalAgentProgress: onSub,
    onLog: onSub,
    onAnalysisComplete: onSub,
    onBugResult: onSub,
    onRemoteBugsChanged: onSub,
  }
}

// Fondo de la app (canvas claro) para todas las historias. Los valores salen de
// los tokens de styles.css, igual que en la app.
const withAppCanvas: Decorator = (Story) => (
  <div
    style={{
      background: 'rgb(var(--c-canvas))',
      color: 'rgb(var(--c-fg))',
      minHeight: '100vh',
    }}
  >
    <Story />
  </div>
)

const preview: Preview = {
  decorators: [withAppCanvas],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
  },
}

export default preview
