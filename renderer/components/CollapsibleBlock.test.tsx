import { describe, expect, it } from 'vitest'
import { shouldOfferCollapse } from './CollapsibleBlock'

describe('shouldOfferCollapse', () => {
  it('ofrece plegar cuando el contenido supera el límite con margen', () => {
    expect(shouldOfferCollapse(600, 340)).toBe(true)
  })

  it('no ofrece plegar cuando el contenido entra', () => {
    expect(shouldOfferCollapse(200, 340)).toBe(false)
    expect(shouldOfferCollapse(340, 340)).toBe(false)
  })

  it('no ofrece plegar si lo que se ahorra no lo justifica', () => {
    // Un botón de "Ver más" que esconde 10px molesta más de lo que ayuda.
    expect(shouldOfferCollapse(350, 340)).toBe(false)
    expect(shouldOfferCollapse(435, 340)).toBe(false)
  })

  it('ofrece plegar justo cuando se alcanza la ganancia mínima', () => {
    expect(shouldOfferCollapse(436, 340)).toBe(true)
  })

  it('respeta una ganancia mínima propia', () => {
    expect(shouldOfferCollapse(360, 340, 10)).toBe(true)
    expect(shouldOfferCollapse(360, 340, 100)).toBe(false)
  })

  it('no ofrece plegar sin medida útil', () => {
    // Antes del primer layout `scrollHeight` es 0: no hay nada que decidir.
    expect(shouldOfferCollapse(0, 340)).toBe(false)
    expect(shouldOfferCollapse(Number.NaN, 340)).toBe(false)
  })
})
