import { describe, expect, it } from 'vitest'
import { bugRecordKey } from './bugStatusKey'

describe('bugRecordKey', () => {
  it('es determinista: mismo contenido → misma clave', () => {
    const bug = { title: 'Login roto', description: 'el botón no responde' }
    expect(bugRecordKey(bug)).toBe(bugRecordKey({ ...bug }))
  })

  it('normaliza mayúsculas y espacios (no debería cambiar la identidad)', () => {
    const a = bugRecordKey({ title: 'Login Roto', description: 'el  botón   no  responde' })
    const b = bugRecordKey({ title: '  login roto ', description: 'el botón no responde' })
    expect(a).toBe(b)
  })

  it('contenido distinto → clave distinta', () => {
    const a = bugRecordKey({ title: 'Login roto', description: 'x' })
    const b = bugRecordKey({ title: 'Logout roto', description: 'x' })
    const c = bugRecordKey({ title: 'Login roto', description: 'y' })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('no se rompe con strings vacíos', () => {
    expect(() => bugRecordKey({ title: '', description: '' })).not.toThrow()
    expect(typeof bugRecordKey({ title: '', description: '' })).toBe('string')
  })

  it('reordenar el Excel no afecta la clave (depende del contenido, no de la posición)', () => {
    // El mismo bug, "movido" en el Excel, conserva título+descripción → misma clave.
    const bug = { title: 'Form de armas', description: 'no valida número de registro' }
    expect(bugRecordKey(bug)).toBe(bugRecordKey({ ...bug }))
  })
})
