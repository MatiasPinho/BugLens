import { describe, expect, it } from 'vitest'
import { parseAgentAccessIssue, parseAgentReport, parseResolvedSuggestion } from './agentReport'

describe('parseAgentReport — referencias a archivos', () => {
  function referencesOf(output: string) {
    const block = parseAgentReport(output).find((item) => item.type === 'references')
    return block?.type === 'references' ? block.items : []
  }

  it('reconoce el archivo con número de línea pegado con dos puntos', () => {
    expect(
      referencesOf('## Archivos o áreas a revisar\nsrc/auth/session.ts:42 — creación de la cookie'),
    ).toEqual([{ file: 'src/auth/session.ts', line: '42', relevance: 'creación de la cookie' }])
  })

  it('reconoce el rango de líneas y la forma "línea N"', () => {
    expect(referencesOf('src/login.ts:12-30 — validación')[0]).toMatchObject({
      file: 'src/login.ts',
      line: '12-30',
    })
    expect(referencesOf('src/login.ts línea 7 — submit')[0]).toMatchObject({
      file: 'src/login.ts',
      line: '7',
    })
  })

  it('acepta archivos sin línea y áreas con prefijo de capa', () => {
    expect(referencesOf('src/utils/form.ts — helpers')[0]).toMatchObject({
      file: 'src/utils/form.ts',
      line: '',
    })
    expect(referencesOf('Backend: endpoint postWeapon — validación server-side')[0]).toMatchObject({
      file: 'Backend: endpoint postWeapon',
    })
  })

  it('no toma como referencia una oración cualquiera', () => {
    expect(referencesOf('El submit no resuelve — hay que revisarlo')).toEqual([])
  })
})

describe('parseAgentAccessIssue', () => {
  it('detecta el rechazo automático de permisos y extrae la ruta', () => {
    expect(
      parseAgentAccessIssue(
        '! permission requested: external_directory (/repo/back/*); auto-rejecting',
      ),
    ).toEqual({ path: '/repo/back/*' })
  })

  it('ignora salidas que solo mencionan permisos', () => {
    expect(parseAgentAccessIssue('permission requested: read file')).toBeNull()
    expect(parseAgentAccessIssue('todo ok')).toBeNull()
  })
})

describe('parseResolvedSuggestion', () => {
  it('sugiere cerrar solo con un estado explícito de resuelto', () => {
    expect(
      parseResolvedSuggestion('Estado probable: resuelto\nMotivo: el validador ya rechaza'),
    ).toEqual({ reason: 'el validador ya rechaza' })
    expect(parseResolvedSuggestion('Estado probable: parcialmente_resuelto')).toBeNull()
    expect(parseResolvedSuggestion('No parece que esté resuelto: falta validar')).toBeNull()
  })
})
