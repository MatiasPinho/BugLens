import type { Meta, StoryObj } from '@storybook/react-vite'
import Settings from './Settings'

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
