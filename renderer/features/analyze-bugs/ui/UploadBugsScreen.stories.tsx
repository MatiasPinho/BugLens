import type { Meta, StoryObj } from '@storybook/react-vite'
import UploadBugsScreen from './UploadBugsScreen'

const meta = {
  title: 'buglens/UploadBugsScreen',
  component: UploadBugsScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    excelPath: null,
    onFileSelected: () => {},
    onManualBug: () => {},
    onAnalyze: () => {},
    engineAvailability: true,
    onOpenSettings: () => {},
  },
  decorators: [
    (Story) => (
      <div className="app-main h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UploadBugsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const SinArchivo: Story = {}

export const ArchivoListo: Story = {
  args: { excelPath: 'C:\\QA\\regresion-checkout.xlsx' },
}

export const OllamaNoDisponible: Story = {
  args: { excelPath: 'C:\\QA\\regresion-checkout.xlsx', engineAvailability: false },
}

export const ComprobandoOllama: Story = {
  args: { excelPath: 'C:\\QA\\regresion-checkout.xlsx', engineAvailability: null },
}
