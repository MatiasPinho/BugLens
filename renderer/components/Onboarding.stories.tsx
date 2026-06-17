import type { Meta, StoryObj } from '@storybook/react-vite'
import Onboarding from './Onboarding'

// Llama a window.electronAPI al montar (settings, auth, probe) — mock en preview.tsx.
const meta = {
  title: 'buglens/Onboarding',
  component: Onboarding,
  parameters: { layout: 'fullscreen' },
  args: { onDone: () => {} },
} satisfies Meta<typeof Onboarding>
export default meta
type Story = StoryObj<typeof Onboarding>

export const Default: Story = {}
