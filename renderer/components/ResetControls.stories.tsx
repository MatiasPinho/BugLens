import type { Meta, StoryObj } from '@storybook/react-vite'
import ResetControls from './ResetControls'

// Usa window.electronAPI.resetApp (mockeado en .storybook/preview.tsx).
const meta = {
  title: 'buglens/ResetControls',
  component: ResetControls,
  args: { addLog: () => {} },
} satisfies Meta<typeof ResetControls>
export default meta
type Story = StoryObj<typeof ResetControls>

export const Default: Story = {}
