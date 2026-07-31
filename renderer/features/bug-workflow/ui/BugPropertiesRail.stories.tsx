import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeBug } from '../../../components/_storyFixtures'
import BugPropertiesRail from './BugPropertiesRail'

const equipo = [
  { id: 'perfil-1', displayName: 'Lucía Gómez', email: 'lucia@estudio.com' },
  { id: 'perfil-2', displayName: 'Matias Pinho', email: 'matias@estudio.com' },
  { id: 'perfil-3', email: 'ana@estudio.com' },
]

const bug = makeBug({
  id: 'a',
  title: 'Login queda cargando',
  severity: 'critical',
  screen: '/auth/login',
  environment: 'prod',
  confidence: 0.9,
})

const meta = {
  title: 'buglens/bugs/BugPropertiesRail',
  component: BugPropertiesRail,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
        <div style={{ width: 'var(--properties-w)', display: 'flex' }}>
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    bug,
    members: equipo,
    onSetStatus: () => {},
    onSetAssignees: () => {},
    onSetDueDate: () => {},
  },
} satisfies Meta<typeof BugPropertiesRail>
export default meta
type Story = StoryObj<typeof BugPropertiesRail>

/** Bug recién importado: sin responsables, sin fecha y sin actividad. */
export const SinAsignar: Story = {}

export const Completo: Story = {
  args: {
    bug: {
      ...bug,
      assignees: [equipo[0], equipo[1]],
      dueDate: '2026-12-31',
      reportedBy: equipo[0],
      activity: [
        {
          id: 'e1',
          type: 'status_changed',
          fromStatus: 'nuevo',
          toStatus: 'en_progreso',
          createdAt: '2026-03-11T10:00:00.000Z',
          actorName: 'Matias Pinho',
        },
        {
          id: 'e2',
          type: 'assigned',
          createdAt: '2026-03-11T09:30:00.000Z',
          actorName: 'Lucía Gómez',
        },
        {
          id: 'e3',
          type: 'due_date_changed',
          payload: { due_date: '2026-12-31' },
          createdAt: '2026-03-11T09:00:00.000Z',
          actorEmail: 'ana@estudio.com',
        },
        { id: 'e4', type: 'imported', createdAt: '2026-03-10T08:00:00.000Z' },
      ],
    },
    agent: { command: 'opencode run --model opencode/big-pickle', repository: '~/repos/finn' },
  },
}

/** Fecha vencida en un bug abierto: la fecha reclama. */
export const Vencido: Story = {
  args: { bug: { ...bug, dueDate: '2020-01-15', status: 'nuevo', assignees: [equipo[0]] } },
}

/** La misma fecha vencida, ya resuelto: no reclama nada. */
export const VencidoPeroResuelto: Story = {
  args: { bug: { ...bug, dueDate: '2020-01-15', status: 'solucionado' } },
}

/** Sin permisos de escritura: se lee, no se edita. */
export const SoloLectura: Story = {
  args: { onSetStatus: undefined, onSetAssignees: undefined, onSetDueDate: undefined },
}
