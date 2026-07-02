import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyzedBug, BugStatus } from '../../src/types/index'
import BugTable from './BugTable'

// Factory: arma un AnalyzedBug completo, sobreescribible por test (sin beforeEach).
function makeBug(
  over: { id: string; title: string; status?: BugStatus } & Partial<AnalyzedBug['analysis']>,
): AnalyzedBug {
  const { id, title, status = 'nuevo', ...analysis } = over
  return {
    enriched: {
      raw: { id, rowIndex: 1, title, description: `desc ${id}`, rawRow: {}, googleDocLinks: [] },
      googleDocs: [],
    },
    analysis: {
      category: 'frontend',
      severity: 'medium',
      confidence: 0.8,
      affectedArea: 'formularios',
      summary: `resumen ${id}`,
      rewritten: { observed: 'o', expected: 'e', steps: [], environment: 'dev', problemCount: 1 },
      missingInformation: [],
      rawResponse: '{}',
      ...analysis,
    },
    status,
    processingMs: 10,
  }
}

async function chooseOption(label: string, option: string) {
  await userEvent.click(screen.getByLabelText(label))
  await userEvent.click(screen.getByRole('option', { name: option }))
}

describe('BugTable — estados', () => {
  it('renderiza una fila por bug con su título', () => {
    render(<BugTable results={[makeBug({ id: 'bug-1', title: 'Login roto' })]} />)
    expect(screen.getByText('Login roto')).toBeInTheDocument()
  })

  it('el selector de estado muestra el estado actual', async () => {
    render(
      <BugTable
        results={[makeBug({ id: 'bug-1', title: 'X', status: 'solucionado' })]}
        onSetStatus={vi.fn()}
      />,
    )
    // 'solucionado' es histórico → no se ve en la pestaña por defecto.
    await userEvent.click(screen.getByRole('tab', { name: /todos/ }))
    expect(screen.getByLabelText('estado del bug')).toHaveTextContent('solucionado')
  })

  it('cambiar el estado llama onSetStatus con el bug y el nuevo estado', async () => {
    const onSetStatus = vi.fn()
    const bug = makeBug({ id: 'bug-1', title: 'X' })
    render(<BugTable results={[bug]} onSetStatus={onSetStatus} />)

    await chooseOption('estado del bug', 'solucionado')

    expect(onSetStatus).toHaveBeenCalledTimes(1)
    const [bugArg, statusArg] = onSetStatus.mock.calls[0]
    expect(statusArg).toBe('solucionado')
    expect(bugArg.enriched.raw.id).toBe('bug-1')
  })

  it('filtrar por estado oculta los bugs que no coinciden', async () => {
    const results = [
      makeBug({ id: 'a', title: 'Bug activo', status: 'nuevo' }),
      makeBug({ id: 'b', title: 'Bug resuelto', status: 'solucionado' }),
    ]
    render(<BugTable results={results} onSetStatus={vi.fn()} />)

    // En 'todos' conviven ambos; el filtro de estado refina dentro de la vista.
    await userEvent.click(screen.getByRole('tab', { name: /todos/ }))
    expect(screen.getByText('Bug activo')).toBeInTheDocument()
    expect(screen.getByText('Bug resuelto')).toBeInTheDocument()

    await chooseOption('filtrar por estado', 'solucionado')

    expect(screen.queryByText('Bug activo')).not.toBeInTheDocument()
    expect(screen.getByText('Bug resuelto')).toBeInTheDocument()
  })
})

