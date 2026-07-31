// bugActivity.ts
//
// Lógica pura del panel de propiedades: árbol de comentarios y redacción del
// feed de actividad. No toca React ni el DOM.

import type {
  BugActivityEntry,
  BugActivityType,
  BugComment,
  BugStatus,
} from '../../../../src/shared/contracts'
import { statusLabel } from './bugPresentation'

/** Comentario con sus respuestas ya anidadas. */
export interface CommentNode extends BugComment {
  depth: number
  replies: CommentNode[]
}

/**
 * Arma el árbol de hilos a partir de la lista plana que devuelve el servidor.
 *
 * El backend manda los comentarios planos con `parentId` porque una consulta
 * recursiva en SQL complica el payload sin ganar nada. Acá se reconstruye.
 *
 * Un comentario cuyo padre no está en la lista (porque se borró, o porque el
 * corte del payload lo dejó afuera) se trata como raíz: perder el sangrado es
 * preferible a perder el comentario.
 */
export function buildCommentThread(comments: BugComment[]): CommentNode[] {
  const nodesById = new Map<string, CommentNode>()
  for (const comment of comments) {
    nodesById.set(comment.id, { ...comment, depth: 0, replies: [] })
  }

  const roots: CommentNode[] = []
  for (const comment of comments) {
    const node = nodesById.get(comment.id)
    if (!node) continue
    const parent = comment.parentId ? nodesById.get(comment.parentId) : undefined
    // Un comentario que se declara hijo de sí mismo colgaría el recorrido.
    if (parent && parent.id !== node.id) parent.replies.push(node)
    else roots.push(node)
  }

  // La profundidad se asigna recorriendo desde las raíces: así un ciclo entre
  // comentarios no se traduce en recursión infinita (cada nodo se visita una vez).
  const seen = new Set<string>()
  const assignDepth = (nodes: CommentNode[], depth: number) => {
    for (const node of nodes) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      node.depth = depth
      sortByCreatedAt(node.replies)
      assignDepth(node.replies, depth + 1)
    }
  }

  sortByCreatedAt(roots)
  assignDepth(roots, 0)
  return roots
}

function sortByCreatedAt(nodes: CommentNode[]): void {
  nodes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Cantidad total de comentarios del hilo, incluidas las respuestas. */
export function countThread(nodes: CommentNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countThread(node.replies), 0)
}

/** Nombre para mostrar de quien hizo algo. Cae al email y después a "alguien". */
export function actorNameOf(entry: Pick<BugActivityEntry, 'actorName' | 'actorEmail'>): string {
  const name = entry.actorName?.trim()
  if (name) return name
  const email = entry.actorEmail?.trim()
  if (email) return email.split('@')[0] ?? email
  return 'alguien'
}

const ACTIVITY_TEXT: Record<BugActivityType, string> = {
  created: 'creó el bug',
  imported: 'importó el bug',
  analyzed: 'analizó el bug',
  status_changed: 'cambió el estado',
  assigned: 'asignó responsables',
  unassigned: 'quitó responsables',
  deleted: 'borró el bug',
  commented: 'comentó',
  restored: 'restauró el bug',
  due_date_changed: 'cambió la fecha límite',
  voted: 'votó un comentario',
}

/**
 * Frase del feed de actividad, sin el nombre del actor (lo pone la UI aparte
 * para poder destacarlo). Los casos con datos concretos los usan: un cambio de
 * estado dice a qué estado, no solo "cambió el estado".
 */
export function describeActivity(entry: BugActivityEntry): string {
  if (entry.type === 'status_changed' && entry.toStatus) {
    const to = statusLabel[entry.toStatus]
    const from = entry.fromStatus ? statusLabel[entry.fromStatus] : null
    return from ? `pasó el bug de ${from} a ${to}` : `marcó el bug como ${to}`
  }

  if (entry.type === 'due_date_changed') {
    const dueDate = entry.payload?.['due_date']
    if (typeof dueDate === 'string' && dueDate) {
      return `puso la fecha límite en ${formatDueDate(dueDate)}`
    }
    return 'sacó la fecha límite'
  }

  return ACTIVITY_TEXT[entry.type]
}

/**
 * Fecha límite en texto. Llega como `YYYY-MM-DD` (un día, no un instante), así
 * que se construye en horario local: `new Date('2026-06-12')` la interpretaría
 * como UTC y en Argentina mostraría el 11.
 */
export function formatDueDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** `true` si la fecha límite ya pasó, comparando por día y no por instante. */
export function isOverdue(dueDate: string | null | undefined, today = new Date()): boolean {
  if (!dueDate) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate)
  if (!match) return false
  const [, year, month, day] = match
  const due = new Date(Number(year), Number(month) - 1, Number(day))
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return due.getTime() < startOfToday.getTime()
}

/** Estados en los que una fecha límite vencida ya no reclama nada. */
const CLOSED_STATUSES: readonly BugStatus[] = ['solucionado', 'cerrado', 'no_replicado']

export function showsOverdueWarning(
  dueDate: string | null | undefined,
  status: BugStatus,
  today = new Date(),
): boolean {
  if (CLOSED_STATUSES.includes(status)) return false
  return isOverdue(dueDate, today)
}
