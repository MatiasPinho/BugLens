import type { Meta, StoryObj } from '@storybook/react-vite'
import AppTopbar from './AppTopbar'

const meta = {
  title: 'buglens/shell/AppTopbar',
  component: AppTopbar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="app-content" style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    breadcrumb: ['Bugs'],
    user: { id: 'perfil-1', email: 'matias@estudio.com', provider: 'Google Auth' },
    onSignOut: () => {},
  },
} satisfies Meta<typeof AppTopbar>
export default meta
type Story = StoryObj<typeof AppTopbar>

export const Default: Story = {}

/** Todo el contexto global junto: proyecto, motor, acciones e identidad. */
export const Completo: Story = {
  args: {
    projectSlot: (
      <button type="button" className="project-select">
        <span className="project-mark project-mark-sm">BU</span>
        <span className="project-select-trigger truncate">buglens</span>
        <span className="project-select-caret" aria-hidden="true" />
      </button>
    ),
    statusSlot: (
      <span className="badge badge-accent" role="status">
        <span className="dot" aria-hidden="true" />
        Ollama local
      </span>
    ),
    actions: (
      <>
        <button type="button" className="btn-secondary">
          Cargar bug manual
        </button>
        <button type="button" className="btn-primary">
          Analizar bugs
        </button>
      </>
    ),
    members: [
      { id: 'perfil-1', displayName: 'Matias Pinho' },
      { id: 'perfil-2', email: 'lucia@estudio.com' },
      { id: 'perfil-3', displayName: 'Ana Lopez' },
    ],
  },
}

/** La miga final es el bug abierto, no la sección. */
export const ConBugAbierto: Story = {
  args: { breadcrumb: ['Bugs', 'Login queda cargando con credenciales válidas'] },
}

/** Sin sesión: el topbar queda solo con la ubicación. */
export const SinUsuario: Story = { args: { user: undefined, onSignOut: undefined } }
