import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AppRail, { type AppRailItem } from './AppRail'

type Route = 'bugs' | 'upload' | 'settings'

const items: AppRailItem<Route>[] = [
  { key: 'bugs', label: 'Bugs', count: 12, icon: <svg role="img" aria-label="bugs" /> },
  { key: 'upload', label: 'Cargar bugs', icon: <svg role="img" aria-label="cargar" /> },
]

const footerItems: AppRailItem<Route>[] = [
  { key: 'settings', label: 'Configuración', icon: <svg role="img" aria-label="config" /> },
]

function renderRail(active: Route = 'bugs', onSelect = vi.fn()) {
  render(<AppRail items={items} footerItems={footerItems} active={active} onSelect={onSelect} />)
  return onSelect
}

describe('AppRail', () => {
  it('nombra cada destino aunque no muestre texto', () => {
    renderRail()

    // Sin label accesible el rail sería una fila de iconos mudos.
    expect(screen.getByRole('button', { name: 'Bugs (12)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargar bugs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configuración' })).toBeInTheDocument()
  })

  it('incluye el contador en el label en vez de dejarlo como número suelto', () => {
    renderRail()

    const bugs = screen.getByRole('button', { name: 'Bugs (12)' })
    expect(bugs).toHaveAttribute('title', 'Bugs (12)')
  })

  it('marca el destino actual con aria-current', () => {
    renderRail('upload')

    expect(screen.getByRole('button', { name: 'Cargar bugs' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Bugs (12)' })).not.toHaveAttribute('aria-current')
  })

  it('navega al destino elegido, también desde el grupo del pie', async () => {
    const onSelect = renderRail()

    await userEvent.click(screen.getByRole('button', { name: 'Cargar bugs' }))
    expect(onSelect).toHaveBeenCalledWith('upload')

    await userEvent.click(screen.getByRole('button', { name: 'Configuración' }))
    expect(onSelect).toHaveBeenCalledWith('settings')
  })

  it('no muestra contador cuando es cero o no está definido', () => {
    render(
      <AppRail
        items={[
          { key: 'bugs', label: 'Bugs', count: 0, icon: <svg role="img" aria-label="bugs" /> },
        ]}
        active="bugs"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Bugs' })).toBeInTheDocument()
  })
})
