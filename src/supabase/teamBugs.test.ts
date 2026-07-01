import { describe, expect, it, vi } from 'vitest'
import { bugRecordKey } from '../pipeline/bugStatusKey'
import type { AnalyzedBug } from '../types/index'
import {
  addRemoteBugComment,
  createRemoteBugImport,
  deleteRemoteBug,
  loadRemoteAnalyzedBugs,
  mapRemoteBugRow,
  saveRemoteAnalysisResult,
  setRemoteBugStatus,
} from './teamBugs'
import * as teamClient from './teamClient'

describe('teamBugs', () => {
  function config() {
    return {
      url: 'https://example.supabase.co',
      publishableKey: 'pk',
      defaultProjectName: 'buglens',
      defaultProjectSlug: 'buglens-default',
    }
  }

  function mockTeamStatus() {
    vi.spyOn(teamClient, 'getSupabaseTeamStatus').mockResolvedValue({
      configured: true,
      authenticated: true,
      user: { id: 'user-1', email: 'qa@example.com' },
      project: { id: 'project-1', name: 'buglens', slug: 'buglens-default' },
    })
  }

  it('upsertea estado remoto con project_id y content_key', async () => {
    mockTeamStatus()

    const single = vi.fn().mockResolvedValue({
      data: { bug_id: 'bug-remote-1', status: 'en_progreso' },
      error: null,
    })
    const rpc = vi.fn().mockReturnValue({ single })
    const client = { rpc }

    const raw = { title: 'Login roto', description: 'No entra al sistema.' }
    const result = await setRemoteBugStatus(client as never, config(), raw, 'en_progreso')

    expect(result).toEqual({ bugId: 'bug-remote-1', status: 'en_progreso' })
    expect(rpc).toHaveBeenCalledWith('upsert_bug_status', {
      target_project_id: 'project-1',
      target_content_key: bugRecordKey(raw),
      bug_title: 'Login roto',
      bug_description: 'No entra al sistema.',
      next_status: 'en_progreso',
    })
  })

  it('falla si no hay proyecto autenticado', async () => {
    vi.spyOn(teamClient, 'getSupabaseTeamStatus').mockResolvedValue({
      configured: true,
      authenticated: false,
    })

    await expect(
      setRemoteBugStatus(
        { rpc: vi.fn() } as never,
        config(),
        { title: 'Bug', description: '' },
        'cerrado',
      ),
    ).rejects.toThrow(/No hay sesión/)
  })

  it('borra un bug remoto por content_key', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({ data: 'bug-remote-1', error: null })
    const raw = { title: 'Login roto', description: 'No entra al sistema.' }

    const bugId = await deleteRemoteBug({ rpc } as never, config(), raw)

    expect(bugId).toBe('bug-remote-1')
    expect(rpc).toHaveBeenCalledWith('delete_project_bug', {
      target_project_id: 'project-1',
      target_content_key: bugRecordKey(raw),
    })
  })

  it('agrega un comentario remoto al bug resuelto por content_key', async () => {
    mockTeamStatus()
    const raw = { title: 'Login roto', description: 'No entra al sistema.' }
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'bug-1' }, error: null })
    const bugsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle,
    }
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'comment-1',
        body: '10 de marzo: se reabre.',
        created_at: '2026-03-10T12:00:00.000Z',
        updated_at: '2026-03-10T12:00:00.000Z',
      },
      error: null,
    })
    const commentsQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single,
    }
    const from = vi
      .fn()
      .mockImplementation((table: string) => (table === 'bugs' ? bugsQuery : commentsQuery))

    const comment = await addRemoteBugComment(
      { from } as never,
      config(),
      raw,
      '  10 de marzo: se reabre.  ',
    )

    expect(comment).toMatchObject({
      id: 'comment-1',
      body: '10 de marzo: se reabre.',
      authorEmail: 'qa@example.com',
    })
    expect(bugsQuery.eq).toHaveBeenCalledWith('content_key', bugRecordKey(raw))
    expect(commentsQuery.insert).toHaveBeenCalledWith({
      bug_id: 'bug-1',
      project_id: 'project-1',
      body: '10 de marzo: se reabre.',
      created_by: 'user-1',
    })
  })

  it('crea un import remoto', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({ data: 'import-1', error: null })

    const result = await createRemoteBugImport({ rpc } as never, config(), {
      sourceType: 'excel',
      sourceName: 'bugs.xlsx',
      sourcePath: '/tmp/bugs.xlsx',
      rowCount: 3,
    })

    expect(result).toBe('import-1')
    expect(rpc).toHaveBeenCalledWith('create_bug_import', {
      target_project_id: 'project-1',
      input_source_type: 'excel',
      input_source_name: 'bugs.xlsx',
      input_source_path: '/tmp/bugs.xlsx',
      input_row_count: 3,
      input_metadata: {},
    })
  })

  it('guarda un análisis remoto completo', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({ data: 'bug-remote-1', error: null })
    const result: AnalyzedBug = {
      enriched: {
        raw: {
          id: 'bug-0001',
          rowIndex: 1,
          title: 'Login roto',
          description: 'No entra',
          rawRow: { Título: 'Login roto' },
          googleDocLinks: ['https://docs.google.com/document/d/abc/edit'],
        },
        googleDocs: [{ url: 'u', title: 'Doc', text: 'Evidencia', accessible: true }],
      },
      analysis: {
        category: 'frontend',
        severity: 'high',
        bugType: 'ui',
        confidence: 0.9,
        affectedArea: 'login',
        summary: 'No entra',
        rewritten: {
          observed: 'No entra',
          expected: 'Debe entrar',
          steps: ['Abrir login'],
          environment: 'dev',
          problemCount: 1,
        },
        missingInformation: [],
        rawResponse: '{}',
      },
      status: 'nuevo',
      processingMs: 42,
    }

    const bugId = await saveRemoteAnalysisResult({ rpc } as never, config(), result, {
      importId: 'import-1',
      sourceType: 'excel',
      provider: 'ollama',
      model: 'qwen2.5:7b',
    })

    expect(bugId).toBe('bug-remote-1')
    expect(rpc).toHaveBeenCalledWith('save_analysis_result', {
      target_project_id: 'project-1',
      input_source_type: 'excel',
      input_source_row_index: 1,
      input_source_bug_id: 'bug-0001',
      target_import_id: 'import-1',
      target_content_key: bugRecordKey(result.enriched.raw),
      target_status: 'nuevo',
      input_raw_bug: result.enriched.raw,
      input_google_doc_links: result.enriched.raw.googleDocLinks,
      input_enriched_docs: result.enriched.googleDocs,
      input_analysis: result.analysis,
      input_provider: 'ollama',
      input_model: 'qwen2.5:7b',
      input_prompt_version: null,
      input_error: null,
      input_processing_ms: 42,
    })
  })

  it('carga bugs analizados desde el proyecto remoto', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          status: 'en_progreso',
          rawBug: {
            id: 'bug-1',
            rowIndex: 2,
            title: 'Filtro roto',
            description: 'No filtra',
            rawRow: { Título: 'Filtro roto' },
            googleDocLinks: [],
          },
          analysis: {
            category: 'frontend',
            severity: 'medium',
            confidence: 0.8,
            affectedArea: 'listado',
            summary: 'No filtra',
            rewritten: {
              observed: 'No filtra',
              expected: 'Debe filtrar',
              steps: ['Abrir listado'],
              environment: 'dev',
              problemCount: 1,
            },
            missingInformation: [],
            rawResponse: '{}',
            externalAgent: {
              ok: true,
              output: 'Revisar src/filtros.ts',
              command: 'opencode run',
              workingDirectory: '/repo/app',
              durationMs: 1200,
            },
          },
          externalAgentHistory: [
            {
              ok: true,
              output: 'Revisar src/filtros.ts',
              command: 'opencode run',
              workingDirectory: '/repo/app',
              durationMs: 1200,
              createdAt: '2026-03-10T10:00:00.000Z',
            },
            {
              ok: true,
              output: 'Resultado anterior',
              command: 'opencode run',
              durationMs: 900,
              createdAt: '2026-03-09T10:00:00.000Z',
            },
          ],
          comments: [
            {
              id: 'comment-1',
              body: '10 de marzo: se reabre por nueva evidencia.',
              createdAt: '2026-03-10T12:00:00.000Z',
              updatedAt: '2026-03-10T12:00:00.000Z',
              authorEmail: 'qa@example.com',
            },
          ],
          googleDocs: [],
          processingMs: 12,
        },
      ],
      error: null,
    })

    const results = await loadRemoteAnalyzedBugs({ rpc } as never, config())

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('en_progreso')
    expect(results[0].enriched.raw.title).toBe('Filtro roto')
    expect(results[0].analysis.externalAgent?.output).toBe('Revisar src/filtros.ts')
    expect(results[0].analysis.externalAgent?.workingDirectory).toBe('/repo/app')
    expect(results[0].analysis.externalAgentHistory).toHaveLength(2)
    expect(results[0].analysis.externalAgentHistory?.[1].output).toBe('Resultado anterior')
    expect(results[0].comments).toHaveLength(1)
    expect(results[0].comments?.[0].body).toContain('se reabre')
    expect(rpc).toHaveBeenCalledWith('list_project_bugs', {
      target_project_id: 'project-1',
      result_limit: 500,
    })
  })

  it('hidrata comentarios e historial del agente aunque list_project_bugs no los incluya', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          bugId: 'bug-1',
          status: 'nuevo',
          rawBug: {
            id: 'bug-1',
            rowIndex: 2,
            title: 'Filtro roto',
            description: 'No filtra',
            rawRow: {},
            googleDocLinks: [],
          },
          analysis: {
            category: 'frontend',
            severity: 'medium',
            confidence: 0.8,
            affectedArea: 'listado',
            summary: 'No filtra',
            rewritten: {
              observed: 'No filtra',
              expected: 'Debe filtrar',
              steps: [],
              environment: 'dev',
              problemCount: 1,
            },
            missingInformation: [],
            rawResponse: '{}',
          },
          googleDocs: [],
          processingMs: 12,
        },
      ],
      error: null,
    })
    const commentsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'comment-1',
            bug_id: 'bug-1',
            body: '25 de marzo: se reabre.',
            created_at: '2026-03-25T12:00:00.000Z',
            updated_at: '2026-03-25T12:00:00.000Z',
          },
        ],
        error: null,
      }),
    }
    const agentRunsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            bug_id: 'bug-1',
            created_at: '2026-03-25T13:00:00.000Z',
            analysis: {
              externalAgent: {
                ok: true,
                output: 'Análisis guardado',
                command: 'opencode run',
                durationMs: 1000,
              },
            },
          },
        ],
        error: null,
      }),
    }
    const from = vi
      .fn()
      .mockImplementation((table: string) =>
        table === 'bug_comments' ? commentsQuery : agentRunsQuery,
      )

    const results = await loadRemoteAnalyzedBugs({ rpc, from } as never, config())

    expect(results[0].comments?.[0].body).toBe('25 de marzo: se reabre.')
    expect(results[0].analysis.externalAgent?.output).toBe('Análisis guardado')
    expect(results[0].analysis.externalAgentHistory?.[0].createdAt).toBe('2026-03-25T13:00:00.000Z')
  })

  it('mapea una fila remota incompleta con defaults seguros', () => {
    const result = mapRemoteBugRow({ rawBug: { title: 'Sin análisis' } }, 0)

    expect(result.enriched.raw.id).toBe('remote-1')
    expect(result.enriched.raw.title).toBe('Sin análisis')
    expect(result.status).toBe('nuevo')
    expect(result.analysis.category).toBe('otro')
    expect(result.analysis.rewritten.expected).toBe('No informado')
  })
})
