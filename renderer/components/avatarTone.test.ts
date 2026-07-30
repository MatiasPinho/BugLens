import { describe, expect, it } from 'vitest'
import { AVATAR_TONE_COUNT } from '../theme'
import { avatarToneClass, avatarToneOf, initialsOf } from './avatarTone'

describe('avatarToneOf', () => {
  it('devuelve siempre un tono dentro de la escala disponible', () => {
    const ids = ['a', 'b', 'usuario-1', '9f2c1e44-0000-4000-8000-000000000000', 'ÁÉÍ']
    for (const id of ids) {
      const tone = avatarToneOf(id)
      expect(tone).toBeGreaterThanOrEqual(1)
      expect(tone).toBeLessThanOrEqual(AVATAR_TONE_COUNT)
    }
  })

  it('es estable: el mismo id siempre da el mismo tono', () => {
    expect(avatarToneOf('perfil-42')).toBe(avatarToneOf('perfil-42'))
  })

  it('cae al primer tono cuando no hay id', () => {
    expect(avatarToneOf(null)).toBe(1)
    expect(avatarToneOf(undefined)).toBe(1)
    expect(avatarToneOf('')).toBe(1)
  })

  it('reparte los ids entre varios tonos', () => {
    const ids = Array.from({ length: 60 }, (_, index) => `perfil-${index}`)
    const tones = new Set(ids.map(avatarToneOf))
    expect(tones.size).toBeGreaterThan(1)
  })

  it('expone el tono como clase', () => {
    expect(avatarToneClass('perfil-42')).toBe(`avatar-tone-${avatarToneOf('perfil-42')}`)
  })
})

describe('initialsOf', () => {
  it('arma iniciales legibles de nombres y mails', () => {
    expect(initialsOf('Lucía Gómez')).toBe('LG')
    expect(initialsOf('matias@estudio.com')).toBe('MA')
    expect(initialsOf('juan.perez@estudio.com')).toBe('JP')
    expect(initialsOf('')).toBe('?')
  })

  it('trata . _ - como separadores', () => {
    expect(initialsOf('krystina_schmeler@empresa.com')).toBe('KS')
    expect(initialsOf('ana-lucia')).toBe('AL')
  })

  it('sirve también para nombres de proyecto', () => {
    expect(initialsOf('Pin Administracion')).toBe('PA')
    expect(initialsOf('buglens')).toBe('BU')
  })

  it('devuelve un placeholder cuando no queda nada legible', () => {
    expect(initialsOf('   ')).toBe('?')
    expect(initialsOf('@empresa.com')).toBe('?')
  })
})
