import type { Meta, StoryObj } from '@storybook/react-vite'
import EmptyState from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'buglens/EmptyState',
  component: EmptyState,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const SinExcel: Story = {
  args: { hasExcel: false },
}

export const ConExcel: Story = {
  args: { hasExcel: true },
}
