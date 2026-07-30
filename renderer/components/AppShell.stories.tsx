import type { Meta, StoryObj } from '@storybook/react-vite'
import BugsScreen from '../features/bug-workflow/ui/BugsScreen'
import { makeBug } from './_storyFixtures'
import ProjectSwitcher from '../features/projects/ui/ProjectSwitcher'
import AppRail, { type AppRailItem } from './AppRail'
import AppTopbar from './AppTopbar'
import { IconBug, IconFolder, IconSettings, IconUpload } from './icons'

type PreviewRoute = 'bugs' | 'upload' | 'projects' | 'settings'

const previewBugs = [
  makeBug({
    id: '12',
    title: 'Login queda cargando con credenciales válidas',
    summary:
      'Al enviar credenciales válidas queda el spinner infinito y nunca navega al dashboard.',
    severity: 'critical',
    status: 'en_progreso',
    screen: '/auth/login',
    environment: 'prod',
    confidence: 0.88,
    missing: ['el mensaje exacto de la consola', 'si pasa también en Chrome'],
  }),
  makeBug({
    id: '8',
    title: 'El formulario acepta valores inválidos',
    summary: 'El número de serie supera el máximo y el error no se muestra.',
    severity: 'high',
    category: 'backend',
    screen: '/registro/armas',
    reporter: 'Juan Pérez',
    confidence: 0.74,
  }),
  makeBug({
    id: '30',
    title: 'El link de recuperar contraseña vence antes de tiempo',
    summary: 'Caduca a los 2 minutos en lugar de 30.',
    screen: '/auth/login',
    confidence: 0.71,
  }),
  makeBug({
    id: '4',
    title: 'El mail de confirmación llega sin el logo',
    summary: 'La imagen del encabezado queda rota en algunos clientes.',
    severity: 'low',
    status: 'solucionado',
    category: 'config',
    screen: '/mails/confirmacion',
  }),
]

const navItems: AppRailItem<PreviewRoute>[] = [
  { key: 'bugs', label: 'Bugs', count: previewBugs.length, icon: <IconBug size={18} /> },
  { key: 'upload', label: 'Cargar bugs', icon: <IconUpload size={18} /> },
  { key: 'projects', label: 'Proyectos', count: 2, icon: <IconFolder size={18} /> },
]

const railFooterItems: AppRailItem<PreviewRoute>[] = [
  { key: 'settings', label: 'Configuración', icon: <IconSettings size={18} /> },
]

const previewProjects = [
  { id: 'project-finn', name: 'Finn App', slug: 'finn-app' },
  { id: 'project-cliente', name: 'Cliente', slug: 'cliente' },
]

function AppShellPreview() {

  return (
    <div className="app-shell">
      <AppRail
        items={navItems}
        footerItems={railFooterItems}
        active="bugs"
        onSelect={() => {}}
      />

      <div className="app-content">
        <AppTopbar
          breadcrumb={['Bugs']}
          projectSlot={
            <ProjectSwitcher
              activeProject={previewProjects[0]}
              projects={previewProjects}
              onSelect={() => {}}
              onCreate={() => {}}
            />
          }
          statusSlot={
            <span className="badge badge-accent" role="status">
              <span className="dot" aria-hidden="true" />
              Ollama local
            </span>
          }
          user={{ id: 'perfil-matias', email: 'matias@estudio.com', provider: 'Google Auth' }}
          onSignOut={() => {}}
        />

        <main className="app-main min-h-0 flex-1 overflow-hidden">
          <BugsScreen
            results={previewBugs}
            onSetStatus={() => {}}
          />
        </main>
      </div>
    </div>
  )
}

const meta = {
  title: 'buglens/AppShell',
  component: AppShellPreview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShellPreview>

export default meta
type Story = StoryObj<typeof AppShellPreview>

export const Default: Story = {}
