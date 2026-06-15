import type { RawBug } from '../types/index.js'
import { extractGoogleLinks } from './excelReader.js'

/**
 * Campos que el usuario carga a mano en el formulario de bug manual.
 * Todos opcionales: el reporte del QA suele venir incompleto y el LLM
 * reescribe lo que haya (lo que falte va a `missingInformation`).
 */
export interface ManualBugFields {
  title?: string
  description?: string
  stepsToReproduce?: string
  expectedResult?: string
  actualResult?: string
  environment?: string
}

// Etiquetas humanas para las celdas de `rawRow`, equivalentes a las cabeceras
// que tendría una fila de Excel. Mantienen consistencia con lo que ve el LLM.
const FIELD_LABELS: Record<keyof ManualBugFields, string> = {
  title: 'Título',
  description: 'Descripción',
  stepsToReproduce: 'Pasos para reproducir',
  expectedResult: 'Resultado esperado',
  actualResult: 'Resultado actual',
  environment: 'Entorno',
}

/**
 * Arma un `RawBug` válido a partir de los campos cargados a mano, sin pasar por
 * un Excel. Reusa `extractGoogleLinks` para detectar Google Docs/Drive pegados
 * en cualquier campo de texto.
 *
 * @param seq número de secuencia para el id (estable y único dentro de la sesión).
 *   La identidad real para el estado persistente es por contenido (`bugRecordKey`),
 *   así que el id solo sirve para deduplicar filas en la tabla.
 * @throws si no hay ni título ni descripción — un bug sin nada que reescribir.
 */
export function buildManualBug(fields: ManualBugFields, seq: number): RawBug {
  const trim = (s?: string) => (s ?? '').trim()
  const title = trim(fields.title)
  const description = trim(fields.description)

  if (!title && !description) {
    throw new Error('El bug manual necesita al menos un título o una descripción.')
  }

  // rawRow sintetizado: solo los campos con contenido, con sus etiquetas humanas.
  const rawRow: Record<string, string> = {}
  for (const key of Object.keys(FIELD_LABELS) as (keyof ManualBugFields)[]) {
    const value = trim(fields[key])
    if (value) rawRow[FIELD_LABELS[key]] = value
  }

  // Busca links en todos los campos de texto (igual que el reader hace por celda).
  const allText = Object.values(rawRow).join('\n')
  const googleDocLinks = extractGoogleLinks(allText)

  return {
    id: `manual-${String(seq).padStart(4, '0')}`,
    rowIndex: 0, // marcador "sin fila": estos bugs no provienen de un Excel
    title: title || `Bug manual #${seq}`,
    description,
    stepsToReproduce: trim(fields.stepsToReproduce) || undefined,
    expectedResult: trim(fields.expectedResult) || undefined,
    actualResult: trim(fields.actualResult) || undefined,
    environment: trim(fields.environment) || undefined,
    rawRow,
    googleDocLinks,
  } satisfies RawBug
}
