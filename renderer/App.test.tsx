import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

type WindowWithOptionalElectronAPI = Window & { electronAPI?: typeof window.electronAPI }

const originalElectronAPI = (window as WindowWithOptionalElectronAPI).electronAPI

afterEach(() => {
  if (originalElectronAPI) {
    window.electronAPI = originalElectronAPI
  } else {
    Reflect.deleteProperty(window as WindowWithOptionalElectronAPI, 'electronAPI')
  }
})

describe('App', () => {
  it('muestra un fallback cuando no existe el preload de Electron', () => {
    Reflect.deleteProperty(window as WindowWithOptionalElectronAPI, 'electronAPI')

    render(<App />)

    expect(screen.getByText('BugLens necesita Electron')).toBeInTheDocument()
    expect(screen.getByText(/preload de Electron/)).toBeInTheDocument()
  })
})