describe('BugTable — ciclo de vida (activos / históricos)', () => {
  const mixed = () => [
    makeBug({ id: 'a', title: 'Activo nuevo', status: 'nuevo' }),
    makeBug({ id: 'b', title: 'En progreso', status: 'en_progreso' }),
    makeBug({ id: 'c', title: 'Resuelto', status: 'solucionado' }),
    makeBug({ id: 'd', title: 'No repli', status: 'no_replicado' }),
  ]

  it('por defecto muestra solo los activos (nuevo / en progreso)', () => {
    render(<BugTable results={mixed()} />)
    expect(screen.getByText('Activo nuevo')).toBeInTheDocument()
    expect(screen.getByText('En progreso')).toBeInTheDocument()
    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument()
    expect(screen.queryByText('No repli')).not.toBeInTheDocument()
  })

  it('la pestaña históricos muestra resueltos, cerrados y no replicados', async () => {
    render(<BugTable results={mixed()} />)
    await userEvent.click(screen.getByRole('tab', { name: /históricos/ }))
    expect(screen.queryByText('Activo nuevo')).not.toBeInTheDocument()
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
    expect(screen.getByText('No repli')).toBeInTheDocument()
  })

  it('la pestaña todos muestra activos e históricos juntos', async () => {
    render(<BugTable results={mixed()} />)
    await userEvent.click(screen.getByRole('tab', { name: /todos/ }))
    expect(screen.getByText('Activo nuevo')).toBeInTheDocument()
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
  })

  it('los contadores de cada pestaña reflejan el ciclo de vida', () => {
    render(<BugTable results={mixed()} />)
    expect(screen.getByRole('tab', { name: /activos/ })).toHaveTextContent('2')
    expect(screen.getByRole('tab', { name: /históricos/ })).toHaveTextContent('2')
    expect(screen.getByRole('tab', { name: /todos/ })).toHaveTextContent('4')
  })

  it('si no hay activos, muestra el vacío con opción de ver todos', async () => {
    render(<BugTable results={[makeBug({ id: 'c', title: 'Resuelto', status: 'solucionado' })]} />)
    expect(screen.getByText('no hay bugs activos')).toBeInTheDocument()
    await userEvent.click(screen.getByText('ver todos'))
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
  })

  it('roving tabindex: solo la pestaña activa es tabbable', () => {
    render(<BugTable results={mixed()} />)
    expect(screen.getByRole('tab', { name: /activos/ })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /históricos/ })).toHaveAttribute('tabindex', '-1')
  })

  it('las flechas mueven la selección y el foco entre pestañas', async () => {
    render(<BugTable results={mixed()} />)
    const activos = screen.getByRole('tab', { name: /activos/ })
    activos.focus()
    await userEvent.keyboard('{ArrowRight}')

    const historicos = screen.getByRole('tab', { name: /históricos/ })
    expect(historicos).toHaveAttribute('aria-selected', 'true')
    expect(historicos).toHaveFocus()
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
  })

  it('el nombre accesible de cada pestaña incluye el conteo', () => {
    render(<BugTable results={mixed()} />)
    expect(screen.getByRole('tab', { name: 'activos, 2 bugs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'históricos, 2 bugs' })).toBeInTheDocument()
  })
})

describe('BugTable — paginación', () => {
  const manyBugs = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      makeBug({
        id: `bug-${i + 1}`,
        title: `Bug ${String(i + 1).padStart(2, '0')}`,
      }),
    )

  it('muestra la primera página y permite avanzar', async () => {
    render(<BugTable results={manyBugs(30)} />)

    expect(screen.getByText('Bug 01')).toBeInTheDocument()
    expect(screen.queryByText('Bug 11')).not.toBeInTheDocument()
    expect(screen.getByText('1-10 de 30')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'página siguiente' }))

    expect(screen.queryByText('Bug 01')).not.toBeInTheDocument()
    expect(screen.getByText('Bug 11')).toBeInTheDocument()
    expect(screen.getByText('11-20 de 30')).toBeInTheDocument()
  })

  it('cambia el tamaño de página y vuelve al inicio', async () => {
    render(<BugTable results={manyBugs(30)} />)

    await userEvent.click(screen.getByRole('button', { name: 'página siguiente' }))
    await chooseOption('bugs por página', '50')

    expect(screen.getByText('Bug 01')).toBeInTheDocument()
    expect(screen.getByText('Bug 30')).toBeInTheDocument()
    expect(screen.getByText('1-30 de 30')).toBeInTheDocument()
  })

  it('vuelve a la primera página cuando cambia la búsqueda', async () => {
    render(<BugTable results={manyBugs(30)} />)

    await userEvent.click(screen.getByRole('button', { name: 'página siguiente' }))
    await userEvent.type(screen.getByPlaceholderText(/buscar bugs/), 'Bug 30')

    expect(screen.getByText('Bug 30')).toBeInTheDocument()
    expect(screen.getByText('1-1 de 1')).toBeInTheDocument()
  })
})

