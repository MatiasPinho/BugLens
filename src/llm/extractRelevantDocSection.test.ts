import { describe, expect, it } from 'vitest'
import type { RawBug } from '../types/index'
import { extractRelevantDocSection } from './fastTriage'

function bug(title: string, description = ''): RawBug {
  return { id: 'b', rowIndex: 1, title, description, rawRow: {}, googleDocLinks: [] }
}

const para = (n: number, extra = '') =>
  `Párrafo número ${n} con texto de relleno suficiente. ${extra}`.trim()

describe('extractRelevantDocSection', () => {
  it('doc corto (≤5 párrafos) → devuelve desde el inicio', () => {
    const doc = [para(1, 'INICIO_MARK'), para(2), para(3)].join('\n\n')
    const out = extractRelevantDocSection(bug('cualquier cosa'), doc)
    expect(out).toContain('INICIO_MARK')
    expect(out).toContain('Párrafo número 3')
  })

  it('doc largo: devuelve la sección que matchea las palabras del bug, no el inicio', () => {
    const paras = [
      para(1, 'INICIO_UNICO'),
      para(2),
      para(3),
      para(4),
      para(5),
      'El boton guardar no aparece SECCION_OBJETIVO', // matchea el título
      para(7),
      para(8),
    ]
    const out = extractRelevantDocSection(bug('boton guardar'), paras.join('\n\n'))
    expect(out).toContain('SECCION_OBJETIVO')
    expect(out).not.toContain('INICIO_UNICO') // arrancó en la sección relevante, no en el inicio
  })

  it('doc largo sin match → cae al inicio del documento', () => {
    const paras = Array.from({ length: 8 }, (_, i) => para(i + 1, i === 0 ? 'INICIO_FALLBACK' : ''))
    const out = extractRelevantDocSection(bug('xyzzy nada que ver'), paras.join('\n\n'))
    expect(out).toContain('INICIO_FALLBACK')
  })

  it('respeta maxChars', () => {
    const doc = Array.from({ length: 20 }, (_, i) => para(i + 1)).join('\n\n')
    expect(extractRelevantDocSection(bug('x'), doc, 100).length).toBeLessThanOrEqual(100)
  })
})
