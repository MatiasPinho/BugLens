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

    await userEvent.click(screen.getByLabelText('proyecto activo'))
    await userEvent.click(screen.getByRole('option', { name: /cliente/ }))

    expect(onSelect).toHaveBeenCalledWith('project-2')
  })

  it('permite elegir proyecto con teclado sin usar el select nativo', async () => {
    const onSelect = vi.fn()
    render(
      <ProjectSwitcher
        activeProject={projects[0]}
        projects={projects}
        onSelect={onSelect}
        onCreate={vi.fn()}
      />,
    )

    screen.getByLabelText('proyecto activo').focus()
    await userEvent.keyboard('{ArrowDown}{Enter}')

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

    // "Nuevo proyecto" vive dentro del desplegable: el trigger del topbar solo
    // tiene lugar para el proyecto activo.
    await userEvent.click(screen.getByLabelText('proyecto activo'))
    await userEvent.click(screen.getByRole('button', { name: /nuevo proyecto/i }))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Área QA')
    await userEvent.click(screen.getByRole('button', { name: /crear proyecto/i }))

    expect(onCreate).toHaveBeenCalledWith('Área QA', 'area-qa')
  })
})
