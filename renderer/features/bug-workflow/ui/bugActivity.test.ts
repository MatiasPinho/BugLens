import { describe, expect, it } from 'vitest'
import type { BugActivityEntry, BugComment } from '../../../../src/shared/contracts'
import {
  actorNameOf,
  buildCommentThread,
  countThread,
  describeActivity,
  formatDueDate,
  isOverdue,
  showsOverdueWarning,
} from './bugActivity'

function comment(over: Partial<BugComment> & { id: string }): BugComment {
  return {
    body: `cuerpo de ${over.id}`,
    createdAt: '2026-03-10T12:00:00.000Z',
    parentId: null,
    upvotes: 0,
    downvotes: 0,
    myVote: 0,
    ...over,
  }
}

function event(over: Partial<BugActivityEntry> & { type: BugActivityEntry['type'] }) {
  return {
    id: 'evento-1',
    createdAt: '2026-03-10T12:00:00.000Z',
    ...over,
  } as BugActivityEntry
}

describe('buildCommentThread', () => {
  it('anida las respuestas bajo su comentario padre', () => {
    const tree = buildCommentThread([
      comment({ id: 'a' }),
      comment({ id: 'b', parentId: 'a' }),
      comment({ id: 'c', parentId: 'b' }),
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('a')
    expect(tree[0].replies[0].id).toBe('b')
    expect(tree[0].replies[0].replies[0].id).toBe('c')
  })

  it('asigna la profundidad de cada nivel', () => {
    const tree = buildCommentThread([
      comment({ id: 'a' }),
      comment({ id: 'b', parentId: 'a' }),
      comment({ id: 'c', parentId: 'b' }),
    ])

    expect(tree[0].depth).toBe(0)
    expect(tree[0].replies[0].depth).toBe(1)
    expect(tree[0].replies[0].replies[0].depth).toBe(2)
  })

  it('ordena por fecha dentro de cada nivel', () => {
    const tree = buildCommentThread([
      comment({ id: 'nuevo', createdAt: '2026-03-11T12:00:00.000Z' }),
      comment({ id: 'viejo', createdAt: '2026-03-09T12:00:00.000Z' }),
      comment({ id: 'r2', parentId: 'viejo', createdAt: '2026-03-10T15:00:00.000Z' }),
      comment({ id: 'r1', parentId: 'viejo', createdAt: '2026-03-10T09:00:00.000Z' }),
    ])

    expect(tree.map((node) => node.id)).toEqual(['viejo', 'nuevo'])
    expect(tree[0].replies.map((node) => node.id)).toEqual(['r1', 'r2'])
  })

  it('trata como raíz al comentario cuyo padre no está en la lista', () => {
    // Preferible perder el sangrado a perder el comentario.
    const tree = buildCommentThread([comment({ id: 'huerfano', parentId: 'borrado' })])

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('huerfano')
    expect(tree[0].depth).toBe(0)
  })

  it('no se cuelga si un comentario se declara hijo de sí mismo', () => {
    const tree = buildCommentThread([comment({ id: 'a', parentId: 'a' })])

    expect(tree).toHaveLength(1)
    expect(tree[0].replies).toHaveLength(0)
  })

  it('no se cuelga ante un ciclo entre comentarios', () => {
    const tree = buildCommentThread([
      comment({ id: 'a', parentId: 'b' }),
      comment({ id: 'b', parentId: 'a' }),
    ])

    expect(countThread(tree)).toBeLessThanOrEqual(2)
  })

  it('devuelve lista vacía sin comentarios', () => {
    expect(buildCommentThread([])).toEqual([])
  })
})

describe('countThread', () => {
  it('cuenta raíces y respuestas', () => {
    const tree = buildCommentThread([
      comment({ id: 'a' }),
      comment({ id: 'b', parentId: 'a' }),
      comment({ id: 'c', parentId: 'a' }),
      comment({ id: 'd' }),
    ])

    expect(countThread(tree)).toBe(4)
  })
})

describe('actorNameOf', () => {
  it('prefiere el nombre visible', () => {
    expect(actorNameOf({ actorName: 'Ana Lopez', actorEmail: 'ana@empresa.com' })).toBe('Ana Lopez')
  })

  it('cae a la parte local del email', () => {
    expect(actorNameOf({ actorEmail: 'jamison.reichert@empresa.com' })).toBe('jamison.reichert')
  })

  it('cae a un genérico cuando no hay identidad', () => {
    expect(actorNameOf({})).toBe('alguien')
  })
})

describe('describeActivity', () => {
  it('dice entre qué estados se movió el bug', () => {
    expect(
      describeActivity(
        event({ type: 'status_changed', fromStatus: 'nuevo', toStatus: 'en_progreso' }),
      ),
    ).toBe('pasó el bug de nuevo a en progreso')
  })

  it('omite el estado anterior cuando no se conoce', () => {
    expect(describeActivity(event({ type: 'status_changed', toStatus: 'solucionado' }))).toBe(
      'marcó el bug como solucionado',
    )
  })

  it('incluye la fecha límite cuando se puso una', () => {
    expect(
      describeActivity(event({ type: 'due_date_changed', payload: { due_date: '2026-06-12' } })),
    ).toBe('puso la fecha límite en 12 de jun de 2026')
  })

  it('distingue haber sacado la fecha límite', () => {
    expect(describeActivity(event({ type: 'due_date_changed', payload: { due_date: null } }))).toBe(
      'sacó la fecha límite',
    )
  })

  it('tiene texto para todos los tipos de evento', () => {
    const types: BugActivityEntry['type'][] = [
      'created',
      'imported',
      'analyzed',
      'assigned',
      'unassigned',
      'deleted',
      'commented',
      'restored',
      'voted',
    ]
    for (const type of types) {
      expect(describeActivity(event({ type }))).toBeTruthy()
    }
  })
})

describe('formatDueDate', () => {
  it('formatea el día sin correrlo por zona horaria', () => {
    // `new Date('2026-06-12')` se interpreta como UTC y en Argentina daría el 11.
    expect(formatDueDate('2026-06-12')).toBe('12 de jun de 2026')
    expect(formatDueDate('2026-01-01')).toContain('1 de ene')
  })

  it('devuelve el valor crudo si no tiene el formato esperado', () => {
    expect(formatDueDate('mañana')).toBe('mañana')
  })
})

describe('isOverdue', () => {
  const hoy = new Date(2026, 5, 15)

  it('detecta una fecha pasada', () => {
    expect(isOverdue('2026-06-12', hoy)).toBe(true)
  })

  it('no marca vencido el mismo día', () => {
    expect(isOverdue('2026-06-15', hoy)).toBe(false)
  })

  it('no marca vencida una fecha futura', () => {
    expect(isOverdue('2026-06-20', hoy)).toBe(false)
  })

  it('sin fecha límite no hay vencimiento', () => {
    expect(isOverdue(null, hoy)).toBe(false)
    expect(isOverdue(undefined, hoy)).toBe(false)
  })
})

describe('showsOverdueWarning', () => {
  const hoy = new Date(2026, 5, 15)

  it('avisa en un bug activo con fecha vencida', () => {
    expect(showsOverdueWarning('2026-06-12', 'nuevo', hoy)).toBe(true)
    expect(showsOverdueWarning('2026-06-12', 'en_progreso', hoy)).toBe(true)
  })

  it('no avisa si el bug ya está cerrado: la fecha no reclama nada', () => {
    expect(showsOverdueWarning('2026-06-12', 'solucionado', hoy)).toBe(false)
    expect(showsOverdueWarning('2026-06-12', 'cerrado', hoy)).toBe(false)
    expect(showsOverdueWarning('2026-06-12', 'no_replicado', hoy)).toBe(false)
  })
})
