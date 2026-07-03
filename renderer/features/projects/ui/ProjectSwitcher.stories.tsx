import type { Meta, StoryObj } from '@storybook/react'
import ProjectSwitcher from './ProjectSwitcher'

const projects = [
  { id: 'project-1', name: 'buglens', slug: 'buglens-default' },
  { id: 'project-2', name: 'cliente mobile', slug: 'cliente-mobile' },
  { id: 'project-3', name: 'backoffice', slug: 'backoffice' },
]

const meta = {
  title: 'buglens/ProjectSwitcher',
  component: ProjectSwitcher,
  args: {
    activeProject: projects[0],
    projects,
    busy: false,
    onSelect: () => {},
    onCreate: () => {},
  },
} satisfies Meta<typeof ProjectSwitcher>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Busy: Story = {
  args: { busy: true },
}
