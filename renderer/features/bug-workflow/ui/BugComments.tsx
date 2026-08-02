/**
 * BugComments.tsx
 *
 * Hilo de comentarios del bug: composer, respuestas anidadas y voto.
 *
 * El árbol lo arma `buildCommentThread` (lógica pura) a partir de la lista plana
 * que devuelve el servidor. Acá solo se renderiza y se disparan los callbacks.
 */

import { forwardRef, useEffect, useMemo, useState } from 'react'
import type { AnalyzedBug, BugComment, CommentVote } from '../../../../src/shared/contracts'
import { avatarToneClass, initialsOf } from '../../../components/avatarTone'
import { IconComment } from '../../../components/icons'
import { col } from '../../../theme'
import { buildCommentThread, type CommentNode, countThread } from './bugActivity'
import { formatTimelineDate } from './bugPresentation'

/** Más allá de este nivel el sangrado deja sin ancho al texto. */
const MAX_INDENT_DEPTH = 3

interface Props {
  bug: AnalyzedBug
  comments: BugComment[]
  onAddComment?: (body: string, parentId: string | null) => Promise<void>
  onVote?: (commentId: string, value: CommentVote) => void
}

const BugComments = forwardRef<HTMLElement, Props>(function BugComments(
  { bug, comments, onAddComment, onVote },
  ref,
) {
  const thread = useMemo(() => buildCommentThread(comments), [comments])
  const total = countThread(thread)
  const [replyTo, setReplyTo] = useState<string | null>(null)

  return (
    <section ref={ref} className="bug-comments" aria-label="comentarios" tabIndex={-1}>
      <header className="bug-comments-head">
        <h3 className="section-card-title">
          <IconComment size={16} />
          Comentarios
          {total > 0 && <span className="count-chip">{total}</span>}
        </h3>
        <span className="bug-comments-context">Conversación del equipo</span>
      </header>

      {onAddComment && (
        <div hidden={replyTo !== null}>
          <RootCommentComposer
            key={`root-${bug.enriched.raw.id}`}
            hasComments={total > 0}
            onSubmit={(body) => onAddComment(body, null)}
          />
        </div>
      )}

      {thread.length === 0 ? (
        !onAddComment && (
          <div className="comment-empty">
            <span className="comment-conversation-mark" aria-hidden="true">
              <IconComment size={20} />
            </span>
            <div className="grid gap-0.5">
              <p className="font-semibold text-sm">Todavía no hay comentarios.</p>
              <p className="text-xs" style={{ color: col.fgDim }}>
                La conversación aparecerá acá cuando el equipo agregue contexto.
              </p>
            </div>
          </div>
        )
      ) : (
        <ol className="comment-thread">
          {thread.map((node) => (
            <CommentBranch
              key={node.id}
              node={node}
              replyTo={replyTo}
              onReplyTo={setReplyTo}
              onAddComment={onAddComment}
              onVote={onVote}
            />
          ))}
        </ol>
      )}
    </section>
  )
})

export default BugComments

