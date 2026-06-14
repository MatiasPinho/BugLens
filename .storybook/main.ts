import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  // Nuestros componentes viven en renderer/.
  stories: ['../renderer/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  viteFinal: async (cfg) => {
    // El vite.config del proyecto usa root:'renderer'; Storybook necesita el
    // root del proyecto para resolver sus propios archivos.
    cfg.root = process.cwd()
    return cfg
  },
}

export default config
