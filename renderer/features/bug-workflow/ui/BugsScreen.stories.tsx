import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { makeBug } from '../../../components/_storyFixtures'
import BugsScreen from './BugsScreen'

const results = [
  makeBug({
    id: '12',
    title: 'Login queda cargando con credenciales válidas',
    summary:
      'Al enviar credenciales válidas queda el spinner infinito y nunca navega al dashboard ni muestra el error.',
    severity: 'critical',
    status: 'en_progreso',
    screen: '/auth/login',
    reporter: 'Lucía Gómez',
    environment: 'prod',
    confidence: 0.88,
    missing: ['el mensaje exacto de la consola', 'si pasa también en Chrome'],
  }),
  makeBug({
    id: '30',
    title: 'El link de recuperar contraseña vence antes de tiempo',
    summary: 'Caduca a los 2 minutos en lugar de 30.',
    screen: '/auth/login',
    reporter: 'Lucía Gómez',
    confidence: 0.71,
  }),
  makeBug({
    id: '8',
    title: 'El formulario de armas acepta valores inválidos',
    summary:
      'Organismo registrante acepta menos de 5 caracteres, el número de serie permite más de 20 y el error no se muestra.',
    severity: 'high',
    category: 'backend',
    screen: '/registro/armas',
    reporter: 'Juan Pérez',
    confidence: 0.74,
    observed: '1. mínimo no validado\n2. máximo no validado\n3. error no visible',
  }),
  makeBug({
    id: '21',
    title: 'El total del reporte mensual no coincide con la base',
    summary:
      'El dashboard muestra 1.240 registros y la consulta directa devuelve 1.198 para el mismo rango.',
    category: 'database',
    screen: '/reportes/mensual',
    reporter: 'Sofía Castro',
    environment: 'staging',
    confidence: 0.62,
  }),
  makeBug({
    id: '4',
    title: 'El mail de confirmación llega sin el logo',
    summary: 'La imagen del encabezado queda rota en clientes que bloquean contenido remoto.',
    severity: 'low',
    status: 'solucionado',
    category: 'config',
    screen: '/mails/confirmacion',
    reporter: 'Juan Pérez',
  }),
  makeBug({
    id: '17',
    title: 'Algo del export no anda',
    summary: 'El reporte no indica qué botón, en qué pantalla ni el resultado esperado.',
    severity: 'high',
    status: 'no_replicado',
    category: 'otro',
    reporter: 'Lucía Gómez',
    confidence: 0.34,
    missing: ['la pantalla', 'el botón', 'el resultado esperado'],
  }),
]

const meta = {
  title: 'buglens/BugsScreen',
  component: BugsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BugsScreen>
export default meta
type Story = StoryObj<typeof BugsScreen>

function Interactive() {
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  return (
    <div style={{ height: '100vh' }}>
      <BugsScreen
        results={results}
        focusedKey={focusedKey}
        onFocus={setFocusedKey}
        onSetStatus={() => {}}
      />
    </div>
  )
}

export const ListaConPreview: Story = { render: () => <Interactive /> }
export const Tarjetas: Story = { render: () => <Interactive /> }

export const SinResultados: Story = {
  render: () => (
    <div style={{ height: '100vh' }}>
      <BugsScreen results={[]} />
    </div>
  ),
}