describe('BugTable — borrar bug', () => {
  function renderWithDelete(onDelete = vi.fn()) {
    render(
      <BugTable
        results={[makeBug({ id: 'a', title: 'Activo nuevo' })]}
        onSetStatus={vi.fn()}
        onDelete={onDelete}
      />,
    )
    return onDelete
  }

  it('borra el bug solo después de confirmar', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByText('Activo nuevo')) // expandir el detalle
    await userEvent.click(screen.getByRole('button', { name: 'borrar' }))
    expect(onDelete).not.toHaveBeenCalled() // hasta confirmar, no borra
    const dialog = screen.getByRole('dialog', { name: 'borrar bug' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'borrar bug' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete.mock.calls[0][0].enriched.raw.id).toBe('a')
  })

  it('cancelar no borra y cierra el modal', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'borrar' }))
    const dialog = screen.getByRole('dialog', { name: 'borrar bug' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'cancelar' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'borrar bug' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'borrar' })).toBeInTheDocument()
  })

  it('al pedir confirmación, el foco pasa al modal', async () => {
    renderWithDelete()
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'borrar' }))
    expect(screen.getByRole('dialog', { name: 'borrar bug' })).toHaveFocus()
  })

  it('Escape cancela la confirmación y cierra el modal', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'borrar' }))
    await userEvent.keyboard('{Escape}')

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'borrar bug' })).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'borrar' })
    expect(trigger).toBeInTheDocument()
  })
})

