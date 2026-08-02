import type { Meta, StoryObj } from '@storybook/react-vite'
import ProjectsScreen from './ProjectsScreen'

const projects = [
  { id: 'project-finn', name: 'Finn App', slug: 'finn-app' },
  { id: 'project-checkout', name: 'Checkout', slug: 'checkout' },
  { id: 'project-ops', name: 'Operaciones internas', slug: 'operaciones-internas' },
]

const meta = {
  title: 'buglens/ProjectsScreen',
  component: ProjectsScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    projects,
    activeProjectId: projects[0].id,
    activeProjectBugCount: 24,
    onSelect: () => {},
    onCreate: () => {},
  },
  decorators: [
    (Story) => (
      <div className="app-main h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SinProyectos: Story = {
  args: { projects: [], activeProjectId: undefined, activeProjectBugCount: undefined },
}
