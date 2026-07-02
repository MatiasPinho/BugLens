import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ProjectSwitcher from './ProjectSwitcher'

const projects = [
  { id: 'project-1', name: 'buglens', slug: 'buglens-default' },
  { id: 'project-2', name: 'cliente', slug: 'cliente' },
]

describe('ProjectSwitcher', () => {
  it('permite cambiar el proyecto activo', async () => {
    const onSelect = vi.fn()
    render(
      <ProjectSwitcher
        activeProject={projects[0]}
        projects={projects}
        onSelect={onSelect}
        onCreate={vi.fn()}
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText('proyecto activo'), 'project-2')

    expect(onSelect).toHaveBeenCalledWith('project-2')
  })

  it('crea un proyecto nuevo normalizando el slug', async () => {
    const onCreate = vi.fn()
    render(
      <ProjectSwitcher
        activeProject={projects[0]}
        projects={projects}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /nuevo proyecto/ }))
    await userEvent.type(screen.getByLabelText('nombre'), 'Área QA')
    await userEvent.click(screen.getByRole('button', { name: /crear/ }))

    expect(onCreate).toHaveBeenCalledWith('Área QA', 'area-qa')
  })
})
