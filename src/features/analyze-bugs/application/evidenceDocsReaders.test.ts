import { describe, expect, it, vi } from 'vitest'

vi.mock('../infrastructure/googleDocsReader.js', () => ({
  GoogleDocsReader: vi.fn(function GoogleDocsReader(
    this: Record<string, unknown>,
    clientId: string,
    clientSecret: string,
    tokenPath: string,
  ) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.tokenPath = tokenPath
  }),
}))

vi.mock('../infrastructure/browserDocsReader.js', () => ({
  BrowserDocsReader: vi.fn(function BrowserDocsReader(
    this: Record<string, unknown>,
    userDataPath: string,
  ) {
    this.userDataPath = userDataPath
  }),
}))

describe('evidenceDocsReaders', () => {
  it('resuelve el token OAuth dentro de userData', async () => {
    const { googleTokenPath } = await import('./evidenceDocsReaders.js')

    expect(googleTokenPath('C:/BugLens')).toContain('google-token.json')
  })

  it('crea lector OAuth con settings de Google', async () => {
    const { createGoogleDocsReader } = await import('./evidenceDocsReaders.js')

    const reader = createGoogleDocsReader(
      { googleClientId: 'client-id', googleClientSecret: 'secret' },
      'C:/BugLens',
    ) as unknown as Record<string, unknown>

    expect(reader.clientId).toBe('client-id')
    expect(reader.clientSecret).toBe('secret')
    expect(String(reader.tokenPath)).toContain('google-token.json')
  })

  it('crea lector de navegador con userData', async () => {
    const { createBrowserDocsReader } = await import('./evidenceDocsReaders.js')

    const reader = createBrowserDocsReader('C:/BugLens') as unknown as Record<string, unknown>

    expect(reader.userDataPath).toBe('C:/BugLens')
  })
})