function RootCommentComposer({
  hasComments,
  onSubmit,
}: {
  hasComments: boolean
  onSubmit: (body: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(!hasComments)

  useEffect(() => {
    if (hasComments) setExpanded(false)
  }, [hasComments])

  if (!expanded) {
    return (
      <button
        type="button"
        className="comment-composer-trigger"
        aria-label="Escribir un comentario"
        onClick={() => setExpanded(true)}
      >
        <IconComment size={16} />
        <span>Sumá contexto, una decisión o un avance…</span>
        <span className="comment-composer-trigger-action">Escribir</span>
      </button>
    )
  }

  return (
    <CommentComposer
      label="Escribí un comentario"
      placeholder="Sumá contexto, una decisión o un avance…"
      intro={
        hasComments
          ? undefined
          : {
              title: 'Iniciá la conversación',
              description: 'Dejá un registro útil para quien retome este bug.',
            }
      }
      autoFocus={hasComments}
      onCancel={hasComments ? () => setExpanded(false) : undefined}
      onSubmit={async (body) => {
        await onSubmit(body)
        if (hasComments) setExpanded(false)
      }}
    />
  )
}

function CommentBranch({
  node,
  replyTo,
  onReplyTo,
  onAddComment,
  onVote,
}: {
  node: CommentNode
  replyTo: string | null
  onReplyTo: (id: string | null) => void
  onAddComment?: (body: string, parentId: string | null) => Promise<void>
  onVote?: (commentId: string, value: CommentVote) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const author = node.authorName ?? node.authorEmail ?? 'alguien'
  const replyCount = countThread(node.replies)

  return (
    <li
      className={
        node.depth > 0 && node.depth <= MAX_INDENT_DEPTH
          ? 'comment-item comment-item-indented'
          : 'comment-item'
      }
    >
      <div className="comment-body">
        <span
          className={`avatar avatar-md ${avatarToneClass(node.authorId ?? node.authorEmail)}`}
          aria-hidden="true"
        >
          {initialsOf(author)}
        </span>

        <div className="comment-copy">
          <div className="comment-head">
            <span className="comment-author">{author}</span>
            <time className="comment-time mono" dateTime={node.createdAt}>
              {formatTimelineDate(node.createdAt)}
            </time>
          </div>

          <p className="comment-text">{node.body}</p>

          <div className="comment-actions">
            {onVote && (
              <>
                <VoteButton
                  label="a favor"
                  count={node.upvotes}
                  active={node.myVote === 1}
                  tone="up"
                  onClick={() => onVote(node.id, 1)}
                />
                <VoteButton
                  label="en contra"
                  count={node.downvotes}
                  active={node.myVote === -1}
                  tone="down"
                  onClick={() => onVote(node.id, -1)}
                />
              </>
            )}

            {onAddComment && (
              <button
                type="button"
                className="btn-quiet btn-mini"
                onClick={() => onReplyTo(replyTo === node.id ? null : node.id)}
                aria-expanded={replyTo === node.id}
              >
                Responder
              </button>
            )}

            {replyCount > 0 && (
              <button
                type="button"
                className="btn-quiet btn-mini"
                onClick={() => setCollapsed((value) => !value)}
                aria-expanded={!collapsed}
              >
                {collapsed
                  ? `Mostrar ${replyCount} respuesta${replyCount === 1 ? '' : 's'}`
                  : `Ocultar ${replyCount} respuesta${replyCount === 1 ? '' : 's'}`}
              </button>
            )}
          </div>

          {replyTo === node.id && onAddComment && (
            <CommentComposer
              label={`Respuesta para ${author}`}
              placeholder={`Respondiendo a ${author}…`}
              autoFocus
              onCancel={() => onReplyTo(null)}
              onSubmit={async (body) => {
                await onAddComment(body, node.id)
                onReplyTo(null)
              }}
            />
          )}
        </div>
      </div>

      {!collapsed && node.replies.length > 0 && (
        <ol className="comment-replies">
          {node.replies.map((reply) => (
            <CommentBranch
              key={reply.id}
              node={reply}
              replyTo={replyTo}
              onReplyTo={onReplyTo}
              onAddComment={onAddComment}
              onVote={onVote}
            />
          ))}
        </ol>
      )}
    </li>
  )
}

function VoteButton({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  tone: 'up' | 'down'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`vote-button vote-button-${tone} ${active ? 'vote-button-on' : ''}`}
      aria-pressed={active}
      aria-label={`${label} (${count})`}
      onClick={onClick}
    >
      <span aria-hidden="true">{tone === 'up' ? '▲' : '▼'}</span>
      <span className="vote-count">{count}</span>
    </button>
  )
}

function CommentComposer({
  label,
  placeholder,
  intro,
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  label: string
  placeholder: string
  intro?: {
    title: string
    description: string
  }
  autoFocus?: boolean
  onSubmit: (body: string) => Promise<void>
  onCancel?: () => void
}) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = body.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={intro ? 'comment-composer comment-composer-featured' : 'comment-composer'}>
      {intro && (
        <div className="comment-composer-intro">
          <span className="comment-conversation-mark" aria-hidden="true">
            <IconComment size={20} />
          </span>
          <div className="comment-composer-copy">
            <p className="comment-composer-title">{intro.title}</p>
            <p className="comment-composer-description">{intro.description}</p>
          </div>
        </div>
      )}

      <textarea
        className="input comment-input"
        rows={3}
        value={body}
        placeholder={placeholder}
        aria-label={label}
        // El foco va al campo que el usuario acaba de abrir al tocar "Responder".
        // biome-ignore lint/a11y/noAutofocus: es respuesta a una acción explícita
        autoFocus={autoFocus}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            void submit()
          }
        }}
      />

      {error && (
        <span className="text-xs" style={{ color: col.critical }} role="alert">
          {error}
        </span>
      )}

      <div className="comment-composer-actions">
        <span className="text-2xs" style={{ color: col.fgDim }}>
          Ctrl+Enter para enviar
        </span>
        {onCancel && (
          <button type="button" className="btn-quiet btn-mini" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="btn-primary btn-mini"
          onClick={() => void submit()}
          disabled={!body.trim() || saving}
        >
          {saving ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
