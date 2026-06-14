import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfidenceBar } from './BugTable'

const meta = {
  title: 'buglens/ConfidenceBar',
  component: ConfidenceBar,
  parameters: { layout: 'centered' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 1, step: 0.05 } } },
} satisfies Meta<typeof ConfidenceBar>
export default meta
type Story = StoryObj<typeof ConfidenceBar>

// Color por umbral: ≥80% gris, ≥50% crema, <50% rojo.
export const Alta: Story = { args: { value: 0.9 } }
export const Media: Story = { args: { value: 0.6 } }
export const Baja: Story = { args: { value: 0.3 } }
