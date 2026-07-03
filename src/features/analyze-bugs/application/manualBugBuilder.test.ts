import { describe, expect, it } from 'vitest'
import { buildManualBug } from './manualBugBuilder'

describe('buildManualBug', () => {
  it('arma un RawBug con id estable según la secuencia', () => {
    const bug = buildManualBug({ title: 'Login roto' }, 1)
    expect(bug.id).toBe('manual-0001')
    expect(bug.rowIndex).toBe(0)
    expect(bug.title).toBe('Login roto')
  })

  it('sintetiza rawRow solo con los campos cargados', () => {
    const bug = buildManualBug({ title: 'X', description: 'no anda', environment: 'prod' }, 2)
    expect(bug.rawRow).toEqual({
      Título: 'X',
      Descripción: 'no anda',
      Entorno: 'prod',
    })
  })

  it('extrae los Google Docs links pegados en cualquier campo', () => {
    const bug = buildManualBug(
      {
        title: 'Bug con evidencia',
        description: 'ver doc https://docs.google.com/document/d/abc123/edit',
      },
      3,
    )
    expect(bug.googleDocLinks).toContain('https://docs.google.com/document/d/abc123/edit')
  })

  it('campos vacíos quedan undefined (no string vacío)', () => {
    const bug = buildManualBug({ title: 'Solo título' }, 4)
    expect(bug.description).toBe('')
    expect(bug.stepsToReproduce).toBeUndefined()
    expect(bug.environment).toBeUndefined()
  })

  it('si falta el título usa un fallback con la secuencia', () => {
    const bug = buildManualBug({ description: 'algo falla' }, 5)
    expect(bug.title).toBe('Bug manual #5')
  })

  it('lanza error si no hay ni título ni descripción', () => {
    expect(() => buildManualBug({ environment: 'prod' }, 6)).toThrow()
    expect(() => buildManualBug({ title: '   ', description: '  ' }, 7)).toThrow()
  })
})
