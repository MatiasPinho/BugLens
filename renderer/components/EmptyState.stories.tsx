import type { Meta, StoryObj } from '@storybook/react-vite'
import EmptyState from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'buglens/EmptyState',
  component: EmptyState,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const SinBugs: Story = {
  args: {
    title: 'Todavía no hay bugs analizados',
    description: 'Cargá un Excel de QA o un bug a mano para que BugLens los reescriba.',
  },
}

export const SinResultados: Story = {
  args: {
    title: 'Ningún bug coincide con estos filtros',
    description: 'Probá con menos filtros o buscá otro texto.',
    action: (
      <button type="button" className="btn-secondary">
        Limpiar filtros
      </button>
    ),
  },
}
