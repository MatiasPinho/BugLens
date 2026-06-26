import { describe, expect, it, vi } from 'vitest'
import { bugRecordKey } from '../pipeline/bugStatusKey'
import type { AnalyzedBug } from '../types/index'
import {
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
          },
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
    expect(rpc).toHaveBeenCalledWith('list_project_bugs', {
      target_project_id: 'project-1',
      result_limit: 500,
    })
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
