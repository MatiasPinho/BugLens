// NewProjectModal.tsx
//
// Creación de un proyecto del equipo. El slug se deriva del nombre pero queda
// editable (tiene que ser único en Supabase). Lo usan el selector del sidebar y
// la pantalla de Proyectos.

import { useState } from 'react'
import { ActionModal } from '../../../components/ActionModal'
import { LoadingInline } from '../../../components/Loading'
import { col } from '../../../theme'

export function slugifyProjectName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface Props {
  open: boolean
  busy?: boolean
  onClose: () => void
  onCreate: (name: string, slug: string) => void
}

export default function NewProjectModal({ open, busy = false, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const canCreate = name.trim().length > 0 && !busy

  const updateName = (value: string) => {
    setName(value)
    setSlug(slugifyProjectName(value))
  }

  const submit = () => {
    if (!canCreate) return
    onCreate(name.trim(), slugifyProjectName(slug || name))
    setName('')
    setSlug('')
    onClose()
  }

  return (
    <ActionModal
      open={open}
      title="nuevo proyecto"
      description="Creá un espacio separado para bugs, estados y análisis."
      onClose={onClose}
    >
      <div className="grid gap-3.5">
        <div>
          <label className="label" htmlFor="new-project-name">
            Nombre
          </label>
          <input
            id="new-project-name"
            type="text"
            className="input"
            value={name}
            onChange={(event) => updateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
              if (event.key === 'Escape') onClose()
            }}
            placeholder="cliente / producto"
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="label mb-0" htmlFor="new-project-slug">
              Slug
            </label>
            <span className="text-2xs" style={{ color: col.fgDim }}>
              único
            </span>
          </div>
          <input
            id="new-project-slug"
            type="text"
            className="input mono mt-1"
            value={slug}
            onChange={(event) => setSlug(slugifyProjectName(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
              if (event.key === 'Escape') onClose()
            }}
            placeholder="cliente-producto"
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={!canCreate}>
            {busy ? <LoadingInline label="creando" /> : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </ActionModal>
  )
}
