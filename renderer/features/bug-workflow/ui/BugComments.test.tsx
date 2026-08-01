import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeBug, makeComment } from '../../../components/_storyFixtures'
import BugComments from './BugComments'

const bug = makeBug({ id: 'a', title: 'Login roto' })

const hilo = [
  makeComment({
    id: 'c1',
    body: 'Reproducido en producción.',
    authorName: 'Lucía Gómez',
    createdAt: '2026-03-10T12:00:00.000Z',
    upvotes: 2,
  }),
  makeComment({
    id: 'c2',
    parentId: 'c1',
    body: 'Lo miro esta tarde.',
    authorName: 'Matias Pinho',
    createdAt: '2026-03-10T13:00:00.000Z',
  }),
]

describe('BugComments', () => {
  it('anida las respuestas bajo su comentario padre', () => {
    render(<BugComments bug={bug} comments={hilo} />)

    const raiz = screen.getByText('Reproducido en producción.').closest('li')
    expect(raiz).not.toBeNull()
    // La respuesta vive dentro del <li> de la raíz, no como hermana.
    expect(within(raiz as HTMLElement).getByText('Lo miro esta tarde.')).toBeInTheDocument()
  })

  it('cuenta el hilo completo, no solo las raíces', () => {
    render(<BugComments bug={bug} comments={hilo} />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('prioriza el hilo existente y expande el compositor al pedirlo', async () => {
    render(<BugComments bug={bug} comments={hilo} onAddComment={vi.fn()} />)

    expect(screen.queryByLabelText('Escribí un comentario')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Escribir un comentario' }))
    expect(screen.getByLabelText('Escribí un comentario')).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Escribí un comentario')).not.toBeInTheDocument()
  })

  it('integra el estado vacío en el compositor cuando se puede comentar', () => {
    render(<BugComments bug={bug} comments={[]} onAddComment={vi.fn()} />)

    expect(screen.getByText('Iniciá la conversación')).toBeInTheDocument()
    expect(screen.getByLabelText('Escribí un comentario')).toBeInTheDocument()
    expect(screen.queryByText('Todavía no hay comentarios.')).not.toBeInTheDocument()
  })

  it('muestra un vacío informativo cuando no se puede comentar', () => {
    render(<BugComments bug={bug} comments={[]} />)

    expect(screen.getByText('Todavía no hay comentarios.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('envía un comentario raíz sin padre', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined)
    render(<BugComments bug={bug} comments={[]} onAddComment={onAddComment} />)

    await userEvent.type(screen.getByLabelText('Escribí un comentario'), 'una nota')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(onAddComment).toHaveBeenCalledWith('una nota', null)
  })

  it('responder manda el id del comentario padre', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined)
    render(<BugComments bug={bug} comments={hilo} onAddComment={onAddComment} />)

    await userEvent.click(screen.getAllByRole('button', { name: 'Responder' })[0])
    await userEvent.type(screen.getByLabelText(/Respuesta para Lucía Gómez/), 'listo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(onAddComment).toHaveBeenCalledWith('listo', 'c1')
  })

  it('no envía un comentario vacío', async () => {
    const onAddComment = vi.fn()
    render(<BugComments bug={bug} comments={[]} onAddComment={onAddComment} />)

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Escribí un comentario'), '   ')
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    expect(onAddComment).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor sin perder lo escrito', async () => {
    const onAddComment = vi.fn().mockRejectedValue(new Error('No tenés permisos.'))
    render(<BugComments bug={bug} comments={[]} onAddComment={onAddComment} />)

    const campo = screen.getByLabelText('Escribí un comentario')
    await userEvent.type(campo, 'una nota')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No tenés permisos.')
    // Si se limpiara, el usuario perdería lo que escribió por un error del servidor.
    expect(campo).toHaveValue('una nota')
  })

  it('descarta el borrador al cambiar de bug', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<BugComments bug={bug} comments={[]} onAddComment={onAddComment} />)

    await userEvent.type(screen.getByLabelText('Escribí un comentario'), 'nota del login')
    rerender(
      <BugComments
        bug={makeBug({ id: 'b', title: 'Checkout roto' })}
        comments={[]}
        onAddComment={onAddComment}
      />,
    )

    expect(screen.getByLabelText('Escribí un comentario')).toHaveValue('')
  })

  it('conserva el borrador raíz mientras se responde dentro del hilo', async () => {
    render(<BugComments bug={bug} comments={hilo} onAddComment={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Escribir un comentario' }))
    const rootComposer = screen.getByLabelText('Escribí un comentario')
    await userEvent.type(rootComposer, 'nota general')
    await userEvent.click(screen.getAllByRole('button', { name: 'Responder' })[0])
    expect(rootComposer).not.toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(rootComposer).toBeVisible()
    expect(rootComposer).toHaveValue('nota general')
  })

  it('limita la sangría visual después del tercer nivel', () => {
    const comments = Array.from({ length: 5 }, (_, index) =>
      makeComment({
        id: `depth-${index}`,
        parentId: index === 0 ? null : `depth-${index - 1}`,
        body: `Nivel ${index + 1}`,
      }),
    )
    render(<BugComments bug={bug} comments={comments} />)

    expect(screen.getByText('Nivel 4').closest('li')).toHaveClass('comment-item-indented')
    expect(screen.getByText('Nivel 5').closest('li')).not.toHaveClass('comment-item-indented')
  })

  it('votar avisa con el comentario y el valor', async () => {
    const onVote = vi.fn()
    render(<BugComments bug={bug} comments={hilo} onVote={onVote} />)

    await userEvent.click(screen.getAllByRole('button', { name: /a favor/ })[0])

    expect(onVote).toHaveBeenCalledWith('c1', 1)
  })

  it('el voto propio se marca como presionado', () => {
    render(
      <BugComments
        bug={bug}
        comments={[makeComment({ id: 'c1', body: 'x', myVote: -1, downvotes: 1 })]}
        onVote={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /en contra/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /a favor/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('permite ocultar y volver a mostrar las respuestas', async () => {
    render(<BugComments bug={bug} comments={hilo} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar 1 respuesta' }))
    expect(screen.queryByText('Lo miro esta tarde.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Mostrar 1 respuesta/ }))
    expect(screen.getByText('Lo miro esta tarde.')).toBeInTheDocument()
  })
})
