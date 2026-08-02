import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { makeBug, makeComment } from '../../../components/_storyFixtures'
import AppTopbar from '../../../components/AppTopbar'
import BugsScreen from './BugsScreen'

const matias = { id: 'perfil-1', displayName: 'Matias Pinho' }
const lucia = { id: 'perfil-2', displayName: 'Lucía Gómez' }

const results = [
  {
    ...makeBug({
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
    assignees: [matias],
    dueDate: '2026-07-31',
  },
  {
    ...makeBug({
      id: '30',
      title: 'El link de recuperar contraseña vence antes de tiempo',
      summary: 'Caduca a los 2 minutos en lugar de 30.',
      screen: '/auth/login',
      reporter: 'Lucía Gómez',
      confidence: 0.71,
    }),
    dueDate: '2026-08-08',
  },
  {
    ...makeBug({
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
    assignees: [lucia, matias],
  },
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

const longAgentBase = makeBug({
  id: '48',
  title: 'Hay que scrollear muchísimo para llegar a los comentarios',
  summary:
    'La conversación del equipo queda oculta debajo del reporte, el aporte del agente y su historial.',
  status: 'en_progreso',
  observed:
    'Para comentar hay que recorrer todo el reporte reescrito y cada bloque generado por el agente externo.',
  expected: 'El acceso a comentarios debería estar disponible desde el encabezado del bug.',
  steps: ['Abrir un bug con análisis externo.', 'Intentar llegar al hilo de comentarios.'],
})

const longAgentBug = {
  ...longAgentBase,
  comments: [
    makeComment({
      id: 'comment-48',
      body: 'El salto debería conservar el contexto y llevar el foco al hilo.',
      authorName: 'Matias Pinho',
    }),
  ],
  analysis: {
    ...longAgentBase.analysis,
    externalAgent: {
      ok: true,
      output: [
        '## Resumen\nEl hilo queda después de varios bloques largos en la columna central.',
        '## Evidencia\nEl reporte reescrito, el aporte del agente y el historial comparten el mismo scroll.',
        '## Alcance revisado\nSe revisó la composición visual de la pantalla de Bugs y el orden de foco.',
        '## Recomendación\nAgregar un acceso directo que desplace y enfoque la única sección de comentarios.',
      ].join('\n\n'),
      command: 'codex exec',
      durationMs: 115000,
      createdAt: '2026-07-31T15:17:00.000Z',
    },
    externalAgentHistory: [
      {
        ok: true,
        output: 'Revisión anterior del mismo recorrido.',
        command: 'codex exec',
        durationMs: 84000,
        createdAt: '2026-07-30T14:15:00.000Z',
      },
    ],
  },
}

const emptyConversationBug = {
  ...longAgentBug,
  comments: [],
}

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
    <div className="app-shell">
      <BugsScreen
        results={results}
        topbar={<AppTopbar breadcrumb={['Bugs']} />}
        focusedKey={focusedKey}
        onFocus={setFocusedKey}
        onSetStatus={() => {}}
      />
    </div>
  )
}

export const ListaConPreview: Story = { render: () => <Interactive /> }
export const Tarjetas: Story = { render: () => <Interactive /> }
export const NavegacionCompacta: Story = {
  render: () => <Interactive />,
  parameters: {
    viewport: { defaultViewport: 'mobile2' },
  },
}

export const ConAporteExtenso: Story = {
  render: () => (
    <div className="app-shell">
      <BugsScreen
        results={[longAgentBug]}
        topbar={<AppTopbar breadcrumb={['Bugs', longAgentBug.enriched.raw.title]} />}
        onSetStatus={() => {}}
        onAddComment={async (_bug, body, parentId) =>
          makeComment({ id: 'story-comment', body, parentId })
        }
      />
    </div>
  ),
}

export const ConversacionVacia: Story = {
  render: () => (
    <div className="app-shell">
      <BugsScreen
        results={[emptyConversationBug]}
        topbar={<AppTopbar breadcrumb={['Bugs', emptyConversationBug.enriched.raw.title]} />}
        onSetStatus={() => {}}
        onAddComment={async (_bug, body, parentId) =>
          makeComment({ id: 'story-comment', body, parentId })
        }
      />
    </div>
  ),
}

export const SinResultados: Story = {
  render: () => (
    <div className="app-shell">
      <BugsScreen results={[]} topbar={<AppTopbar breadcrumb={['Bugs']} />} />
    </div>
  ),
}
