import { describe, expect, it, vi } from 'vitest'
import type { GoogleDocContent, RawBug } from '../types/index'
import { BugEnricher } from './bugEnricher'

function bug(id: string, links: string[]): RawBug {
  return { id, rowIndex: 1, title: id, description: '', rawRow: {}, googleDocLinks: links }
}

function fakeReader() {
  return {
    readDocuments: vi.fn(
      async (urls: string[]): Promise<GoogleDocContent[]> =>
        urls.map((u) => ({ url: u, title: `doc ${u}`, text: 'contenido', accessible: true })),
    ),
  }
}

describe('BugEnricher — dedup de docs', () => {
  it('un mismo doc referenciado por varios bugs se baja UNA sola vez', async () => {
    const reader = fakeReader()
    const enricher = new BugEnricher(reader)

    await enricher.enrich(bug('b1', ['urlA']))
    await enricher.enrich(bug('b2', ['urlA'])) // mismo doc
    await enricher.enrich(bug('b3', ['urlB'])) // otro doc

    // urlA una vez + urlB una vez = 2 llamadas (no 3)
    expect(reader.readDocuments).toHaveBeenCalledTimes(2)
    const fetched = reader.readDocuments.mock.calls.map((c) => c[0][0])
    expect(fetched.sort()).toEqual(['urlA', 'urlB'])
  })

  it('devuelve el doc cacheado para el segundo bug', async () => {
    const reader = fakeReader()
    const enricher = new BugEnricher(reader)

    const r1 = await enricher.enrich(bug('b1', ['urlA']))
    const r2 = await enricher.enrich(bug('b2', ['urlA']))

    expect(r1.googleDocs[0].url).toBe('urlA')
    expect(r2.googleDocs[0].url).toBe('urlA')
  })

  it('sin links → sin docs (y sin llamar al reader)', async () => {
    const reader = fakeReader()
    const enricher = new BugEnricher(reader)
    const r = await enricher.enrich(bug('b1', []))
    expect(r.googleDocs).toEqual([])
    expect(reader.readDocuments).not.toHaveBeenCalled()
  })

  it('sin reader (null) → sin docs', async () => {
    const enricher = new BugEnricher(null)
    const r = await enricher.enrich(bug('b1', ['urlA']))
    expect(r.googleDocs).toEqual([])
  })
})
