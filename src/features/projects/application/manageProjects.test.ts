import { describe, expect, it, vi } from 'vitest'
import {
  createProjectAndLoadStatus,
  isProjectTeamConfigured,
  projectTeamErrorStatus,
} from './manageProjects.js'

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'pk',
  defaultProjectName: 'buglens',
  defaultProjectSlug: 'buglens-default',
}

describe('manageProjects', () => {
  it('detecta si Supabase de equipo estÃ¡ configurado', () => {
    expect(isProjectTeamConfigured(config)).toBe(true)
    expect(isProjectTeamConfigured({ ...config, url: '' })).toBe(false)
    expect(isProjectTeamConfigured({ ...config, publishableKey: '' })).toBe(false)
  })

  it('construye estados de error consistentes para auth/proyectos', () => {
    expect(projectTeamErrorStatus(config, 'fallÃ³ auth')).toEqual({
      configured: true,
      authenticated: false,
      error: 'fallÃ³ auth',
    })
  })

  it('crea un proyecto y devuelve status usando ese proyecto activo', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        project_id: 'project-2',
        project_name_result: 'Cliente QA',
        project_slug_result: 'cliente-qa',
      },
      error: null,
    })
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 'project-1', name: 'buglens', slug: 'buglens-default' },
        { id: 'project-2', name: 'Cliente QA', slug: 'cliente-qa' },
      ],
      error: null,
    })
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
      rpc: vi.fn().mockReturnValue({ single }),
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order }) }),
    }

    const status = await createProjectAndLoadStatus(
      client as never,
      config,
      'Cliente QA',
      'cliente-qa',
    )

    expect(status.project).toEqual({ id: 'project-2', name: 'Cliente QA', slug: 'cliente-qa' })
    expect(client.rpc).toHaveBeenCalledWith('create_project', {
      project_name: 'Cliente QA',
      project_slug: 'cliente-qa',
    })
  })
})
