import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AnalyzedBug } from '../../src/types/index'
import { makeBug } from './_storyFixtures'
import BugTable from './BugTable'

const bugs: AnalyzedBug[] = [
  makeBug({
    id: 'b1',
    title: 'Login no responde',
    summary: 'el botón de login a veces tira 500',
    severity: 'high',
    category: 'backend',
    status: 'en_progreso',
  }),
  makeBug({
    id: 'b2',
    title: 'Form armas',
    summary: 'campos sin validación',
    status: 'nuevo',
    observed:
      '1. organismo registrante acepta menos de 5\n2. número de serie permite más de 20\n3. no muestra el error en rojo',
    missing: ['el mensaje exacto del error'],
  }),
  makeBug({
    id: 'b3',
    title: 'Export Excel',
    summary: 'el botón exportar no hace nada',
    severity: 'low',
    status: 'solucionado',
  }),
  makeBug({
    id: 'b4',
    title: 'Filtro de fecha',
    summary: 'no filtra por rango',
    category: 'frontend',
    status: 'cerrado',
  }),
  makeBug({
    id: 'b5',
    title: 'Carga de avatar',
    summary: 'no se pudo reproducir',
    severity: 'low',
    status: 'no_replicado',
  }),
]

const meta: Meta<typeof BugTable> = {
  title: 'buglens/BugTable',
  component: BugTable,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BugTable>

// Tabla con bugs en distintos estados/severidades. El selector de estado de cada
// fila es interactivo; expandí un bug para ver el reporte reescrito.
export const Default: Story = { args: { results: bugs, onSetStatus: () => {} } }

// Un bug que junta varios problemas (observed numerado → badge "N problemas" al expandir).
export const MultiProblema: Story = { args: { results: [bugs[1]], onSetStatus: () => {} } }

export const SinResultados: Story = { args: { results: [] } }
