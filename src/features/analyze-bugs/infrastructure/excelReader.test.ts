import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { extractGoogleLinks, mapHeader, readExcel, writeBugsExcel } from './excelReader'

function makeExportRow(over: Partial<Parameters<typeof writeBugsExcel>[1][number]> = {}) {
  return {
    title: 'Login roto',
    rowIndex: 0,
    category: 'frontend',
    severity: 'high',
    bugType: 'ui',
    confidence: 0.9,
    summary: 'el botón no responde',
    observed: 'no pasa nada al hacer click',
    expected: 'debería iniciar sesión',
    steps: ['abrir login', 'click en entrar'],
    environment: 'prod',
    missingInformation: ['versión del navegador'],
    ...over,
  }
}

describe('extractGoogleLinks', () => {
  it('extrae links de Google Docs', () => {
    const links = extractGoogleLinks('ver https://docs.google.com/document/d/abc_123-XY/edit ahí')
    expect(links).toEqual(['https://docs.google.com/document/d/abc_123-XY/edit'])
  })

  it('extrae links de Google Drive (file/d y open?id)', () => {
    expect(extractGoogleLinks('https://drive.google.com/file/d/XyZ123/view')).toHaveLength(1)
    expect(extractGoogleLinks('https://drive.google.com/open?id=XyZ123')).toHaveLength(1)
  })

  it('ignora URLs que no son de google', () => {
    expect(extractGoogleLinks('https://example.com/doc https://github.com/x')).toEqual([])
  })

  it('dedup: el mismo link dos veces aparece una sola vez', () => {
    const u = 'https://docs.google.com/document/d/abc123/edit'
    expect(extractGoogleLinks(`${u} y de nuevo ${u}`)).toEqual([u])
  })

  it('sin links → []', () => {
    expect(extractGoogleLinks('texto sin urls')).toEqual([])
  })
})

describe('mapHeader', () => {
  it('mapea variaciones de título', () => {
    for (const h of ['Título', 'TITLE', 'Summary', 'Resumen']) {
      expect(mapHeader(h)).toBe('title')
    }
  })

  it('mapea campos comunes ES/EN', () => {
    expect(mapHeader('Descripción')).toBe('description')
    expect(mapHeader('Pasos para reproducir')).toBe('stepsToReproduce')
    expect(mapHeader('Resultado esperado')).toBe('expectedResult')
    expect(mapHeader('Resultado actual')).toBe('actualResult')
    expect(mapHeader('Entorno')).toBe('environment')
    expect(mapHeader('Estado')).toBe('status')
    expect(mapHeader('Prioridad')).toBe('priority')
  })

  it('es case-insensitive', () => {
    expect(mapHeader('  DESCRIPCIÓN  ')).toBe('description')
  })

  it('cabeceras desconocidas → null', () => {
    expect(mapHeader('Vista')).toBeNull()
    expect(mapHeader('Foobar')).toBeNull()
  })
})

