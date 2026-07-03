import type { Meta, StoryObj } from '@storybook/react-vite'
import TeamLogin from './TeamLogin'

const meta = {
  title: 'buglens/TeamLogin',
  component: TeamLogin,
  args: {
    loading: false,
    onLogin: () => {},
    status: {
      configured: true,
      authenticated: false,
    },
  },
} satisfies Meta<typeof TeamLogin>
export default meta
type Story = StoryObj<typeof TeamLogin>

export const LoginRequerido: Story = {}

export const Cargando: Story = {
  args: { loading: true },
}

export const Conectado: Story = {
  args: {
    status: {
      configured: true,
      authenticated: true,
      user: { id: 'user-1', email: 'qa@example.com' },
      project: { id: 'project-1', name: 'buglens', slug: 'buglens-default' },
    },
  },
}

export const SinConfigurar: Story = {
  args: {
    status: {
      configured: false,
      authenticated: false,
    },
  },
}
