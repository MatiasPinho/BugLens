import { describe, expect, it, vi } from 'vitest'
import type { AnalyzedBug } from '../../../shared/contracts/bugTypes'
import { bugRecordKey } from '../../bug-workflow/domain/bugStatusKey'
import {
  addRemoteBugComment,
  createRemoteBugImport,
  deleteRemoteBug,
  loadRemoteAnalyzedBugs,
  loadRemoteProjectMembers,
  mapRemoteBugRow,
  saveRemoteAnalysisResult,
  setRemoteBugAssignees,
  setRemoteBugDueDate,
  setRemoteBugStatus,
  setRemoteCommentVote,
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

  it('agrega un comentario por RPC, recortado y con el padre del hilo', async () => {
    mockTeamStatus()
    const raw = { title: 'Login roto', description: 'No entra al sistema.' }
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'comment-2',
        parentId: 'comment-1',
        body: '10 de marzo: se reabre.',
        createdAt: '2026-03-10T12:00:00.000Z',
        authorEmail: 'qa@example.com',
        upvotes: 0,
        downvotes: 0,
        myVote: 0,
      },
      error: null,
    })

    const comment = await addRemoteBugComment(
      { rpc } as never,
      config(),
      raw,
      '  10 de marzo: se reabre.  ',
      'comment-1',
    )

    expect(comment).toMatchObject({
      id: 'comment-2',
      parentId: 'comment-1',
      body: '10 de marzo: se reabre.',
      authorEmail: 'qa@example.com',
      upvotes: 0,
      myVote: 0,
    })
    // El servidor valida que el padre sea del mismo bug: por eso va por RPC.
    expect(rpc).toHaveBeenCalledWith('add_bug_comment', {
      target_project_id: 'project-1',
      target_content_key: bugRecordKey(raw),
      comment_body: '10 de marzo: se reabre.',
      parent_comment_id: 'comment-1',
    })
  })

  it('manda null como padre cuando el comentario es raíz', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({
      data: { id: 'c1', body: 'nota', createdAt: '2026-03-10T12:00:00.000Z' },
      error: null,
    })

    await addRemoteBugComment(
      { rpc } as never,
      config(),
      { title: 't', description: 'd' },
      'nota',
    )

    expect(rpc.mock.calls[0][1]).toMatchObject({ parent_comment_id: null })
  })

  it('rechaza un comentario vacío sin llamar al servidor', async () => {
    mockTeamStatus()
    const rpc = vi.fn()

    await expect(
      addRemoteBugComment({ rpc } as never, config(), { title: 't', description: 'd' }, '   '),
    ).rejects.toThrow(/vacío/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reemplaza el conjunto completo de responsables', async () => {
    mockTeamStatus()
    const raw = { title: 'Login roto', description: 'No entra.' }
    const rpc = vi.fn().mockResolvedValue({ data: 'bug-1', error: null })

    await setRemoteBugAssignees({ rpc } as never, config(), raw, ['user-1', 'user-2'])

    expect(rpc).toHaveBeenCalledWith('set_bug_assignees', {
      target_project_id: 'project-1',
      target_content_key: bugRecordKey(raw),
      next_user_ids: ['user-1', 'user-2'],
    })
  })

  it('deja sin responsables mandando una lista vacía', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({ data: 'bug-1', error: null })

    await setRemoteBugAssignees({ rpc } as never, config(), { title: 't', description: 'd' }, [])

    expect(rpc.mock.calls[0][1]).toMatchObject({ next_user_ids: [] })
  })

  it('limpia la fecha límite mandando null', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({ data: 'bug-1', error: null })

    await setRemoteBugDueDate({ rpc } as never, config(), { title: 't', description: 'd' }, null)

    expect(rpc.mock.calls[0][1]).toMatchObject({ next_due: null })
  })

  it('devuelve los totales de voto que calculó el servidor', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({
      data: { commentId: 'c1', upvotes: 3, downvotes: 1, myVote: 1 },
      error: null,
    })

    const totals = await setRemoteCommentVote({ rpc } as never, config(), 'c1', 1)

    expect(totals).toEqual({ commentId: 'c1', upvotes: 3, downvotes: 1, myVote: 1 })
    expect(rpc).toHaveBeenCalledWith('set_comment_vote', {
      target_comment_id: 'c1',
      next_value: 1,
    })
  })

  it('tolera que los agregados de voto lleguen como string', async () => {
    mockTeamStatus()
    // Un count grande de Postgres puede serializarse como string.
    const rpc = vi.fn().mockResolvedValue({
      data: { upvotes: '12', downvotes: '0', myVote: '-1' },
      error: null,
    })

    const totals = await setRemoteCommentVote({ rpc } as never, config(), 'c1', -1)

    expect(totals).toMatchObject({ upvotes: 12, downvotes: 0, myVote: -1 })
  })

  it('carga los miembros del proyecto', async () => {
    mockTeamStatus()
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: 'user-1', email: 'qa@example.com', displayName: 'QA', role: 'editor' },
        { id: 'user-2', email: 'dev@example.com' },
        { email: 'sin-id@example.com' },
      ],
      error: null,
    })

    const members = await loadRemoteProjectMembers({ rpc } as never, config())

    // La fila sin id se descarta: sin identidad no se puede asignar ni pintar avatar.
    expect(members).toHaveLength(2)
    expect(members[0]).toEqual({
      id: 'user-1',
      email: 'qa@example.com',
      displayName: 'QA',
      role: 'editor',
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
    // Lo que agrega el rediseño también tiene default seguro.
    expect(result.assignees).toEqual([])
    expect(result.activity).toEqual([])
    expect(result.dueDate).toBeNull()
    expect(result.reportedBy).toBeNull()
  })

  it('mapea responsables, fecha límite, autor y actividad', () => {
    const result = mapRemoteBugRow(
      {
        rawBug: { title: 'Login roto' },
        dueDate: '2026-06-12',
        reportedBy: { id: 'user-1', email: 'qa@example.com', displayName: 'QA' },
        assignees: [
          { id: 'user-2', email: 'dev@example.com' },
          { email: 'sin-id@example.com' },
        ],
        activity: [
          {
            id: 'evento-1',
            type: 'status_changed',
            fromStatus: 'nuevo',
            toStatus: 'en_progreso',
            createdAt: '2026-03-10T12:00:00.000Z',
            actorEmail: 'qa@example.com',
          },
          { id: 'evento-2', type: 'inventado_por_una_migracion_futura', createdAt: '2026-03-11' },
        ],
      },
      0,
    )

    expect(result.dueDate).toBe('2026-06-12')
    expect(result.reportedBy?.displayName).toBe('QA')
    // Sin id no hay identidad: se descarta.
    expect(result.assignees).toHaveLength(1)
    expect(result.assignees?.[0].id).toBe('user-2')
    // Un tipo de evento desconocido se descarta en vez de romper el listado.
    expect(result.activity).toHaveLength(1)
    expect(result.activity?.[0].type).toBe('status_changed')
  })

  it('mapea comentarios con hilo y voto', () => {
    const result = mapRemoteBugRow(
      {
        rawBug: { title: 'Login roto' },
        comments: [
          {
            id: 'c1',
            body: 'raíz',
            createdAt: '2026-03-10T12:00:00.000Z',
            upvotes: 5,
            downvotes: 1,
            myVote: 1,
          },
          {
            id: 'c2',
            parentId: 'c1',
            body: 'respuesta',
            createdAt: '2026-03-10T13:00:00.000Z',
          },
          { id: 'sin-cuerpo', createdAt: '2026-03-10T14:00:00.000Z' },
        ],
      },
      0,
    )

    expect(result.comments).toHaveLength(2)
    expect(result.comments?.[0]).toMatchObject({
      id: 'c1',
      parentId: null,
      upvotes: 5,
      downvotes: 1,
      myVote: 1,
    })
    expect(result.comments?.[1]).toMatchObject({ id: 'c2', parentId: 'c1', upvotes: 0, myVote: 0 })
  })
})
