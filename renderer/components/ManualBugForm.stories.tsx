import type { Meta, StoryObj } from '@storybook/react-vite'
import ManualBugForm from './ManualBugForm'

const meta = {
  title: 'buglens/ManualBugForm',
  component: ManualBugForm,
  parameters: { layout: 'fullscreen' },
  args: {
    onSubmit: (fields) => console.log('submit', fields),
    onClose: () => console.log('close'),
  },
} satisfies Meta<typeof ManualBugForm>
export default meta
type Story = StoryObj<typeof ManualBugForm>

export const Vacio: Story = {}
