import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MenuButton, { MenuItem } from './MenuButton'

function renderMenu(onPick = vi.fn()) {
  render(
    <MenuButton trigger={<span>⋮</span>} label="más acciones">
      {(close) => (
        <MenuItem
          onClick={() => {
            close()
            onPick()
          }}
        >
          Borrar
        </MenuItem>
      )}
    </MenuButton>,
  )
  return onPick
}

describe('MenuButton', () => {
  it('arranca cerrado y el disparador se anuncia como menú', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'más acciones' })

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('abre y cierra con el disparador', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'más acciones' })

    await userEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('ejecuta la acción y cierra el menú', async () => {
    const onPick = renderMenu()

    await userEvent.click(screen.getByRole('button', { name: 'más acciones' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Escape cierra el menú y devuelve el foco al disparador', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'más acciones' })
    await userEvent.click(trigger)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    // Sin esto el foco se perdería al final del documento.
    expect(trigger).toHaveFocus()
  })

  it('un click afuera cierra el menú', async () => {
    render(
      <div>
        <span>afuera</span>
        <MenuButton trigger={<span>⋮</span>} label="más acciones">
          {() => <MenuItem onClick={vi.fn()}>Borrar</MenuItem>}
        </MenuButton>
      </div>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'más acciones' }))
    await userEvent.click(screen.getByText('afuera'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
