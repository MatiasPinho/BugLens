import type { Meta, StoryObj } from '@storybook/react-vite'
import FileUpload from './FileUpload'

const meta = {
  title: 'buglens/FileUpload',
  component: FileUpload,
  // Se usa en un panel angosto (w-72) en la app — lo acotamos acá.
  decorators: [
    (Story) => (
      <div style={{ width: 288 }}>
        <Story />
      </div>
    ),
  ],
  args: { onFileSelected: () => {} },
} satisfies Meta<typeof FileUpload>
export default meta
type Story = StoryObj<typeof FileUpload>

export const SinArchivo: Story = { args: { excelPath: null } }
export const ConArchivo: Story = { args: { excelPath: '/home/qa/POL-BUGS-MEJORAS.xlsx' } }
export const Deshabilitado: Story = { args: { excelPath: null, disabled: true } }
