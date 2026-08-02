import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import UploadBugsScreen from './UploadBugsScreen'

function renderUpload(over: Partial<React.ComponentProps<typeof UploadBugsScreen>> = {}) {
  const props = {
    excelPath: null,
    onFileSelected: vi.fn(),
    onManualBug: vi.fn(),
    onAnalyze: vi.fn(),
    engineAvailability: true,
    onOpenSettings: vi.fn(),
    ...over,
  }
  render(<UploadBugsScreen {...props} />)
  return props
}

describe('UploadBugsScreen', () => {
  it('solo habilita el análisis con archivo y motor disponible', async () => {
    const props = renderUpload({ excelPath: 'C:\\QA\\bugs.xlsx' })
    const analyze = screen.getByRole('button', { name: 'Analizar bugs' })

    expect(analyze).toBeEnabled()
    await userEvent.click(analyze)

    expect(props.onAnalyze).toHaveBeenCalledTimes(1)
  })

  it('permite preparar el Excel si Ollama no está disponible', async () => {
    const props = renderUpload({
      excelPath: 'C:\\QA\\bugs.xlsx',
      engineAvailability: false,
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Ollama no está disponible')
    expect(screen.getByRole('button', { name: 'Analizar bugs' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cargar bug manual' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Archivo cargado/ })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir configuración' }))
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('distingue la comprobación inicial de un error', () => {
    renderUpload({ excelPath: 'C:\\QA\\bugs.xlsx', engineAvailability: null })

    expect(
      screen.getByText('Comprobando el modelo local').closest('[role="status"]'),
    ).toHaveTextContent('Podés elegir el Excel mientras validamos Ollama.')
    expect(screen.getByRole('button', { name: 'Analizar bugs' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin archivo mantiene el análisis deshabilitado aunque Ollama responda', () => {
    renderUpload()

    expect(screen.getByRole('button', { name: 'Analizar bugs' })).toBeDisabled()
  })
})