describe('readExcel (integración con archivo real)', () => {
  let dir: string
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  function writeXlsx(rows: string[][]): string {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-xlsx-'))
    const file = path.join(dir, 'bugs.xlsx')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Hoja1')
    XLSX.writeFile(wb, file)
    return file
  }

  it('mapea columnas, genera ids y extrae links de docs', () => {
    const file = writeXlsx([
      ['Título', 'Descripción', 'Entorno', 'Notas'],
      [
        'Login roto',
        'no anda el botón',
        'prod',
        'doc https://docs.google.com/document/d/abc123/edit',
      ],
      ['Otro bug', 'falla feo', 'dev', ''],
    ])
    const bugs = readExcel(file)

    expect(bugs).toHaveLength(2)
    expect(bugs[0].id).toBe('bug-0001')
    expect(bugs[0].title).toBe('Login roto')
    expect(bugs[0].description).toBe('no anda el botón')
    expect(bugs[0].environment).toBe('prod')
    expect(bugs[0].googleDocLinks).toContain('https://docs.google.com/document/d/abc123/edit')
    expect(bugs[1].title).toBe('Otro bug')
    expect(bugs[1].googleDocLinks).toEqual([])
  })

  it('filtra filas que son encabezados repetidos', () => {
    const file = writeXlsx([
      ['Título', 'Entorno'],
      ['Título', 'Entorno'], // fila basura idéntica al header → debe filtrarse
      ['Bug real', 'dev'],
    ])
    const bugs = readExcel(file)
    expect(bugs).toHaveLength(1)
    expect(bugs[0].title).toBe('Bug real')
  })

  it('hoja sin filas de datos lanza error', () => {
    const file = writeXlsx([['Título', 'Entorno']]) // solo header
    expect(() => readExcel(file)).toThrow()
  })

  // ── Robustez: Excels "feos" igual cargan (no tiran), y filtran basura ──

  it('filtra filas 100% vacías (no genera bugs fantasma)', () => {
    const file = writeXlsx([
      ['Título', 'Entorno'],
      ['Bug uno', 'prod'],
      ['', ''], // fila totalmente vacía → debe filtrarse
      ['Bug dos', 'dev'],
    ])
    const bugs = readExcel(file)
    expect(bugs).toHaveLength(2)
    expect(bugs.map((b) => b.title)).toEqual(['Bug uno', 'Bug dos'])
  })

  it('sin columna de título reconocible → usa fallback, no falla', () => {
    const file = writeXlsx([
      ['Pantalla', 'Notas'], // ninguna mapea a "title"
      ['Login', 'algo raro'],
    ])
    let bugs: ReturnType<typeof readExcel> = []
    expect(() => {
      bugs = readExcel(file)
    }).not.toThrow()
    expect(bugs).toHaveLength(1)
    expect(bugs[0].title).toBe('Login') // cae a la primera columna
  })

  it('celdas numéricas se cargan como string', () => {
    const file = writeXlsx([
      ['Título', 'Prioridad'],
      ['Bug con prioridad', '3'],
    ])
    const bugs = readExcel(file)
    expect(bugs[0].priority).toBe('3')
    expect(typeof bugs[0].rawRow['Prioridad']).toBe('string')
  })

  it('filas parciales (celdas faltantes) igual cargan', () => {
    const file = writeXlsx([
      ['Título', 'Descripción', 'Entorno'],
      ['Solo título', '', ''], // sin descripción ni entorno
    ])
    const bugs = readExcel(file)
    expect(bugs).toHaveLength(1)
    expect(bugs[0].title).toBe('Solo título')
    expect(bugs[0].description).toBe('')
    expect(bugs[0].environment).toBe('')
  })

  it('carga un CSV real (con acentos UTF-8)', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-csv-'))
    const file = path.join(dir, 'bugs.csv')
    fs.writeFileSync(
      file,
      'Título,Descripción,Entorno\nLogin roto,no función el botón ó,prod\n',
      'utf8',
    )

    const bugs = readExcel(file)
    expect(bugs).toHaveLength(1)
    expect(bugs[0].title).toBe('Login roto')
    expect(bugs[0].description).toContain('ó') // el acento sobrevive (codepage UTF-8)
    expect(bugs[0].environment).toBe('prod')
  })
})

describe('writeBugsExcel (genera xlsx desde cero)', () => {
  let dir: string
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  function readBack(filePath: string): Record<string, string>[] {
    const wb = XLSX.readFile(filePath, { type: 'file' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  }

  it('escribe una fila por bug con título y columnas del análisis', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-export-'))
    const file = path.join(dir, 'bugs.xlsx')

    writeBugsExcel(file, [
      makeExportRow({ title: 'Login roto' }),
      makeExportRow({ title: 'Otro bug', category: 'backend', severity: 'low' }),
    ])

    const rows = readBack(file)
    expect(rows).toHaveLength(2)
    expect(rows[0]['Título']).toBe('Login roto')
    expect(rows[0]['Categoría']).toBe('frontend')
    expect(rows[0]['Severidad']).toBe('high')
    expect(rows[0]['Confianza']).toBe('0.90')
    expect(rows[0]['Pasos']).toBe('abrir login | click en entrar')
    expect(rows[0]['Falta info']).toBe('versión del navegador')
    expect(rows[1]['Título']).toBe('Otro bug')
    expect(rows[1]['Categoría']).toBe('backend')
  })

  it('no requiere archivo original ni rowIndex válido', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-export-'))
    const file = path.join(dir, 'bugs.xlsx')
    expect(() => writeBugsExcel(file, [makeExportRow()])).not.toThrow()
    expect(fs.existsSync(file)).toBe(true)
  })
})
