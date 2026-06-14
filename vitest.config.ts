import * as path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Config dedicada de tests (la de Vite tiene root:'renderer', que dejaría src/
// fuera). Acá el root es la raíz del proyecto, así resuelve src/ y renderer/.
// Nota: los tests unitarios corren con jsdom, independientes de Storybook.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@renderer': path.resolve(__dirname, 'renderer'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'renderer/**/*.test.{ts,tsx}'],
  },
})
