import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { BugStatus } from '../../src/types/index'
import { StatusSelect } from './BugTable'

const meta = {
  title: 'buglens/StatusSelect',
  component: StatusSelect,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatusSelect>
export default meta
type Story = StoryObj<typeof StatusSelect>

// Interactivo: mantiene estado local, así al elegir una opción el chip cambia
// de color/etiqueta (en la app real ese cambio lo maneja el padre + persistencia).
export const Interactivo: Story = {
  render: () => {
    const [status, setStatus] = useState<BugStatus>('nuevo')
    return <StatusSelect status={status} onChange={setStatus} />
  },
}

// Los 5 estados juntos, para ver de un vistazo la paleta del ciclo de vida.
const ALL: BugStatus[] = ['nuevo', 'en_progreso', 'solucionado', 'cerrado', 'no_replicado']
export const TodosLosEstados: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {ALL.map((s) => (
        <StatusSelect key={s} status={s} onChange={() => {}} />
      ))}
    </div>
  ),
}
