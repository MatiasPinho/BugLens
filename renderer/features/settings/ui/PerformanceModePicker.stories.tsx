import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import PerformanceModePicker, { type PerformanceMode } from './PerformanceModePicker'

// Usa window.electronAPI.probeHardware (mockeado en .storybook/preview.tsx).
const meta = {
  title: 'buglens/PerformanceModePicker',
  component: PerformanceModePicker,
} satisfies Meta<typeof PerformanceModePicker>
export default meta
type Story = StoryObj<typeof PerformanceModePicker>

export const Default: Story = {
  render: () => {
    const [mode, setMode] = useState<PerformanceMode>('gpu')
    return (
      <div style={{ maxWidth: 480 }}>
        <PerformanceModePicker value={mode} onChange={setMode} />
      </div>
    )
  },
}
