import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import AppRail, { type AppRailItem } from './AppRail'
import { IconBug, IconFolder, IconHelp, IconSettings, IconUpload } from './icons'

type Route = 'bugs' | 'upload' | 'projects' | 'settings'

const meta = {
  title: 'buglens/shell/AppRail',
  component: AppRail,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppRail>
export default meta

const items: AppRailItem<Route>[] = [
  { key: 'bugs', label: 'Bugs', count: 26, icon: <IconBug size={18} /> },
  { key: 'upload', label: 'Cargar bugs', icon: <IconUpload size={18} /> },
  { key: 'projects', label: 'Proyectos', count: 7, icon: <IconFolder size={18} /> },
]

const footerItems: AppRailItem<Route>[] = [
  { key: 'settings', label: 'Configuración', icon: <IconSettings size={18} /> },
]

function Rail({ initial }: { initial: Route }) {
  const [active, setActive] = useState<Route>(initial)
  return (
    <div className="app-shell" style={{ height: '100vh' }}>
      <AppRail
        items={items}
        footerItems={footerItems}
        active={active}
        onSelect={setActive}
        actions={
          <button type="button" className="app-rail-item" title="atajos" aria-label="atajos">
            <IconHelp size={18} />
          </button>
        }
      />
    </div>
  )
}

export const Default: StoryObj = { render: () => <Rail initial="bugs" /> }

/** El destino activo no depende solo del color: suma una barra al borde del rail. */
export const EnConfiguracion: StoryObj = { render: () => <Rail initial="settings" /> }

/** Sin contadores: los badges solo aparecen cuando hay algo que contar. */
export const SinContadores: StoryObj = {
  render: () => (
    <div className="app-shell" style={{ height: '100vh' }}>
      <AppRail
        items={items.map(({ count: _count, ...item }) => item)}
        footerItems={footerItems}
        active="bugs"
        onSelect={() => {}}
      />
    </div>
  ),
}
