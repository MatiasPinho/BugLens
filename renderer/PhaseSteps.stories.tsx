import type { Meta, StoryObj } from '@storybook/react-vite'
import { PhaseSteps } from './App'

const meta = {
  title: 'buglens/PhaseSteps',
  component: PhaseSteps,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="card" style={{ width: 260 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhaseSteps>
export default meta
type Story = StoryObj<typeof PhaseSteps>

// Los pasos del pipeline; el chip activo se ilumina según la fase.
export const LeyendoExcel: Story = { args: { current: 'reading_excel' } }
export const Analizando: Story = { args: { current: 'analyzing' } }
export const Listo: Story = { args: { current: 'done' } }
