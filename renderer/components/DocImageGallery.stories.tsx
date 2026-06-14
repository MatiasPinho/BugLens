import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DocImage } from '../../src/types/index'
import { DocImageGallery } from './BugTable'

// Captura "mock" como SVG en base64 (sin assets binarios). btoa requiere ASCII,
// así que las etiquetas van sin acentos.
const shot = (label: string, bg: string): DocImage => ({
  mimeType: 'image/svg+xml',
  alt: label,
  data: btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>` +
      `<rect width='320' height='200' fill='${bg}'/>` +
      `<rect x='12' y='12' width='296' height='26' fill='#1c2124'/>` +
      `<text x='20' y='30' fill='#cacccc' font-family='monospace' font-size='13'>${label}</text>` +
      `<rect x='12' y='52' width='180' height='14' rx='3' fill='#343d41'/>` +
      `<rect x='12' y='74' width='250' height='14' rx='3' fill='#343d41'/>` +
      `<rect x='12' y='150' width='90' height='28' rx='4' fill='#2a6cc4'/>` +
      `<text x='30' y='169' fill='#fff' font-family='monospace' font-size='12'>Guardar</text>` +
      `</svg>`,
  ),
})

const images: DocImage[] = [
  shot('Captura 1 - formulario', '#101315'),
  shot('Captura 2 - error', '#13100f'),
  shot('Captura 3 - modal', '#0f1310'),
]

const meta = {
  title: 'buglens/DocImageGallery',
  component: DocImageGallery,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DocImageGallery>
export default meta
type Story = StoryObj<typeof DocImageGallery>

// Click en una miniatura abre el lightbox.
export const Varias: Story = { args: { images } }
export const Una: Story = { args: { images: [images[0]] } }
