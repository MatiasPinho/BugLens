import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LogLine } from '../../../App'
import AnalysisProgressScreen, { PhaseSteps } from './AnalysisProgressScreen'

const logs: LogLine[] = [
  { id: 1, level: 'info', message: 'excel leído: 24 filas válidas', timestamp: '2026-03-11T14:02:11Z' },
  {
    id: 2,
    level: 'info',
    message: 'google docs: 9 documentos, 14 capturas',
    timestamp: '2026-03-11T14:02:14Z',
  },
  {
    id: 3,
    level: 'warn',
    message: 'doc sin permisos: informe-qa-marzo',
    timestamp: '2026-03-11T14:02:31Z',
  },
  { id: 4, level: 'info', message: 'bug 11/24 analizado en 4.2s', timestamp: '2026-03-11T14:03:02Z' },
  {
    id: 5,
    level: 'error',
    message: 'timeout en la fila 19 — se reintenta',
    timestamp: '2026-03-11T14:03:09Z',
  },
  { id: 6, level: 'info', message: 'bug 13/24 analizado en 3.8s', timestamp: '2026-03-11T14:03:18Z' },
]

const meta = {
  title: 'buglens/AnalysisProgressScreen',
  component: AnalysisProgressScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnalysisProgressScreen>
export default meta
type Story = StoryObj<typeof AnalysisProgressScreen>

export const Analizando: Story = {
  args: {
    current: 14,
    total: 24,
    message: 'Reescribiendo "El total del reporte mensual no coincide…"',
    phase: 'analyzing',
    engineLabel: 'qwen2.5:7b en GPU · varios bugs en paralelo',
    logs,
  },
}

export const LeyendoDocs: Story = {
  args: {
    current: 0,
    total: 24,
    message: 'Leyendo los Google Docs enlazados…',
    phase: 'reading_docs',
    engineLabel: 'qwen2.5:7b en CPU · de a un bug',
    logs: logs.slice(0, 2),
  },
}

// Los pasos del pipeline sueltos, para revisar los tres estados de cada segmento.
export const PasosDelPipeline: Story = {
  render: () => (
    <div className="card grid gap-5" style={{ margin: 32 }}>
      <PhaseSteps current="reading_excel" />
      <PhaseSteps current="analyzing" />
      <PhaseSteps current="done" />
    </div>
  ),
}
