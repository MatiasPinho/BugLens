import type { Meta, StoryObj } from '@storybook/react-vite'
import EngineStatusButton from './EngineStatusButton'

const meta = {
  title: 'buglens/shell/EngineStatusButton',
  component: EngineStatusButton,
  args: { onOpenSettings: () => {} },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen items-start p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EngineStatusButton>

export default meta
type Story = StoryObj<typeof meta>

export const Disponible: Story = { args: { availability: true } }

export const NoDisponible: Story = { args: { availability: false } }

export const Comprobando: Story = { args: { availability: null } }
