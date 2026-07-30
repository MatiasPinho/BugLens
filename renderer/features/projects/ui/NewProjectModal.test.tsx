import { describe, expect, it } from 'vitest'
import { slugifyProjectName } from './NewProjectModal'

describe('slugifyProjectName', () => {
  it('normaliza acentos, espacios y símbolos a un slug único', () => {
    expect(slugifyProjectName('Área QA')).toBe('area-qa')
    expect(slugifyProjectName('  Cliente / Producto  ')).toBe('cliente-producto')
    expect(slugifyProjectName('Ñandú 2026')).toBe('nandu-2026')
  })

  it('no deja guiones sueltos en los extremos', () => {
    expect(slugifyProjectName('--hola--')).toBe('hola')
    expect(slugifyProjectName('!!!')).toBe('')
  })
})
