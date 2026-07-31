import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeBug, makeComment } from '../../../components/_storyFixtures'
import BugComments from './BugComments'

const bug = makeBug({ id: 'a', title: 'Login queda cargando' })

const meta = {
  title: 'buglens/bugs/BugComments',
  component: BugComments,
  decorators: [
    (Story) => (
      <div className="bugs-center" style={{ maxWidth: 720, padding: '1.5rem 0' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    bug,
    onAddComment: async () => {},
    onVote: () => {},
  },
} satisfies Meta<typeof BugComments>
export default meta
type Story = StoryObj<typeof BugComments>

export const Vacio: Story = { args: { comments: [] } }

export const ConHilo: Story = {
  args: {
    comments: [
      makeComment({
        id: 'c1',
        body: 'Reproducido en prod. Es la política de cookies de Safari: la sesión no se guarda.',
        authorName: 'Lucía Gómez',
        createdAt: '2026-03-10T20:00:00.000Z',
        upvotes: 3,
      }),
      makeComment({
        id: 'c2',
        parentId: 'c1',
        body: 'Avisá cuando esté para testear y lo vuelvo a pasar en el iPhone 13.',
        authorName: 'Matias Pinho',
        createdAt: '2026-03-10T21:30:00.000Z',
        myVote: 1,
        upvotes: 1,
      }),
      makeComment({
        id: 'c3',
        parentId: 'c2',
        body: 'Listo, quedó en staging.',
        authorName: 'Ana Lopez',
        createdAt: '2026-03-11T09:00:00.000Z',
      }),
      makeComment({
        id: 'c4',
        body: 'Che, ¿esto bloquea la release?',
        authorEmail: 'diego@estudio.com',
        createdAt: '2026-03-11T10:00:00.000Z',
        downvotes: 1,
        myVote: -1,
      }),
    ],
  },
}

/** Sin permisos de escritura: se lee el hilo pero no se comenta ni se vota. */
export const SoloLectura: Story = {
  args: {
    comments: [
      makeComment({ id: 'c1', body: 'Reproducido en prod.', authorName: 'Lucía Gómez' }),
    ],
    onAddComment: undefined,
    onVote: undefined,
  },
}
