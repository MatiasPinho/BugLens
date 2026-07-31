import type { Meta, StoryObj } from '@storybook/react-vite'
import CollapsibleBlock from './CollapsibleBlock'

const meta = {
  title: 'buglens/CollapsibleBlock',
  component: CollapsibleBlock,
  decorators: [
    (Story) => (
      <div style={{ padding: 24, maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CollapsibleBlock>
export default meta

const parrafo =
  'El formulario no cumple con las reglas de validación establecidas. Los campos ' +
  "'organismo registrante', 'numero de registro' y 'numero de serie' no cumplen con los " +
  'requisitos de longitud máxima, mientras que el campo indice de cotización permite la ' +
  'entrada de caracteres no numéricos. '

/** Contenido largo: se recorta con un degradado y aparece "Ver todo". */
export const Largo: StoryObj = {
  render: () => (
    <CollapsibleBlock label="el reporte">
      <div className="grid gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <p key={index} className="text-sm">
            {parrafo}
          </p>
        ))}
      </div>
    </CollapsibleBlock>
  ),
}

/**
 * Contenido corto: no aparece ningún control. Un botón que esconde diez píxeles
 * molesta más de lo que ayuda.
 */
export const Corto: StoryObj = {
  render: () => (
    <CollapsibleBlock label="el reporte">
      <p className="text-sm">{parrafo}</p>
    </CollapsibleBlock>
  ),
}

/** Deshabilitado: mientras llega salida en vivo no se pliega. */
export const SiempreEntero: StoryObj = {
  render: () => (
    <CollapsibleBlock label="el aporte del agente" disabled>
      <div className="grid gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <p key={index} className="text-sm">
            {parrafo}
          </p>
        ))}
      </div>
    </CollapsibleBlock>
  ),
}
