import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconMore, IconTrash } from './icons'
import MenuButton, { MenuItem } from './MenuButton'

const meta = {
  title: 'buglens/MenuButton',
  component: MenuButton,
} satisfies Meta<typeof MenuButton>
export default meta

/**
 * Lo destructivo va detrás del menú: "Borrar" no tiene por qué competir con la
 * acción de trabajo de la pantalla.
 */
export const AccionesDeBug: StoryObj = {
  render: () => (
    <div style={{ padding: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button type="button" className="btn-primary">
        Analizar con agente
      </button>
      <MenuButton trigger={<IconMore size={16} />} label="más acciones del bug">
        {(close) => (
          <MenuItem danger onClick={close}>
            <IconTrash size={12} />
            Borrar bug
          </MenuItem>
        )}
      </MenuButton>
    </div>
  ),
}

/** Alineado al inicio, para disparadores que viven a la izquierda. */
export const AlineadoAlInicio: StoryObj = {
  render: () => (
    <div style={{ padding: 24 }}>
      <MenuButton trigger={<IconMore size={16} />} label="acciones" align="start">
        {(close) => (
          <>
            <MenuItem onClick={close}>Duplicar</MenuItem>
            <MenuItem onClick={close}>Exportar</MenuItem>
            <MenuItem danger onClick={close}>
              Borrar
            </MenuItem>
          </>
        )}
      </MenuButton>
    </div>
  ),
}
