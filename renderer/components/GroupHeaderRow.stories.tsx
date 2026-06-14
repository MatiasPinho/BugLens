import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeBug } from './_storyFixtures'
import { GroupHeaderRow } from './BugTable'

const bugs = [
  makeBug({ id: '1', title: 'a', severity: 'critical' }),
  makeBug({ id: '2', title: 'b', severity: 'high' }),
  makeBug({ id: '3', title: 'c', severity: 'medium' }),
  makeBug({ id: '4', title: 'd', severity: 'low' }),
]

const meta = {
  title: 'buglens/GroupHeaderRow',
  component: GroupHeaderRow,
  parameters: { layout: 'fullscreen' },
  // Renderiza un <tr>, así que necesita una tabla contenedora.
  decorators: [
    (Story) => (
      <table style={{ width: '100%' }}>
        <tbody>
          <Story />
        </tbody>
      </table>
    ),
  ],
  args: { onToggle: () => {} },
} satisfies Meta<typeof GroupHeaderRow>
export default meta
type Story = StoryObj<typeof GroupHeaderRow>

// Encabezado de grupo (agrupación por pantalla) con conteo por severidad.
export const Expandido: Story = { args: { area: '/abm/sujetos-obligados', bugs, collapsed: false } }
export const Colapsado: Story = { args: { area: '/form', bugs: bugs.slice(0, 2), collapsed: true } }
