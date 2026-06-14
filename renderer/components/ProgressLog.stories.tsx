import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LogLine } from '../App'
import ProgressLog from './ProgressLog'

const ts = (s: number) => new Date(Date.now() - s * 1000).toISOString()

const logs: LogLine[] = [
  { id: 1, level: 'info', message: 'leyendo Excel...', timestamp: ts(9) },
  { id: 2, level: 'info', message: 'Encontrados 39 bugs', timestamp: ts(8) },
  { id: 3, level: 'info', message: '[7/39] Form armas', timestamp: ts(5) },
  { id: 4, level: 'warn', message: 'Doc no accesible: drive.google.com/...', timestamp: ts(4) },
  { id: 5, level: 'error', message: '✗ Bug 12 falló: Ollama timeout', timestamp: ts(2) },
  { id: 6, level: 'info', message: '✓ análisis completo: 39 bugs', timestamp: ts(1) },
]

const meta = {
  title: 'buglens/ProgressLog',
  component: ProgressLog,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProgressLog>
export default meta
type Story = StoryObj<typeof ProgressLog>

export const ConLogs: Story = { args: { logs } }
export const Vacio: Story = { args: { logs: [] } }
