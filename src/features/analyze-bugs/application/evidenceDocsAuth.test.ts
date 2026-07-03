import { describe, expect, it, vi } from 'vitest'
import {
  getBrowserDocsAuthStatus,
  getGoogleDocsAuthStatus,
  revokeBrowserDocsAuth,
  revokeGoogleDocsAuth,
  startBrowserDocsLogin,
  startGoogleDocsAuth,
} from './evidenceDocsAuth.js'

describe('evidenceDocsAuth', () => {
  it('devuelve estado de autenticacion OAuth', () => {
    expect(getGoogleDocsAuthStatus({ isAuthenticated: () => true })).toEqual({
      authenticated: true,
    })
  })

  it('abre URL OAuth y espera callback', async () => {
    const opener = { openExternal: vi.fn().mockResolvedValue(undefined) }
    const reader = {
      getAuthUrl: vi.fn(() => 'https://accounts.google.com/auth'),
      waitForCallback: vi.fn().mockResolvedValue(undefined),
    }

    await expect(startGoogleDocsAuth(reader, opener)).resolves.toEqual({ ok: true })

    expect(opener.openExternal).toHaveBeenCalledWith('https://accounts.google.com/auth')
    expect(reader.waitForCallback).toHaveBeenCalled()
  })

  it('devuelve error cuando falla callback OAuth', async () => {
    const result = await startGoogleDocsAuth(
      {
        getAuthUrl: () => 'https://accounts.google.com/auth',
        waitForCallback: vi.fn().mockRejectedValue(new Error('timeout')),
      },
      { openExternal: vi.fn().mockResolvedValue(undefined) },
    )

    expect(result).toEqual({ ok: false, error: 'timeout' })
  })

  it('revoca OAuth', async () => {
    const reader = { revokeAuth: vi.fn().mockResolvedValue(undefined) }

    await expect(revokeGoogleDocsAuth(reader)).resolves.toEqual({ ok: true })
    expect(reader.revokeAuth).toHaveBeenCalled()
  })

  it('maneja login de navegador', async () => {
    const reader = { startLoginFlow: vi.fn().mockResolvedValue(undefined) }

    await expect(startBrowserDocsLogin(reader)).resolves.toEqual({ ok: true })
  })

  it('devuelve error cuando falla login de navegador', async () => {
    const result = await startBrowserDocsLogin({
      startLoginFlow: vi.fn().mockRejectedValue(new Error('cerrado')),
    })

    expect(result).toEqual({ ok: false, error: 'cerrado' })
  })

  it('devuelve estado y revoca sesion de navegador', () => {
    const reader = {
      isAuthenticated: vi.fn(() => false),
      revokeSession: vi.fn(),
    }

    expect(getBrowserDocsAuthStatus(reader)).toEqual({ authenticated: false })
    expect(revokeBrowserDocsAuth(reader)).toEqual({ ok: true })
    expect(reader.revokeSession).toHaveBeenCalled()
  })
})
