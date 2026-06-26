import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ActionModal, ConfirmActionModal } from './ActionModal'

const meta = {
  title: 'buglens/ActionModal',
  component: ActionModal,
} satisfies Meta<typeof ActionModal>

export default meta

type Story = StoryObj

export const DangerConfirm: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <>
        <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
          borrar bug
        </button>
        <ConfirmActionModal
          open={open}
          title="borrar bug"
          description='Se ocultará "informacion laboral" del proyecto compartido.'
          confirmLabel="borrar bug"
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    )
  },
}

export const ProjectForm: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          nuevo proyecto
        </button>
        <ActionModal
          open={open}
          title="nuevo proyecto"
          description="Creá un espacio separado para bugs, estados y análisis."
          onClose={() => setOpen(false)}
        >
          <div className="space-y-3">
            <label className="block">
              <span className="label">nombre</span>
              <input className="input mt-1 w-full" defaultValue="cliente mobile" />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                cancelar
              </button>
              <button type="button" className="btn-primary" onClick={() => setOpen(false)}>
                crear
              </button>
            </div>
          </div>
        </ActionModal>
      </>
    )
  },
}