describe('BugTable — agente externo', () => {
  it('envía el bug al agente externo y muestra la salida en el detalle', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: true,
      output: 'Revisar src/login.ts',
      command: 'codex exec',
      durationMs: 1200,
    })

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={onAnalyzeExternalAgent} />)
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }))

    expect(
      screen.getByRole('dialog', { name: 'analizar con agente en la nube' }),
    ).toBeInTheDocument()
    expect(screen.getByText('calidad variable')).toBeInTheDocument()
    expect(screen.getByText('acceso al repositorio')).toBeInTheDocument()
    expect(onAnalyzeExternalAgent).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'iniciar análisis' }))

    expect(onAnalyzeExternalAgent).toHaveBeenCalledTimes(1)
    expect(onAnalyzeExternalAgent.mock.calls[0][0].enriched.raw.id).toBe('a')
    expect(await screen.findByText('Revisar src/login.ts')).toBeInTheDocument()
    expect(screen.getByText('completado')).toBeInTheDocument()
    expect(screen.getByText('aporte integrado al reporte')).toBeInTheDocument()
    expect(screen.queryByText('codex exec')).not.toBeInTheDocument()
  })

  it('permite cancelar el aviso antes de ejecutar el agente externo', async () => {
    const onAnalyzeExternalAgent = vi.fn()

    render(
      <BugTable
        results={[makeBug({ id: 'a', title: 'Activo nuevo' })]}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }))
    await userEvent.click(screen.getByRole('button', { name: 'cancelar' }))

    expect(onAnalyzeExternalAgent).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('dialog', { name: 'analizar con agente en la nube' }),
    ).not.toBeInTheDocument()
  })

  it('muestra los TODOS parciales del agente como progreso interno mientras ejecuta', async () => {
    const previousApi = window.electronAPI
    let progressHandler:
      | ((event: {
          bugId: string
          output: string
          chunk: string
          stream: 'stdout' | 'stderr'
          command: string
          elapsedMs: number
          silentMs: number
        }) => void)
      | undefined
    ;(window as unknown as { electronAPI: Partial<typeof window.electronAPI> }).electronAPI = {
      ...previousApi,
      onExternalAgentProgress: (handler) => {
        progressHandler = handler
        return () => {}
      },
    }
    const onAnalyzeExternalAgent = vi.fn(() => new Promise<never>(() => {}))

    try {
      render(
        <BugTable
          results={[makeBug({ id: 'a', title: 'Activo nuevo' })]}
          onAnalyzeExternalAgent={onAnalyzeExternalAgent}
        />,
      )
      await userEvent.click(screen.getByText('Activo nuevo'))
      await userEvent.click(screen.getByRole('button', { name: 'Analizar' }))
      await userEvent.click(screen.getByRole('button', { name: 'iniciar análisis' }))

      act(() => {
        progressHandler?.({
          bugId: 'a',
          output:
            'TODOS\n\n[•] Explorar estructura del frontend [ ] Analizar validaciones del formulario [ ] Sintetizar evidencia',
          chunk: 'TODOS',
          stream: 'stdout',
          command: 'opencode run',
          elapsedMs: 1000,
          silentMs: 100,
        })
      })

      expect(screen.getByText('el agente está revisando el bug')).toBeInTheDocument()
      expect(screen.getByText('Explorar estructura del frontend')).toBeInTheDocument()
      expect(screen.getByText('Analizar validaciones del formulario')).toBeInTheDocument()
      expect(screen.queryByText('TODOS')).not.toBeInTheDocument()
    } finally {
      window.electronAPI = previousApi
    }
  })

  it('muestra el último resultado persistido del agente externo al abrir el detalle', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output: 'Resultado guardado del agente',
      command: 'opencode run',
      workingDirectory: '/repo/app',
      durationMs: 3000,
    }
    const onAnalyzeExternalAgent = vi.fn()

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={onAnalyzeExternalAgent} />)
    await userEvent.click(screen.getByText('Activo nuevo'))

    expect(screen.getByText('Resultado guardado del agente')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Revisión adicional hecha por el agente configurado en la nube sobre este bug.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('opencode run')).not.toBeInTheDocument()
    expect(screen.queryByText(/cwd:/)).not.toBeInTheDocument()
    expect(onAnalyzeExternalAgent).not.toHaveBeenCalled()
  })

  it('muestra un error claro cuando el agente no puede acceder al repositorio', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '$ git branch --show-current merge\n\n! permission requested: external_directory (/repo/back/*); auto-rejecting\nThe user rejected permission to use this specific tool call.',
      command: 'codex exec',
      durationMs: 10000,
    }

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Activo nuevo'))

    expect(screen.getByText('el agente no pudo acceder al repositorio')).toBeInTheDocument()
    expect(screen.getByText(/No llegó a hacer un análisis útil de código/)).toBeInTheDocument()
    expect(screen.queryByText(/git branch/)).not.toBeInTheDocument()
  })

  it('muestra los archivos a revisar como referencias legibles', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Archivos o áreas a revisar\n| Archivo | Línea | Relevancia |\n| --- | --- | --- |\n| src/login.ts | 42 | Manejo del submit |\n| src/session.ts | 18 | Endpoint de sesión |\n\n## Próximos pasos\n- validar el error',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Activo nuevo'))

    expect(screen.getByText('Archivos o áreas a revisar')).toBeInTheDocument()
    expect(screen.getByText('src/login.ts')).toBeInTheDocument()
    expect(screen.getByText('línea 42')).toBeInTheDocument()
    expect(screen.getByText('Manejo del submit')).toBeInTheDocument()
    expect(screen.queryByText('| Archivo | Línea | Relevancia |')).not.toBeInTheDocument()
  })

  it('muestra referencias simples y oculta la traza operativa del agente', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Archivos o áreas a revisar\nsource/src/app/core/utils/form.utils.ts — toDisplayDecimalPayload y normalizeDecimalPayload\nBackend: endpoint postWeapon / patchWeapon — validación server-side\n\n## Próximos pasos\n- validar el endpoint\n> build · big-pickle\n→ Read source/src/app/core/utils/form.utils.ts\n✱ Grep "weapon" in source/src · 22 matches',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Activo nuevo'))

    expect(screen.getByText('source/src/app/core/utils/form.utils.ts')).toBeInTheDocument()
    expect(
      screen.getByText('toDisplayDecimalPayload y normalizeDecimalPayload'),
    ).toBeInTheDocument()
    expect(screen.getByText('Backend: endpoint postWeapon / patchWeapon')).toBeInTheDocument()
    expect(screen.queryByText(/big-pickle/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Grep/)).not.toBeInTheDocument()
  })

  it('estructura evidencia, diagnóstico y próximos pasos del agente', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        'Now let me check the backend for server-side validation.\nAhora tengo suficiente información para hacer un análisis completo.\n\n## Evidencia\n1. HTTP 200 con datos inválidos — El backend acepta datos incorrectos.\n\n## Diagnóstico probable\nValidación frontend correcta pero backend ausente: el servidor no valida el payload.\n\n## Próximos pasos\nReproducir localmente el flujo.\nVerificar DevTools Network.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Activo nuevo'))

    expect(screen.queryByText(/Now let me/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ahora tengo suficiente/)).not.toBeInTheDocument()
    expect(screen.getByText('HTTP 200 con datos inválidos')).toBeInTheDocument()
    expect(screen.getByText('El backend acepta datos incorrectos.')).toBeInTheDocument()
    expect(
      screen.getByText('Validación frontend correcta pero backend ausente'),
    ).toBeInTheDocument()
    expect(screen.getByText('el servidor no valida el payload.')).toBeInTheDocument()
    expect(screen.getByText('Reproducir localmente el flujo.')).toBeInTheDocument()
    expect(screen.getByText('Verificar DevTools Network.')).toBeInTheDocument()
  })

  it('muestra la cobertura de pasos con estado visual por ítem', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Cobertura de los pasos reportados\nNº serie > 20 caracteres → Cubierto. maxInputLength bloquea el input.\nCUIL inválido → Cubierto en frontend, no verificado en backend.\nCampos obligatorios → parcial. Falta required en un campo.\nOrganismo registrante < 5 caracteres → No cubierto. Falta mensaje visible.\nFecha adquisición año 4000 → No verificable. Requiere correr la app.\nBug de persistencia → Hallazgo lateral. No corresponde al paso UI.\n✗ Invalid Tool\nThe arguments provided to the tool are invalid: Model tried to call unavailable tool bash.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Activo nuevo'))

    expect(screen.getByText('Cobertura de los pasos reportados')).toBeInTheDocument()
    expect(screen.getByText('Nº serie > 20 caracteres')).toBeInTheDocument()
    expect(screen.getByText('cubierto')).toBeInTheDocument()
    expect(screen.getByText('CUIL inválido')).toBeInTheDocument()
    expect(screen.getAllByText('parcial')).toHaveLength(2)
    expect(screen.getByText('Campos obligatorios')).toBeInTheDocument()
    expect(screen.getByText('Organismo registrante < 5 caracteres')).toBeInTheDocument()
    expect(screen.getByText('falla')).toBeInTheDocument()
    expect(screen.getByText('Fecha adquisición año 4000')).toBeInTheDocument()
    expect(screen.getByText('no verificable')).toBeInTheDocument()
    expect(screen.getByText('Bug de persistencia')).toBeInTheDocument()
    expect(screen.getByText('lateral')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Tool/)).not.toBeInTheDocument()
    expect(screen.queryByText(/unavailable tool/)).not.toBeInTheDocument()
    expect(screen.queryByText(/→ Cubierto/)).not.toBeInTheDocument()
  })

  it('permite marcar como solucionado cuando el agente indica que parece resuelto', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Estado probable del bug\nEstado probable: resuelto\nCoincide con el bug reportado: sí\nMotivo: el validador ya rechaza el payload inválido en la rama revisada.',
      command: 'opencode run',
      durationMs: 3000,
    }
    const onSetStatus = vi.fn()

    render(<BugTable results={[bug]} onSetStatus={onSetStatus} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Activo nuevo'))

    expect(screen.getByText('parece que está resuelto')).toBeInTheDocument()
    expect(screen.getByText(/Esta inferencia puede ser incorrecta/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'sí' }))

    expect(onSetStatus).toHaveBeenCalledWith(bug, 'solucionado')
  })

  it('no sugiere cerrar cuando el agente indica estado parcial o no resuelto', async () => {
    const partialBug = makeBug({ id: 'a', title: 'Parcial' })
    partialBug.analysis.externalAgent = {
      ok: true,
      output:
        '## Estado probable del bug\nEstado probable: parcialmente_resuelto\nCoincide con el bug reportado: parcial\nMotivo: algunos pasos están cubiertos y otros requieren verificación.',
      command: 'opencode run',
      durationMs: 3000,
    }
    const notResolvedBug = makeBug({ id: 'b', title: 'No resuelto' })
    notResolvedBug.analysis.externalAgent = {
      ok: true,
      output:
        '## Estado probable del bug\nParece resuelto: no\nMotivo: no hay evidencia suficiente.',
      command: 'opencode run',
      durationMs: 3000,
    }

    const { rerender } = render(
      <BugTable results={[partialBug]} onSetStatus={vi.fn()} onAnalyzeExternalAgent={vi.fn()} />,
    )
    await userEvent.click(screen.getByText('Parcial'))

    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()

    rerender(
      <BugTable
        results={[notResolvedBug]}
        onSetStatus={vi.fn()}
        onAnalyzeExternalAgent={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByText('No resuelto'))

    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()
  })

  it('no sugiere cerrar por frases negadas sobre resolución', async () => {
    const bug = makeBug({ id: 'a', title: 'Negado' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Estado probable del bug\nNo parece que esté resuelto: falta validar el pegado de texto.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugTable results={[bug]} onSetStatus={vi.fn()} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Negado'))

    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()
  })

  it('ignora el formato viejo de resolución cuando la respuesta usa el contrato estructurado', async () => {
    const bug = makeBug({ id: 'a', title: 'Contrato nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Hallazgos laterales\nninguno\n\n## Estado probable del bug\nParece resuelto: sí\nMotivo: formato viejo mezclado por el agente.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugTable results={[bug]} onSetStatus={vi.fn()} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Contrato nuevo'))

    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()
  })

  it('limpia trazas del agente y separa el estado compacto del reporte externo', async () => {
    const bug = makeBug({ id: 'a', title: 'Salida compacta' })
    bug.analysis.externalAgent = {
      ok: true,
      output: [
        'Ahora tengo suficiente contexto. Éste es mi análisis:',
        '',
        'RESUMEN',
        'El bug requiere revisar el dropdown.',
        '',
        'ESTADO PROBABLE DEL BUG',
        'Estado probable: parcialmente_resuelto Coincide con el bug reportado: parcial Motivo: el endpoint correcto está en template, pero queda una carga redundante.',
        '',
        'PRÓXIMOS PASOS',
        '- Verificar IDs reales.',
        '- > buglens · big-pickle',
      ].join('\n'),
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugTable results={[bug]} onAnalyzeExternalAgent={vi.fn()} />)
    await userEvent.click(screen.getByText('Salida compacta'))

    expect(screen.queryByText(/Ahora tengo suficiente contexto/)).not.toBeInTheDocument()
    expect(screen.queryByText(/buglens · big-pickle/)).not.toBeInTheDocument()
    expect(screen.getByText('Resumen')).toBeInTheDocument()
    expect(screen.getByText('Estado probable del bug')).toBeInTheDocument()
    expect(screen.getByText(/Estado probable:\s*parcialmente_resuelto/)).toBeInTheDocument()
    expect(screen.getByText(/Coincide con el bug reportado:\s*parcial/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /Motivo:\s*el endpoint correcto está en template, pero queda una carga redundante/,
      ),
    ).toBeInTheDocument()
  })

  it('muestra notas fechadas y permite agregar una nueva sin ocultar historial del agente', async () => {
    const bug = makeBug({ id: 'a', title: 'Seguimiento' })
    bug.comments = [
      {
        id: 'comment-1',
        body: '10 de marzo: se reabre porque QA volvió a reproducirlo.',
        createdAt: '2026-03-10T12:00:00.000Z',
        authorEmail: 'qa@example.com',
      },
      {
        id: 'comment-2',
        body: '09 de marzo: se solicita evidencia adicional.',
        createdAt: '2026-03-09T12:00:00.000Z',
      },
      {
        id: 'comment-3',
        body: '08 de marzo: QA confirma ambiente.',
        createdAt: '2026-03-08T12:00:00.000Z',
      },
      {
        id: 'comment-4',
        body: '07 de marzo: primera revisión del equipo.',
        createdAt: '2026-03-07T12:00:00.000Z',
      },
    ]
    bug.analysis.externalAgent = {
      ok: true,
      output: '## Resumen\nAnálisis actual',
      command: 'opencode run',
      durationMs: 1000,
      createdAt: '2026-03-25T12:00:00.000Z',
    }
    bug.analysis.externalAgentHistory = [
      bug.analysis.externalAgent,
      {
        ok: true,
        output: '## Resumen\nAnálisis anterior 1',
        command: 'opencode run',
        durationMs: 900,
        createdAt: '2026-03-24T12:00:00.000Z',
      },
      {
        ok: true,
        output: '## Resumen\nAnálisis anterior 2',
        command: 'opencode run',
        durationMs: 900,
        createdAt: '2026-03-23T12:00:00.000Z',
      },
      {
        ok: true,
        output: '## Resumen\nAnálisis anterior 3',
        command: 'opencode run',
        durationMs: 900,
        createdAt: '2026-03-22T12:00:00.000Z',
      },
      {
        ok: true,
        output: '## Resumen\nAnálisis anterior 4',
        command: 'opencode run',
        durationMs: 900,
        createdAt: '2026-03-21T12:00:00.000Z',
      },
      {
        ok: true,
        output: '## Resumen\nAnálisis anterior 5',
        command: 'opencode run',
        durationMs: 900,
        createdAt: '2026-03-20T12:00:00.000Z',
      },
    ]
    const onAddComment = vi.fn().mockResolvedValue({
      id: 'comment-2',
      body: '25 de marzo: se vuelve a abrir por regresión.',
      createdAt: '2026-03-25T12:00:00.000Z',
      authorEmail: 'dev@example.com',
    })

    render(
      <BugTable results={[bug]} onAnalyzeExternalAgent={vi.fn()} onAddComment={onAddComment} />,
    )
    await userEvent.click(screen.getByText('Seguimiento'))

    expect(screen.getByText(/10 de marzo: se reabre/)).toBeInTheDocument()
    expect(screen.getByText(/08 de marzo: QA confirma/)).toBeInTheDocument()
    expect(screen.queryByText(/07 de marzo: primera revisión/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'mostrar 1 anteriores' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'mostrar 1 anteriores' }))
    expect(screen.getByText(/07 de marzo: primera revisión/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'mostrar menos' }))
    expect(screen.queryByText(/07 de marzo: primera revisión/)).not.toBeInTheDocument()

    expect(screen.getByText('historial del agente (5)')).toBeInTheDocument()
    expect(document.querySelectorAll('.agent-history-item')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'mostrar 2 anteriores' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'mostrar 2 anteriores' }))
    expect(document.querySelectorAll('.agent-history-item')).toHaveLength(5)
    await userEvent.click(screen.getByRole('button', { name: 'mostrar menos' }))
    expect(document.querySelectorAll('.agent-history-item')).toHaveLength(3)
    await userEvent.click(screen.getByText(/24.*mar.*2026/i))
    expect(screen.getByText('Análisis anterior 1')).toBeInTheDocument()

    await userEvent.type(
      screen.getByPlaceholderText(/10\/03 se reabre/),
      '25 de marzo: se vuelve a abrir por regresión.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'agregar' }))

    expect(onAddComment).toHaveBeenCalledWith(bug, '25 de marzo: se vuelve a abrir por regresión.')
    expect(await screen.findByText(/25 de marzo: se vuelve a abrir/)).toBeInTheDocument()
  })

  it('muestra el error del agente externo dentro del detalle', async () => {
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: false,
      output: '',
      error: 'Configurá un comando de agente externo en Settings.',
      command: '',
      durationMs: 0,
    })

    render(
      <BugTable
        results={[makeBug({ id: 'a', title: 'Activo nuevo' })]}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }))
    await userEvent.click(screen.getByRole('button', { name: 'iniciar análisis' }))

    expect(
      await screen.findByText('Configurá un comando de agente externo en Settings.'),
    ).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('muestra la salida técnica cuando el agente externo falla', async () => {
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: false,
      output: 'stack interno del agente',
      error: 'El agente externo está instalado, pero su provider no está configurado.',
      command: 'opencode run',
      durationMs: 5000,
    })

    render(
      <BugTable
        results={[makeBug({ id: 'a', title: 'Activo nuevo' })]}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByText('Activo nuevo'))
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }))
    await userEvent.click(screen.getByRole('button', { name: 'iniciar análisis' }))

    expect(
      await screen.findByText(
        'El agente externo está instalado, pero su provider no está configurado.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('salida técnica')).toBeInTheDocument()
    expect(screen.getByText('stack interno del agente')).toBeInTheDocument()
    expect(screen.getByText('salida técnica').closest('details')).toBeNull()
  })
})
