import type { Decorator, Preview } from '@storybook/react-vite'
import '../renderer/styles.css' // Tailwind + estética omarchy (fuente, colores)

// Mock de window.electronAPI: fuera de Electron no existe, y Settings/FileUpload
// lo llaman. Devuelve valores razonables para que las historias rendericen.
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
    setBugStatus: async () => ({ ok: true }),
    cacheStats: async () => ({ count: 0, sizeKB: 0 }),
    clearCache: async () => ({ ok: true }),
    exportExcel: async () => ({ ok: true }),
    openExcelDialog: async () => null,
    checkOllama: async () => ({ available: true, models: ['qwen2.5:7b', 'qwen2.5:14b'] }),
    startOllama: async () => ({ ok: true, message: 'mock' }),
    probeHardware: async () => ({ accelerator: 'gpu', detail: 'El modelo corre en la GPU' }),
    onProgress: onSub,
    onLog: onSub,
    onAnalysisComplete: onSub,
    onBugResult: onSub,
  }
}

// Fondo dark de la app para todas las historias.
const withOmarchyBg: Decorator = (Story) => (
  <div style={{ background: '#101315', color: '#cacccc', minHeight: '100vh', padding: '1rem' }}>
    <Story />
  </div>
)

const preview: Preview = {
  decorators: [withOmarchyBg],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
  },
}

export default preview
