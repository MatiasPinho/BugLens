import { describe, expect, it, vi } from 'vitest'
import { createSupabaseProject, getSupabaseTeamStatus } from './teamClient'

const user = { id: 'user-1', email: 'qa@example.com' }

function config(overrides: Partial<Parameters<typeof getSupabaseTeamStatus>[1]> = {}) {
  return {
    url: 'https://example.supabase.co',
    publishableKey: 'pk',
    defaultProjectName: 'buglens',
    defaultProjectSlug: 'buglens-default',
    ...overrides,
  }
}

function clientWithProjects(projects: Array<{ id: string; name: string; slug: string }>) {
  const order = vi.fn().mockResolvedValue({ data: projects, error: null })
  const select = vi.fn().mockReturnValue({ order })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn().mockReturnValue({ select }),
  }
}

describe('teamClient', () => {
  it('usa el proyecto activo cuando existe en la lista del usuario', async () => {
    const client = clientWithProjects([
      { id: 'project-1', name: 'buglens', slug: 'buglens-default' },
      { id: 'project-2', name: 'cliente', slug: 'cliente' },
    ])

    const status = await getSupabaseTeamStatus(
      client as never,
      config({ activeProjectId: 'project-2' }),
    )

    expect(status.project).toEqual({ id: 'project-2', name: 'cliente', slug: 'cliente' })
    expect(status.projects).toHaveLength(2)
  })

  it('cae al proyecto default si el activo guardado ya no está disponible', async () => {
    const client = clientWithProjects([
      { id: 'project-1', name: 'buglens', slug: 'buglens-default' },
      { id: 'project-2', name: 'cliente', slug: 'cliente' },
    ])

    const status = await getSupabaseTeamStatus(
      client as never,
      config({ activeProjectId: 'project-missing' }),
    )

    expect(status.project).toEqual({ id: 'project-1', name: 'buglens', slug: 'buglens-default' })
  })

  it('crea un proyecto con el usuario autenticado como owner', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        project_id: 'project-3',
        project_name_result: 'Producto QA',
        project_slug_result: 'producto-qa',
      },
      error: null,
    })
    const rpc = vi.fn().mockReturnValue({ single })
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      rpc,
    }

    const project = await createSupabaseProject(client as never, 'Producto QA', 'producto-qa')

    expect(project).toEqual({ id: 'project-3', name: 'Producto QA', slug: 'producto-qa' })
    expect(rpc).toHaveBeenCalledWith('create_project', {
      project_name: 'Producto QA',
      project_slug: 'producto-qa',
    })
  })
})
