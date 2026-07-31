import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyzedBug } from '../../../../src/shared/contracts'
import { makeBug } from '../../../components/_storyFixtures'
import BugPropertiesRail from './BugPropertiesRail'

const equipo = [
  { id: 'perfil-1', displayName: 'Lucía Gómez', email: 'lucia@estudio.com' },
  { id: 'perfil-2', email: 'matias@estudio.com' },
]

function conBug(over: Partial<AnalyzedBug> = {}): AnalyzedBug {
  return { ...makeBug({ id: 'a', title: 'Login roto', screen: '/auth/login' }), ...over }
}

describe('BugPropertiesRail', () => {
  it('dice que no hay responsables en vez de dejar el hueco vacío', () => {
    render(<BugPropertiesRail bug={conBug()} />)

    expect(screen.getByText('Sin asignar')).toBeInTheDocument()
  })

  it('lista los responsables asignados', () => {
    render(<BugPropertiesRail bug={conBug({ assignees: [equipo[0]] })} />)

    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument()
  })

  it('asignar manda el conjunto completo, no un delta', async () => {
    const onSetAssignees = vi.fn()
    render(
      <BugPropertiesRail
        bug={conBug({ assignees: [equipo[0]] })}
        members={equipo}
        onSetAssignees={onSetAssignees}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'cambiar responsables' }))
    await userEvent.click(screen.getByRole('button', { name: /matias@estudio.com/ }))

    // Dos clientes en paralelo convergen al mismo estado si se manda el conjunto.
    expect(onSetAssignees).toHaveBeenCalledWith(['perfil-1', 'perfil-2'])
  })

  it('desasignar saca a la persona del conjunto', async () => {
    const onSetAssignees = vi.fn()
    render(
      <BugPropertiesRail
        bug={conBug({ assignees: [equipo[0]] })}
        members={equipo}
        onSetAssignees={onSetAssignees}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'cambiar responsables' }))
    await userEvent.click(screen.getByRole('button', { name: /Lucía Gómez/ }))

    expect(onSetAssignees).toHaveBeenCalledWith([])
  })

  it('cambiar la fecha límite avisa al padre', async () => {
    const onSetDueDate = vi.fn()
    render(<BugPropertiesRail bug={conBug()} onSetDueDate={onSetDueDate} />)

    const campo = screen.getByLabelText('fecha límite')
    await userEvent.type(campo, '2026-06-12')

    expect(onSetDueDate).toHaveBeenCalledWith('2026-06-12')
  })

  it('permite quitar la fecha límite', async () => {
    const onSetDueDate = vi.fn()
    render(
      <BugPropertiesRail bug={conBug({ dueDate: '2026-06-12' })} onSetDueDate={onSetDueDate} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'quitar la fecha límite' }))

    expect(onSetDueDate).toHaveBeenCalledWith(null)
  })

  it('avisa cuando la fecha venció y el bug sigue abierto', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 20))
    render(<BugPropertiesRail bug={conBug({ dueDate: '2026-06-12', status: 'nuevo' })} />)

    expect(screen.getByRole('status')).toHaveTextContent(/Venció/)
    vi.useRealTimers()
  })

  it('no avisa de vencimiento si el bug ya está cerrado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 20))
    render(<BugPropertiesRail bug={conBug({ dueDate: '2026-06-12', status: 'solucionado' })} />)

    // Una fecha vencida en un bug resuelto no reclama nada.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('dice que no hay pantalla informada en vez de inventarla', () => {
    const bug = makeBug({ id: 'a', title: 'Sin pantalla' })
    bug.enriched.raw.rawRow = {}
    bug.analysis.affectedArea = ''
    render(<BugPropertiesRail bug={bug} />)

    expect(screen.getByText('Sin pantalla informada')).toBeInTheDocument()
  })

  it('muestra el feed de actividad con el actor', () => {
    render(
      <BugPropertiesRail
        bug={conBug({
          activity: [
            {
              id: 'e1',
              type: 'status_changed',
              fromStatus: 'nuevo',
              toStatus: 'en_progreso',
              createdAt: '2026-03-10T12:00:00.000Z',
              actorName: 'Lucía Gómez',
            },
          ],
        })}
      />,
    )

    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument()
    expect(screen.getByText(/pasó el bug de nuevo a en progreso/)).toBeInTheDocument()
  })

  it('avisa cuando no hay actividad todavía', () => {
    render(<BugPropertiesRail bug={conBug({ activity: [] })} />)

    expect(screen.getByText('Todavía no hay movimientos registrados.')).toBeInTheDocument()
  })
})
