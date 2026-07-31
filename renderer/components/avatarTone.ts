// Identidad visual de las personas: tono e iniciales del avatar.
// Lógica pura, sin React — se usa desde bugs (assignees), actividad, comentarios
// y el topbar del equipo. El tono NO se elige en el componente: se deriva del id
// del perfil para que una misma persona conserve su color en toda la app.

import { AVATAR_TONE_COUNT } from '../theme'

// Hash determinístico y estable entre sesiones (djb2). No es criptográfico: solo
// necesita repartir ids parejo entre los tonos disponibles.
function hashCode(value: string): number {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return Math.abs(hash)
}

// Devuelve 1..AVATAR_TONE_COUNT, que mapea a las clases `.avatar-tone-N`.
export function avatarToneOf(profileId: string | null | undefined): number {
  if (!profileId) return 1
  return (hashCode(profileId) % AVATAR_TONE_COUNT) + 1
}

export function avatarToneClass(profileId: string | null | undefined): string {
  return `avatar-tone-${avatarToneOf(profileId)}`
}

// Iniciales para un avatar o una marca. Sirve tanto para personas
// (`juan.perez@estudio.com` → `JP`) como para nombres de proyecto (`Pin Admin`
// → `PA`): descarta el dominio del email y trata `.`/`_`/`-` como separadores.
export function initialsOf(value: string): string {
  const cleaned = value
    .replace(/@.*$/, '')
    .replace(/[._-]+/g, ' ')
    .trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}
