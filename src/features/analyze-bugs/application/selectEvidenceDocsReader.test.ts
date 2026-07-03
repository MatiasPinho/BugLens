import { describe, expect, it, vi } from 'vitest'
import type { EvidenceDocsReader } from './selectEvidenceDocsReader.js'
import { selectEvidenceDocsReader } from './selectEvidenceDocsReader.js'

function makeReader(authenticated: boolean): EvidenceDocsReader {
  return {
    isAuthenticated: vi.fn(() => authenticated),
    readDocuments: vi.fn(),
  }
}

describe('selectEvidenceDocsReader', () => {
  it('prefiere la sesion del navegador', () => {
    const browser = makeReader(true)
    const oauth = makeReader(true)

    const selection = selectEvidenceDocsReader(browser, oauth)

    expect(selection.access).toBe('browser')
    expect(selection.reader).toBe(browser)
    expect(selection.log.level).toBe('info')
  })

  it('usa OAuth cuando no hay sesion del navegador', () => {
    const browser = makeReader(false)
    const oauth = makeReader(true)

    const selection = selectEvidenceDocsReader(browser, oauth)

    expect(selection.access).toBe('oauth')
    expect(selection.reader).toBe(oauth)
  })

  it('continua sin lector cuando no hay autenticacion', () => {
    const selection = selectEvidenceDocsReader(makeReader(false), makeReader(false))

    expect(selection.access).toBe('none')
    expect(selection.reader).toBeNull()
    expect(selection.log.level).toBe('warn')
  })
})
