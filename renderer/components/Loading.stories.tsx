import type { Meta, StoryObj } from '@storybook/react'
import { LoadingInline, LoadingOverlay, LoadingPanel } from './Loading'

const meta = {
  title: 'buglens/Loading',
  component: LoadingPanel,
} satisfies Meta<typeof LoadingPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Panel: Story = {
  args: {
    title: 'cargando proyecto',
    detail: 'Leyendo bugs analizados desde Supabase.',
  },
}

export const Inline = {
  render: () => <LoadingInline label="sincronizando proyecto" />,
}

export const Overlay = {
  render: () => (
    <div className="relative h-80 bg-om-base">
      <LoadingOverlay visible title="creando proyecto" detail="cliente / producto" />
    </div>
  ),
}
