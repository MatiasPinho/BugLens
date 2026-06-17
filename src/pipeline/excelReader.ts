import * as XLSX from 'xlsx'
import type { RawBug } from '../types/index.js'

// Regex para detectar URLs de Google Docs o Google Drive en cualquier celda
const GOOGLE_DOC_REGEX =
  /https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation|forms)\/d\/[a-zA-Z0-9_-]+[^\s"]*/g

const GOOGLE_DRIVE_REGEX =
  /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)[a-zA-Z0-9_-]+[^\s"]*/g

/**
 * Extrae todos los Google Doc/Drive links de un string.
 */
export function extractGoogleLinks(text: string): string[] {
  const links: string[] = []
  const docMatches = text.matchAll(GOOGLE_DOC_REGEX)
  const driveMatches = text.matchAll(GOOGLE_DRIVE_REGEX)
  for (const m of docMatches) links.push(m[0])
  for (const m of driveMatches) links.push(m[0])
  return [...new Set(links)] // dedup
}

/**
 * Intenta mapear cabeceras del Excel a campos conocidos del bug.
 * Es case-insensitive y acepta variaciones comunes en español/inglés.
 */
export function mapHeader(header: string): string | null {
  const h = header.toLowerCase().trim()
  if (/t[ií]tulo|title|summary|resumen/.test(h)) return 'title'
  if (/descripci[oó]n|description|detail/.test(h)) return 'description'
  if (/paso|step/.test(h)) return 'stepsToReproduce'
  if (/esperado|expected/.test(h)) return 'expectedResult'
  if (/actual|resultado actual|real result/.test(h)) return 'actualResult'
  if (/entorno|environment|env/.test(h)) return 'environment'
  if (/reporter|reportado|reported by/.test(h)) return 'reporter'
  if (/asignado|assignee|assigned/.test(h)) return 'assignee'
  if (/estado|status/.test(h)) return 'status'
  if (/prioridad|priority/.test(h)) return 'priority'
  return null
}

/**
 * Parsea un archivo Excel y devuelve la lista de bugs crudos.
 * Toma la primera hoja con datos.
 */
export function readExcel(filePath: string): RawBug[] {
  const isCsv = filePath.toLowerCase().endsWith('.csv')
  const workbook = XLSX.readFile(filePath, {
    type: 'file',
    cellFormula: false,
    // CSV: forzar UTF-8 para evitar que Ã³ aparezca en lugar de ó
    codepage: isCsv ? 65001 : undefined,
  })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('El Excel no tiene hojas.')

  const sheet = workbook.Sheets[sheetName]
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false, // fuerza string en todas las celdas
  })

  if (rows.length === 0) throw new Error('La primera hoja del Excel está vacía.')

  // Detectar filas que son encabezados repetidos (ej: fila con Nombre=Nombre, Vista=Vista)
  const isRepeatedHeader = (row: Record<string, string>): boolean => {
    const entries = Object.entries(row).filter(([, v]) => v.trim() !== '')
    if (entries.length === 0) return false
    const matching = entries.filter(([k, v]) => k.trim().toLowerCase() === v.trim().toLowerCase())
    return matching.length >= Math.ceil(entries.length * 0.6)
  }

  // Filas 100% vacías (todas las celdas en blanco): basura, no generan un bug fantasma.
  const isEmptyRow = (row: Record<string, string>): boolean =>
    Object.values(row).every((v) => String(v ?? '').trim() === '')

  const validRows = rows.filter((row) => !isRepeatedHeader(row) && !isEmptyRow(row))

  return validRows.map((row, index) => {
    const rawRow: Record<string, string> = {}
    const mapped: Partial<RawBug> = {}
    let googleDocLinks: string[] = []

    for (const [header, value] of Object.entries(row)) {
      const cellValue = String(value ?? '').trim()
      rawRow[header] = cellValue

      const field = mapHeader(header)
      if (field) {
        ;(mapped as Record<string, string>)[field] = cellValue
      }

      // Busca links en TODAS las celdas
      googleDocLinks.push(...extractGoogleLinks(cellValue))
    }

    googleDocLinks = [...new Set(googleDocLinks)]

    // Genera un ID estable para el bug
    const id = `bug-${String(index + 1).padStart(4, '0')}`

    // Fallback para el título si no hay columna mapeada
    const title =
      mapped.title ||
      rawRow['Título'] ||
      rawRow['Title'] ||
      rawRow['Summary'] ||
      rawRow[Object.keys(rawRow)[0]] ||
      `Bug #${index + 1}`

    return {
      id,
      rowIndex: index + 1,
      title,
      description: mapped.description || '',
      stepsToReproduce: mapped.stepsToReproduce,
      expectedResult: mapped.expectedResult,
      actualResult: mapped.actualResult,
      environment: mapped.environment,
      reporter: mapped.reporter,
      assignee: mapped.assignee,
      status: mapped.status,
      priority: mapped.priority,
      rawRow,
      googleDocLinks,
    } satisfies RawBug
  })
}

