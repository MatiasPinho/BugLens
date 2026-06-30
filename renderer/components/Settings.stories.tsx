import type { Meta, StoryObj } from '@storybook/react-vite'
import Settings from './Settings'

const configuredSettings = {
  googleClientId: '',
  googleClientSecret: '',
  llmProvider: 'ollama',
  llmModel: 'qwen2.5:7b',
  llmVisionModel: 'qwen2.5vl:7b',
  ollamaBaseUrl: 'http://localhost:11434',
  performanceMode: 'gpu' as const,
  supabaseUrl: '',
  supabasePublishableKey: '',
  supabaseDefaultProjectSlug: 'buglens-default',
  supabaseDefaultProjectName: 'buglens',
  supabaseActiveProjectId: '',
  externalAgentCommand: 'codex exec',
  externalAgentTimeoutMs: 20 * 60 * 1000,
  externalAgentWorkingDirectory: '/home/equipo/ddjjpol',
  externalAgentRepositories: [
    { path: '/home/equipo/ddjjpol', branch: 'main' },
    { path: '/home/equipo/ddjjpol-back', branch: 'develop' },
  ],
  onboarded: true,
}

// Settings llama a window.electronAPI al montar (settings, auth, ollama, caché).
// El mock está en .storybook/preview.tsx, así renderiza sin Electron.
const meta = {
  title: 'buglens/Settings',
  component: Settings,
  parameters: { layout: 'fullscreen' },
  args: { addLog: () => {} },
} satisfies Meta<typeof Settings>
export default meta
type Story = StoryObj<typeof Settings>

export const Default: Story = {}

export const AgenteExternoConfigurado: Story = {
  decorators: [
    (Story) => {
      window.electronAPI.getSettings = async () => configuredSettings
      return <Story />
    },
  ],
}
