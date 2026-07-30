import '@testing-library/jest-dom/vitest'

// jsdom no implementa scrollIntoView — BugsScreen lo usa para mantener visible el bug enfocado.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
