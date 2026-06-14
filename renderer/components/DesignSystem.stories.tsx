import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import {
  ConfidenceBar,
  CopyButton,
  categoryStyle,
  OmBadge,
  SectionCard,
  SeverityDot,
  severityStyle,
  statusStyle,
} from './BugTable'

// Kitchen-sink del design system: badges (con las paletas reales del código) +
// los átomos. Documentación viva de los tokens visuales.
const meta: Meta = { title: 'buglens/DesignSystem' }
export default meta
type Story = StoryObj

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#5d6367',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export const Badges: Story = {
  render: () => (
    <div>
      <Row label="severidad">
        {Object.entries(severityStyle).map(([s, st]) => (
          <OmBadge key={s} style={st}>
            {s}
          </OmBadge>
        ))}
      </Row>
      <Row label="categoría">
        {Object.entries(categoryStyle).map(([c, st]) => (
          <OmBadge key={c} style={st}>
            {c}
          </OmBadge>
        ))}
      </Row>
      <Row label="estado">
        {Object.entries(statusStyle).map(([s, st]) => (
          <OmBadge key={s} style={st}>
            {st.label}
          </OmBadge>
        ))}
      </Row>
    </div>
  ),
}

export const Atomos: Story = {
  render: () => (
    <div style={{ maxWidth: 440 }}>
      <Row label="severity dots">
        <SeverityDot count={3} color="#de6145" />
        <SeverityDot count={5} color="#c9a07a" />
        <SeverityDot count={2} color="#9fa5a9" />
      </Row>
      <Row label="confidence bar">
        <div style={{ width: 160 }}>
          <ConfidenceBar value={0.9} />
        </div>
        <div style={{ width: 160 }}>
          <ConfidenceBar value={0.45} />
        </div>
      </Row>
      <Row label="copy button">
        <CopyButton text="texto a copiar" />
      </Row>
      <div style={{ marginTop: 4 }}>
        <SectionCard title="section card">
          <p style={{ color: '#9fa5a9', fontSize: 13, margin: 0 }}>
            Contenido de ejemplo dentro de una SectionCard.
          </p>
        </SectionCard>
      </div>
    </div>
  ),
}
