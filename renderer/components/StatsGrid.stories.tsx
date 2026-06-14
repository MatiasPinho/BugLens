import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatsGrid } from '../App'
import { makeBug } from './_storyFixtures'

const results = [
  makeBug({ id: '1', title: 'a', status: 'nuevo', severity: 'high', category: 'backend' }),
  makeBug({ id: '2', title: 'b', status: 'en_progreso', severity: 'medium' }),
  makeBug({ id: '3', title: 'c', status: 'solucionado', severity: 'low' }),
  makeBug({ id: '4', title: 'd', status: 'solucionado', severity: 'medium', category: 'config' }),
  makeBug({ id: '5', title: 'e', status: 'cerrado', severity: 'medium' }),
  makeBug({ id: '6', title: 'f', status: 'no_replicado', severity: 'low', category: 'data' }),
]

const meta = {
  title: 'buglens/StatsGrid',
  component: StatsGrid,
  parameters: { layout: 'centered' },
  // Vive dentro de una card angosta en el panel izquierdo.
  decorators: [
    (Story) => (
      <div className="card" style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatsGrid>
export default meta
type Story = StoryObj<typeof StatsGrid>

// Conteo por estado (workflow) + severidad + categoría.
export const Default: Story = { args: { results } }
