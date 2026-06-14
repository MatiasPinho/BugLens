import '@testing-library/jest-dom/vitest'

// jsdom no implementa scrollIntoView — BugTable lo llama en la fila enfocada.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
