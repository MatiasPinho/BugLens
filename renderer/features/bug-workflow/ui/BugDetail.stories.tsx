import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeBug, makeComment } from '../../../components/_storyFixtures'
import BugDetail from './BugDetail'

const bug = makeBug({
  id: '12',
  title: 'Login queda cargando con credenciales válidas',
  summary:
    'El envío del formulario no resuelve: el spinner queda activo y no hay navegación ni mensaje de error visible.',
  severity: 'critical',
  status: 'en_progreso',
  observed:
    'Al enviar credenciales válidas el botón queda con el spinner activo. La vista no cambia y en la consola aparece un 500 de /api/session.',
  expected:
    'Debería validar las credenciales y navegar al dashboard, o mostrar un error visible y liberar el estado de carga.',
  steps: [
    'Abrir /auth/login en Safari sobre iOS 17.',
    'Ingresar un usuario y contraseña válidos.',
    'Tocar "Entrar" y esperar 30 segundos.',
  ],
  environment: 'prod · iOS 17 Safari',
  missing: [
    'El mensaje exacto de la consola',
    'Si pasa también en Chrome iOS',
    'El usuario de prueba usado',
  ],
})

const project = { name: 'Finn App', slug: 'finn-app', bugCount: 24 }

const meta = {
  title: 'buglens/BugDetail',
  component: BugDetail,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    bug,
    project,
    onBack: () => {},
    onSetStatus: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof BugDetail>
export default meta
type Story = StoryObj<typeof BugDetail>

export const Default: Story = {}

export const ConNotas: Story = {
  args: {
    bug: {
      ...bug,
      comments: [
        makeComment({
          id: 'comment-1',
          body: 'Reproducido en prod. Es la política de cookies de Safari: la sesión no se guarda.',
          createdAt: '2026-03-10T20:00:00.000Z',
          authorEmail: 'matias@estudio.com',
          upvotes: 3,
        }),
        makeComment({
          id: 'comment-2',
          parentId: 'comment-1',
          body: 'Avisá cuando esté para testear y lo vuelvo a pasar en el iPhone 13.',
          createdAt: '2026-03-10T21:30:00.000Z',
          authorEmail: 'lucia@estudio.com',
          myVote: 1,
          upvotes: 1,
        }),
      ],
    },
  },
}

export const ConAnalisisDelAgente: Story = {
  args: {
    bug: {
      ...bug,
      analysis: {
        ...bug.analysis,
        externalAgent: {
          ok: true,
          output:
            '## Resumen\nEl submit no resuelve porque la sesión no persiste en Safari.\n\n## Archivos o áreas a revisar\nsrc/auth/session.ts:42 — creación de la cookie de sesión\n\n## Próximos pasos\n- Setear SameSite=None; Secure en la cookie.',
          command: 'codex exec',
          durationMs: 42000,
          createdAt: '2026-03-11T10:00:00.000Z',
        },
      },
    },
  },
}
