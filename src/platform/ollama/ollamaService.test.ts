import { describe, expect, it, vi } from 'vitest'
import { stopOllamaProcessTree } from './ollamaService'

describe('stopOllamaProcessTree', () => {
  it('cierra todo el árbol con taskkill en Windows', () => {
    const runTaskkill = vi.fn()
    const killProcess = vi.fn()

    expect(stopOllamaProcessTree(1234, { platform: 'win32', runTaskkill, killProcess })).toBe(true)
    expect(runTaskkill).toHaveBeenCalledWith(1234)
    expect(killProcess).not.toHaveBeenCalled()
  })

  it('cierra el grupo completo en POSIX', () => {
    const killProcess = vi.fn()

    expect(stopOllamaProcessTree(1234, { platform: 'linux', killProcess })).toBe(true)
    expect(killProcess).toHaveBeenCalledWith(-1234, 'SIGTERM')
  })

  it('cae al proceso directo si el grupo POSIX no existe', () => {
    const killProcess = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('grupo inexistente')
      })
      .mockImplementationOnce(() => undefined)

    expect(stopOllamaProcessTree(1234, { platform: 'darwin', killProcess })).toBe(true)
    expect(killProcess).toHaveBeenNthCalledWith(1, -1234, 'SIGTERM')
    expect(killProcess).toHaveBeenNthCalledWith(2, 1234, 'SIGTERM')
  })
})
