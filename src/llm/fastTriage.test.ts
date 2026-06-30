import { describe, expect, it } from 'vitest'
import type { EnrichedBug, LLMConfig } from '../types/index'
import { parseAnalysis, selectLLMConfigForBug } from './fastTriage'

const FULL = JSON.stringify({
  category: 'frontend',
  bugType: 'validation',
  severity: 'high',
  confidence: 0.9,
  affectedArea: 'formularios',
  summary: 'el formulario no valida',
  rewritten: {
    observed: '1. el campo X no valida\n2. el campo Y no valida',
    expected: '1. X debería validar\n2. Y debería validar',
    steps: ['paso 1', 'paso 2'],
    environment: 'dev',
  },
  missingInformation: ['falta el mensaje de error'],
})

describe('parseAnalysis', () => {
  it('parsea una respuesta completa y bien formada', () => {
    const a = parseAnalysis(FULL)
    expect(a.category).toBe('frontend')
    expect(a.severity).toBe('high')
    expect(a.confidence).toBe(0.9)
    expect(a.rewritten.steps).toEqual(['paso 1', 'paso 2'])
    expect(a.rewritten.problemCount).toBe(2)
    expect(a.missingInformation).toEqual(['falta el mensaje de error'])
  })

  it('tolera ```json fences``` y texto antes/después', () => {
    const raw = `Acá va el análisis:\n\`\`\`json\n${FULL}\n\`\`\`\nGracias.`
    expect(parseAnalysis(raw).category).toBe('frontend')
  })

  it('categoría/severidad inválidas caen a defaults (otro / medium)', () => {
    const a = parseAnalysis(
      JSON.stringify({ category: 'banana', severity: 'apocalíptica', summary: 'x' }),
    )
    expect(a.category).toBe('otro')
    expect(a.severity).toBe('medium')
  })

  it('clampa la confianza al rango 0..1, default 0.5 si no es número', () => {
    expect(parseAnalysis(JSON.stringify({ confidence: 5 })).confidence).toBe(1)
    expect(parseAnalysis(JSON.stringify({ confidence: -3 })).confidence).toBe(0)
    expect(parseAnalysis(JSON.stringify({ confidence: 'alta' })).confidence).toBe(0.5)
  })

  it('campos faltantes → defaults seguros (nunca "insufficient info")', () => {
    const a = parseAnalysis(JSON.stringify({ summary: 'algo roto' }))
    expect(a.rewritten.observed).toBe('No informado')
    expect(a.rewritten.expected).toBe('No informado')
    expect(a.rewritten.steps).toEqual([])
    expect(a.rewritten.problemCount).toBe(1)
    expect(a.affectedArea).toBe('No informado')
    expect(a.missingInformation).toEqual([])
  })

  it('rewritten ausente no rompe (cae a objeto vacío)', () => {
    const a = parseAnalysis(JSON.stringify({ category: 'backend', severity: 'low', summary: 's' }))
    expect(a.rewritten.observed).toBe('No informado')
  })

  it('steps con valores no-string y vacíos se limpian', () => {
    const a = parseAnalysis(JSON.stringify({ rewritten: { steps: ['ok', '', '  ', 3] } }))
    expect(a.rewritten.steps).toEqual(['ok', '3'])
  })

  it('problemCount se DERIVA del texto numerado, no del campo del modelo', () => {
    // El modelo dice 1 pero el texto lista 3 → vale el texto (3).
    const a = parseAnalysis(
      JSON.stringify({
        problemCount: 1,
        rewritten: { observed: '1. uno\n2. dos\n3. tres' },
      }),
    )
    expect(a.rewritten.problemCount).toBe(3)

    // Texto sin numerar → 1 problema (aunque el modelo invente un número alto).
    const b = parseAnalysis(
      JSON.stringify({
        problemCount: 9,
        rewritten: { observed: 'un solo problema descrito en prosa' },
      }),
    )
    expect(b.rewritten.problemCount).toBe(1)

    // Acepta "1)" además de "1." y toma el máximo entre observed y expected.
    const c = parseAnalysis(
      JSON.stringify({
        rewritten: { observed: '1) a', expected: '1) a\n2) b' },
      }),
    )
    expect(c.rewritten.problemCount).toBe(2)
  })

  it('JSON inválido lanza (lo cual dispara el reintento en analyzeBug)', () => {
    expect(() => parseAnalysis('esto no es json')).toThrow()
  })
})

function enrichedBug(imageData?: string): EnrichedBug {
  return {
    raw: {
      id: 'b1',
      rowIndex: 1,
      title: 'Login roto',
      description: 'no anda',
      rawRow: {},
      googleDocLinks: [],
    },
    googleDocs: [
      {
        url: 'u',
        title: 'doc',
        text: 'detalle',
        accessible: true,
        images: imageData ? [{ data: imageData, mimeType: 'image/png' }] : [],
      },
    ],
  }
}

describe('selectLLMConfigForBug', () => {
  const cfg: LLMConfig = {
    provider: 'ollama',
    model: 'qwen2.5:7b',
    visionModel: 'qwen2.5vl:7b',
  }

  it('mantiene el modelo de texto cuando no hay imágenes', () => {
    expect(selectLLMConfigForBug(enrichedBug(), cfg).model).toBe('qwen2.5:7b')
  })

  it('usa el modelo vision cuando el bug trae imágenes', () => {
    expect(selectLLMConfigForBug(enrichedBug('base64'), cfg).model).toBe('qwen2.5vl:7b')
  })

  it('no cambia providers cloud en esta integración local', () => {
    const cloud: LLMConfig = { provider: 'openai', model: 'gpt-4o-mini', visionModel: 'x' }
    expect(selectLLMConfigForBug(enrichedBug('base64'), cloud)).toBe(cloud)
  })
})
