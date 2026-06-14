import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeBug } from './_storyFixtures'
import { ExpandedDetail } from './BugTable'

const meta = {
  title: 'buglens/ExpandedDetail',
  component: ExpandedDetail,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ExpandedDetail>
export default meta
type Story = StoryObj<typeof ExpandedDetail>

// El output central: el reporte del QA reescrito claro y estructurado.
export const Default: Story = {
  args: {
    result: makeBug({
      id: 'b1',
      title: 'Login no responde',
      observed: 'al hacer click en "Entrar" no pasa nada; en la consola aparece un 500',
      expected: 'debería validar las credenciales y navegar al dashboard',
      steps: ['abrir /login', 'ingresar usuario y contraseña', 'click en Entrar'],
    }),
  },
}

// Un reporte que junta varios problemas → se separan numerados + badge.
export const MultiProblema: Story = {
  args: {
    result: makeBug({
      id: 'b2',
      title: 'Form armas',
      observed:
        '1. organismo registrante acepta menos de 5 caracteres\n2. número de serie permite más de 20\n3. no muestra el error en rojo',
      expected: '1. exigir mínimo 5\n2. limitar a 20\n3. mostrar el error de validación',
      steps: ['ir al form de armas', 'ingresar valores inválidos', 'guardar'],
      missing: ['el mensaje exacto del error'],
    }),
  },
}

// Reporte pobre: la app igual reescribe lo que hay y lista lo que falta.
export const ConFaltantes: Story = {
  args: {
    result: makeBug({
      id: 'b3',
      title: 'algo del export',
      observed: 'No informado',
      expected: 'No informado',
      steps: [],
      missing: ['qué botón', 'en qué pantalla', 'el resultado esperado', 'el ambiente'],
    }),
  },
}
