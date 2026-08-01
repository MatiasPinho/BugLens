import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BugLensMark } from './BugMotifs'

describe('BugLensMark', () => {
  it('mantiene la marca decorativa y simplifica el dibujo en tamaños compactos', () => {
    const { container, rerender } = render(<BugLensMark compact />)
    const compactMark = container.querySelector('svg')

    expect(compactMark).toHaveAttribute('aria-hidden', 'true')
    expect(compactMark?.querySelectorAll('path')).toHaveLength(3)

    rerender(<BugLensMark />)

    expect(container.querySelector('svg')?.querySelectorAll('path')).toHaveLength(4)
  })
})