// Columnas del análisis que se agregan/exportan. Origen único para ambos exports.
const ANALYSIS_HEADERS = [
  'Categoría',
  'Severidad',
  'Tipo',
  'Confianza',
  'Resumen',
  'Qué pasa (reescrito)',
  'Qué debería pasar',
  'Pasos',
  'Ambiente',
  'Falta info',
  'Error análisis',
] as const

// Una fila de resultados del análisis, lista para serializar a Excel.
export interface AnalysisExportRow {
  rowIndex: number
  category: string
  severity: string
  bugType: string
  confidence: number
  summary: string
  observed: string
  expected: string
  steps: string[]
  environment: string
  missingInformation: string[]
  error?: string
}

// Serializa una fila de análisis al mismo orden que ANALYSIS_HEADERS.
function analysisRowValues(result: AnalysisExportRow): string[] {
  return [
    result.category,
    result.severity,
    result.bugType,
    result.confidence.toFixed(2),
    result.summary,
    result.observed,
    result.expected,
    result.steps.join(' | '),
    result.environment,
    result.missingInformation.join(' | '),
    result.error ?? '',
  ]
}

/**
 * Escribe el Excel enriquecido: reabre el original y agrega las columnas del
 * análisis a la derecha, ubicando cada resultado en su fila por `rowIndex`.
 */
export function writeEnrichedExcel(
  outputPath: string,
  originalPath: string,
  results: AnalysisExportRow[],
): void {
  const workbook = XLSX.readFile(originalPath, { type: 'file', cellFormula: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Encuentra la columna final
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  const lastCol = range.e.c

  // Escribe cabeceras en la fila 1
  ANALYSIS_HEADERS.forEach((header, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: lastCol + 1 + i })
    sheet[cellRef] = { v: header, t: 's' }
  })

  // Actualiza el rango
  range.e.c = lastCol + ANALYSIS_HEADERS.length
  sheet['!ref'] = XLSX.utils.encode_range(range)

  // Escribe los resultados por fila
  for (const result of results) {
    const r = result.rowIndex // rowIndex ya es 1-based para la fila de datos (fila 2 del sheet = index 1)
    analysisRowValues(result).forEach((val, i) => {
      const cellRef = XLSX.utils.encode_cell({ r, c: lastCol + 1 + i })
      sheet[cellRef] = { v: val, t: 's' }
    })
  }

  XLSX.writeFile(workbook, outputPath)
}

/**
 * Genera un Excel desde cero (sin original) con los resultados del análisis.
 * Se usa cuando hay bugs cargados a mano: no existe una fila/archivo de origen
 * al que anclarse, así que se arma una hoja autocontenida con el título por delante.
 */
export function writeBugsExcel(
  outputPath: string,
  results: Array<AnalysisExportRow & { title: string }>,
): void {
  const headers = ['Título', ...ANALYSIS_HEADERS]
  const rows = results.map((r) => [r.title, ...analysisRowValues(r)])

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Bugs')
  XLSX.writeFile(workbook, outputPath)
}
