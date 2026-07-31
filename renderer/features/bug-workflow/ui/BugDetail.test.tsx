import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyzedBug, BugStatus } from '../../../../src/shared/contracts'
import BugDetail from './BugDetail'

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

describe('BugDetail — cabecera', () => {
  it('muestra el reporte reescrito, el estado y la fila de origen', () => {
    const bug = makeBug({ id: 'a', title: 'Login roto' })
    bug.analysis.rewritten.observed = 'el spinner queda infinito'
    bug.analysis.rewritten.expected = 'debería navegar al dashboard'
    bug.analysis.rewritten.steps = ['abrir /auth/login', 'enviar credenciales válidas']

    render(<BugDetail bug={bug} onSetStatus={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Login roto' })).toBeInTheDocument()
    expect(screen.getByText('el spinner queda infinito')).toBeInTheDocument()
    expect(screen.getByText('debería navegar al dashboard')).toBeInTheDocument()
    expect(screen.getByText('abrir /auth/login')).toBeInTheDocument()
    expect(screen.getByText(/Fila 1/)).toBeInTheDocument()
    // El estado se muestra pero no se edita acá: cambiarlo es del rail de
    // propiedades.
    expect(screen.getByText('nuevo')).toBeInTheDocument()
  })

  it('volver a la lista avisa al padre', async () => {
    const onBack = vi.fn()
    render(<BugDetail bug={makeBug({ id: 'a', title: 'X' })} onBack={onBack} />)

    await userEvent.click(screen.getByRole('button', { name: 'volver a la lista' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

})

describe('BugDetail — borrar bug', () => {
  function renderWithDelete(onDelete = vi.fn()) {
    render(<BugDetail bug={makeBug({ id: 'a', title: 'Activo nuevo' })} onDelete={onDelete} />)
    return onDelete
  }

  it('borra el bug solo después de confirmar', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByRole('button', { name: 'más acciones del bug' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Borrar bug/ }))
    expect(onDelete).not.toHaveBeenCalled() // hasta confirmar, no borra
    const dialog = screen.getByRole('dialog', { name: 'Borrar bug' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar bug' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('cancelar no borra y cierra el modal', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByRole('button', { name: 'más acciones del bug' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Borrar bug/ }))
    const dialog = screen.getByRole('dialog', { name: 'Borrar bug' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Borrar bug' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'más acciones del bug' })).toBeInTheDocument()
  })

  it('al pedir confirmación, el foco pasa al modal', async () => {
    renderWithDelete()
    await userEvent.click(screen.getByRole('button', { name: 'más acciones del bug' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Borrar bug/ }))
    expect(screen.getByRole('dialog', { name: 'Borrar bug' })).toHaveFocus()
  })

  it('Escape cancela la confirmación y cierra el modal', async () => {
    const onDelete = renderWithDelete()
    await userEvent.click(screen.getByRole('button', { name: 'más acciones del bug' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Borrar bug/ }))
    await userEvent.keyboard('{Escape}')

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Borrar bug' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'más acciones del bug' })).toBeInTheDocument()
  })
})

describe('BugDetail — agente externo', () => {
  const AGENT_DIALOG = 'Analizar con el agente externo'

  it('envía el bug al agente externo y muestra la salida', async () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: true,
      output: 'Revisar src/login.ts',
      command: 'codex exec',
      durationMs: 1200,
    })

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={onAnalyzeExternalAgent} />)
    await userEvent.click(screen.getByRole('button', { name: 'Analizar con agente' }))

    expect(screen.getByRole('dialog', { name: AGENT_DIALOG })).toBeInTheDocument()
    expect(screen.getByText('calidad variable')).toBeInTheDocument()
    expect(screen.getByText('acceso al repositorio')).toBeInTheDocument()
    expect(onAnalyzeExternalAgent).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar análisis' }))

    expect(onAnalyzeExternalAgent).toHaveBeenCalledTimes(1)
    expect(onAnalyzeExternalAgent.mock.calls[0][0].enriched.raw.id).toBe('a')
    expect(await screen.findByText('Revisar src/login.ts')).toBeInTheDocument()
    expect(screen.getByText('completado')).toBeInTheDocument()
    expect(screen.getByText('Aporte del agente externo')).toBeInTheDocument()
    expect(screen.queryByText('codex exec')).not.toBeInTheDocument()
  })

  it('permite cancelar el aviso antes de ejecutar el agente externo', async () => {
    const onAnalyzeExternalAgent = vi.fn()

    render(
      <BugDetail
        bug={makeBug({ id: 'a', title: 'Activo nuevo' })}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Analizar con agente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onAnalyzeExternalAgent).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: AGENT_DIALOG })).not.toBeInTheDocument()
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
        <BugDetail
          bug={makeBug({ id: 'a', title: 'Activo nuevo' })}
          onAnalyzeExternalAgent={onAnalyzeExternalAgent}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Analizar con agente' }))
      await userEvent.click(screen.getByRole('button', { name: 'Iniciar análisis' }))

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

  it('muestra el último resultado persistido del agente externo al abrir el detalle', () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output: 'Resultado guardado del agente',
      command: 'opencode run',
      workingDirectory: '/repo/app',
      durationMs: 3000,
    }
    const onAnalyzeExternalAgent = vi.fn()

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={onAnalyzeExternalAgent} />)

    expect(screen.getByText('Resultado guardado del agente')).toBeInTheDocument()
    expect(
      screen.getByText('Revisión adicional hecha por el agente configurado sobre este bug.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('opencode run')).not.toBeInTheDocument()
    expect(onAnalyzeExternalAgent).not.toHaveBeenCalled()
  })

  it('muestra un error claro cuando el agente no puede acceder al repositorio', () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '$ git branch --show-current merge\n\n! permission requested: external_directory (/repo/back/*); auto-rejecting\nThe user rejected permission to use this specific tool call.',
      command: 'codex exec',
      durationMs: 10000,
    }

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={vi.fn()} />)

    expect(screen.getByText('el agente no pudo acceder al repositorio')).toBeInTheDocument()
    expect(screen.getByText(/No llegó a hacer un análisis útil de código/)).toBeInTheDocument()
    expect(screen.queryByText(/git branch/)).not.toBeInTheDocument()
  })

  it('muestra los archivos a revisar como referencias legibles', () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Archivos o áreas a revisar\n| Archivo | Línea | Relevancia |\n| --- | --- | --- |\n| src/login.ts | 42 | Manejo del submit |\n| src/session.ts | 18 | Endpoint de sesión |\n\n## Próximos pasos\n- validar el error',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={vi.fn()} />)

    expect(screen.getByText('Archivos o áreas a revisar')).toBeInTheDocument()
    expect(screen.getByText('src/login.ts')).toBeInTheDocument()
    expect(screen.getByText('línea 42')).toBeInTheDocument()
    expect(screen.getByText('Manejo del submit')).toBeInTheDocument()
    expect(screen.queryByText('| Archivo | Línea | Relevancia |')).not.toBeInTheDocument()
  })

  it('muestra referencias simples y oculta la traza operativa del agente', () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Archivos o áreas a revisar\nsource/src/app/core/utils/form.utils.ts — toDisplayDecimalPayload y normalizeDecimalPayload\nBackend: endpoint postWeapon / patchWeapon — validación server-side\n\n## Próximos pasos\n- validar el endpoint\n> build · big-pickle\n→ Read source/src/app/core/utils/form.utils.ts\n✱ Grep "weapon" in source/src · 22 matches',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={vi.fn()} />)

    expect(screen.getByText('source/src/app/core/utils/form.utils.ts')).toBeInTheDocument()
    expect(
      screen.getByText('toDisplayDecimalPayload y normalizeDecimalPayload'),
    ).toBeInTheDocument()
    expect(screen.getByText('Backend: endpoint postWeapon / patchWeapon')).toBeInTheDocument()
    expect(screen.queryByText(/big-pickle/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Grep/)).not.toBeInTheDocument()
  })

  it('estructura evidencia, diagnóstico y próximos pasos del agente', () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        'Now let me check the backend for server-side validation.\nAhora tengo suficiente información para hacer un análisis completo.\n\n## Evidencia\n1. HTTP 200 con datos inválidos — El backend acepta datos incorrectos.\n\n## Diagnóstico probable\nValidación frontend correcta pero backend ausente: el servidor no valida el payload.\n\n## Próximos pasos\nReproducir localmente el flujo.\nVerificar DevTools Network.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={vi.fn()} />)

    expect(screen.queryByText(/Now let me/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ahora tengo suficiente/)).not.toBeInTheDocument()
    expect(screen.getByText('HTTP 200 con datos inválidos')).toBeInTheDocument()
    expect(screen.getByText('El backend acepta datos incorrectos.')).toBeInTheDocument()
    expect(screen.getByText('Validación frontend correcta pero backend ausente')).toBeInTheDocument()
    expect(screen.getByText('el servidor no valida el payload.')).toBeInTheDocument()
    expect(screen.getByText('Reproducir localmente el flujo.')).toBeInTheDocument()
    expect(screen.getByText('Verificar DevTools Network.')).toBeInTheDocument()
  })

  it('muestra la cobertura de pasos con estado visual por ítem', () => {
    const bug = makeBug({ id: 'a', title: 'Activo nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Cobertura de los pasos reportados\nNº serie > 20 caracteres → Cubierto. maxInputLength bloquea el input.\nCUIL inválido → Cubierto en frontend, no verificado en backend.\nCampos obligatorios → parcial. Falta required en un campo.\nOrganismo registrante < 5 caracteres → No cubierto. Falta mensaje visible.\nFecha adquisición año 4000 → No verificable. Requiere correr la app.\nBug de persistencia → Hallazgo lateral. No corresponde al paso UI.\n✗ Invalid Tool\nThe arguments provided to the tool are invalid: Model tried to call unavailable tool bash.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={vi.fn()} />)

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

    render(<BugDetail bug={bug} onSetStatus={onSetStatus} onAnalyzeExternalAgent={vi.fn()} />)

    expect(screen.getByText('parece que está resuelto')).toBeInTheDocument()
    expect(screen.getByText(/Esta inferencia puede ser incorrecta/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, está resuelto' }))

    expect(onSetStatus).toHaveBeenCalledWith('solucionado')
  })

  it('no sugiere cerrar cuando el agente indica estado parcial o no resuelto', () => {
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
      <BugDetail bug={partialBug} onSetStatus={vi.fn()} onAnalyzeExternalAgent={vi.fn()} />,
    )
    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()

    rerender(
      <BugDetail bug={notResolvedBug} onSetStatus={vi.fn()} onAnalyzeExternalAgent={vi.fn()} />,
    )
    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()
  })

  it('no sugiere cerrar por frases negadas sobre resolución', () => {
    const bug = makeBug({ id: 'a', title: 'Negado' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Estado probable del bug\nNo parece que esté resuelto: falta validar el pegado de texto.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugDetail bug={bug} onSetStatus={vi.fn()} onAnalyzeExternalAgent={vi.fn()} />)

    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()
  })

  it('ignora el formato viejo de resolución cuando la respuesta usa el contrato estructurado', () => {
    const bug = makeBug({ id: 'a', title: 'Contrato nuevo' })
    bug.analysis.externalAgent = {
      ok: true,
      output:
        '## Hallazgos laterales\nninguno\n\n## Estado probable del bug\nParece resuelto: sí\nMotivo: formato viejo mezclado por el agente.',
      command: 'opencode run',
      durationMs: 3000,
    }

    render(<BugDetail bug={bug} onSetStatus={vi.fn()} onAnalyzeExternalAgent={vi.fn()} />)

    expect(screen.queryByText('parece que está resuelto')).not.toBeInTheDocument()
  })

  it('limpia trazas del agente y separa el estado compacto del reporte externo', () => {
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

    render(<BugDetail bug={bug} onAnalyzeExternalAgent={vi.fn()} />)

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

  it('muestra el error del agente externo dentro del detalle', async () => {
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: false,
      output: '',
      error: 'Configurá un comando de agente externo en Settings.',
      command: '',
      durationMs: 0,
    })

    render(
      <BugDetail
        bug={makeBug({ id: 'a', title: 'Activo nuevo' })}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Analizar con agente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar análisis' }))

    expect(
      await screen.findByText('Configurá un comando de agente externo en Settings.'),
    ).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('muestra la salida del agente cuando falla', async () => {
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: false,
      output: 'stack interno del agente',
      error: 'El agente externo está instalado, pero su provider no está configurado.',
      command: 'opencode run',
      durationMs: 5000,
    })

    render(
      <BugDetail
        bug={makeBug({ id: 'a', title: 'Activo nuevo' })}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Analizar con agente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar análisis' }))

    expect(
      await screen.findByText(
        'El agente externo está instalado, pero su provider no está configurado.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Salida del agente')).toBeInTheDocument()
    expect(screen.getByText('stack interno del agente')).toBeInTheDocument()
    expect(screen.getByText('Salida del agente').closest('details')).toBeNull()
  })
})

describe('BugDetail — el agente falla', () => {
  async function correr(result: Partial<import('../../../../src/shared/contracts').ExternalAgentResult>) {
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: false,
      output: '',
      command: 'opencode run --model opencode/big-pickle',
      durationMs: 4000,
      ...result,
    })
    render(
      <BugDetail
        bug={makeBug({ id: 'a', title: 'X' })}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Analizar con agente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar análisis' }))
  }

  it('muestra el motivo que reporta BugLens', async () => {
    await correr({ error: 'El agente externo no emitió ninguna salida durante 240s.' })

    expect(await screen.findByText(/no emitió ninguna salida durante 240s/)).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('muestra la salida cruda del agente, que es lo que explica el porqué', async () => {
    await correr({
      error: 'Command failed: exited with code 1',
      output: 'ECONNREFUSED 127.9.9.9:443',
    })

    // Antes esto se escondía si faltaba alguno de los dos campos.
    expect(await screen.findByText(/ECONNREFUSED 127\.9\.9\.9:443/)).toBeInTheDocument()
  })

  it('sin salida, explica dónde está la causa en vez de dejar el hueco', async () => {
    await correr({ error: 'Command failed', output: '' })

    expect(
      await screen.findByText(/solo puede mostrar lo que el comando escribe en stdout o stderr/),
    ).toBeInTheDocument()
  })

  it('muestra el comando ejecutado para poder reproducirlo a mano', async () => {
    await correr({ error: 'Command failed', output: 'algo' })

    expect(
      await screen.findByText('opencode run --model opencode/big-pickle'),
    ).toBeInTheDocument()
  })

  it('no muestra el bloque de error cuando el agente terminó bien', async () => {
    const onAnalyzeExternalAgent = vi.fn().mockResolvedValue({
      ok: true,
      output: '## Resumen\nTodo bien',
      command: 'codex exec',
      durationMs: 1000,
    })
    render(
      <BugDetail
        bug={makeBug({ id: 'a', title: 'X' })}
        onAnalyzeExternalAgent={onAnalyzeExternalAgent}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Analizar con agente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar análisis' }))

    expect(await screen.findByText('completado')).toBeInTheDocument()
    expect(screen.queryByText('Salida del agente')).not.toBeInTheDocument()
  })
})
