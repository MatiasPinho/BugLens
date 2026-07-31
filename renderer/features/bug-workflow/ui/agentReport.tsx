// agentReport.tsx
//
// Lectura de la salida del agente externo: parseo tolerante del texto libre que
// devuelve (markdown a medias, trazas operativas, TODOs) a bloques renderizables,
// más las tarjetas de progreso, acceso denegado y sugerencia de "ya resuelto".
//
// Igual que con el LLM de producto: nunca asumir formato perfecto — todo cae a un
// párrafo plano si no matchea.

// ─── Parseo del estado "resuelto" ────────────────────────────────────────────

export function parseResolvedSuggestion(output: string): { reason: string } | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => cleanAgentReportText(line))
    .filter(Boolean)
  const expectsStructuredStatus = lines.some((line) =>
    /^(?:#{1,6}\s*)?(coincide con el bug reportado|estado probable\s*:|hallazgos laterales)$/i.test(
      line,
    ),
  )

  const explicitLineIndex = lines.findIndex((line) => {
    const status = parseAgentResolvedStatusLine(line, expectsStructuredStatus)
    return status !== 'unknown'
  })
  if (explicitLineIndex >= 0) {
    if (
      parseAgentResolvedStatusLine(lines[explicitLineIndex], expectsStructuredStatus) !== 'resolved'
    ) {
      return null
    }
    const reasonLine = lines
      .slice(explicitLineIndex + 1, explicitLineIndex + 4)
      .find((line) => /^motivo\s*:/i.test(line))
    return { reason: reasonLine?.replace(/^motivo\s*:\s*/i, '').trim() ?? '' }
  }

  const clearPositive = lines.find(
    (line) =>
      !isNegatedResolvedLine(line) &&
      /\b(parece|probablemente|aparentemente)\s+(que\s+)?(ya\s+)?est[aá]\s+resuelto\b/i.test(line),
  )
  return clearPositive ? { reason: clearPositive } : null
}

function parseAgentResolvedStatusLine(
  line: string,
  expectsStructuredStatus: boolean,
): 'resolved' | 'not_resolved' | 'unknown' {
  const explicitResolved = line.match(/^parece resuelto\s*:\s*(.+)$/i)
  const explicitStatus = line.match(/^estado probable(?: del bug)?\s*:\s*(.+)$/i)
  if (expectsStructuredStatus && explicitResolved && !explicitStatus) return 'unknown'
  const value = normalizeAgentStatusValue(explicitResolved?.[1] ?? explicitStatus?.[1] ?? '')
  if (!value) return 'unknown'
  if (/\b(parcial|parcialmente|no determinable)\b/.test(value)) return 'not_resolved'
  if (/^(si|yes|true|resuelto)\b/.test(value)) return 'resolved'
  if (
    /^(no|false|parcial|parcialmente|no resuelto|no_resuelto|no determinable|no_determinable)\b/.test(
      value,
    )
  ) {
    return 'not_resolved'
  }
  return 'unknown'
}

function normalizeAgentStatusValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim()
}

function isNegatedResolvedLine(line: string): boolean {
  const normalizedLine = normalizeAgentStatusValue(line)
  return /\b(no|sin evidencia|no hay evidencia|no se observa|no pude confirmar)\b.*\bresuelt/.test(
    normalizedLine,
  )
}

// ─── Progreso (lista de TODOs) y problemas de acceso ─────────────────────────

export function parseAgentTodoProgress(output: string): Array<{ status: string; text: string }> {
  const todoIndex = output.search(/\bTODOS\b/i)
  if (todoIndex < 0) return []
  const text = output.slice(todoIndex).replace(/\s+/g, ' ')
  const markerRegex = /\[([•xX✓ ])\]\s*/g
  const matches = [...text.matchAll(markerRegex)]
  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = matches[index + 1]?.index ?? text.length
      const marker = match[1]
      const taskText = cleanAgentReportText(text.slice(start, end))
      const status = marker === ' ' ? 'pending' : marker === '•' ? 'active' : 'done'
      return { status, text: taskText }
    })
    .filter((task) => task.text)
}

export function parseAgentAccessIssue(output: string): { path?: string } | null {
  if (!/permission requested:/i.test(output)) return null
  if (!/(auto-rejecting|rejected permission|user rejected permission)/i.test(output)) return null
  const path = output.match(/external_directory\s+\(([^)]+)\)/i)?.[1]
  return { path }
}

// ─── Bloques del informe ─────────────────────────────────────────────────────

type AgentReportBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'coverage'; items: AgentCoverageItem[] }
  | { type: 'insights'; items: AgentInsight[] }
  | { type: 'references'; items: AgentFileReference[] }

interface AgentCoverageItem {
  status: 'covered' | 'partial' | 'failed' | 'unknown' | 'side'
  statusLabel: string
  step: string
  detail: string
}

interface AgentInsight {
  title: string
  body: string
}

interface AgentFileReference {
  file: string
  line: string
  relevance: string
}

export function parseAgentReport(output: string): AgentReportBlock[] {
  const blocks: AgentReportBlock[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let tableRows: string[][] = []
  let insights: AgentInsight[] = []
  let coverageItems: AgentCoverageItem[] = []
  let references: AgentFileReference[] = []
  let currentSection = ''
  let skippingTodoBlock = false

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push({ type: 'paragraph', text: cleanAgentReportText(paragraph.join(' ')) })
    paragraph = []
  }

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push({ type: 'list', items: listItems.map(cleanAgentReportText) })
    listItems = []
  }

  const flushTable = () => {
    if (tableRows.length === 0) return
    const tableReferences = tableRowsToReferences(tableRows)
    if (tableReferences.length > 0) blocks.push({ type: 'references', items: tableReferences })
    else {
      blocks.push({
        type: 'paragraph',
        text: tableRows.map((row) => row.map(cleanAgentReportText).join(' · ')).join(' · '),
      })
    }
    tableRows = []
  }

  const flushInsights = () => {
    if (insights.length === 0) return
    blocks.push({ type: 'insights', items: insights })
    insights = []
  }

  const flushCoverage = () => {
    if (coverageItems.length === 0) return
    blocks.push({ type: 'coverage', items: coverageItems })
    coverageItems = []
  }

  const flushReferences = () => {
    if (references.length === 0) return
    blocks.push({ type: 'references', items: references })
    references = []
  }

  const flushAll = () => {
    flushParagraph()
    flushList()
    flushTable()
    flushInsights()
    flushCoverage()
    flushReferences()
  }

  for (const rawLine of normalizeAgentReportOutput(output).split(/\r?\n/)) {
    const line = rawLine.trim()
    const heading = line.match(/^#{1,6}\s+(.+)$/)
    const plainHeading = !heading && isPlainAgentSectionHeading(line) ? line : ''
    if (/^TODOS$/i.test(line)) {
      flushAll()
      skippingTodoBlock = true
      continue
    }
    if (skippingTodoBlock && !heading && !plainHeading) continue
    if (heading || plainHeading) skippingTodoBlock = false
    if (isAgentOperationalTrace(line) || isAgentFillerLine(line) || !line) {
      flushAll()
      continue
    }

    const tableRow = parseMarkdownTableRow(line)
    if (tableRow) {
      flushParagraph()
      flushList()
      flushInsights()
      flushCoverage()
      flushReferences()
      tableRows.push(tableRow)
      continue
    }

    if (heading || plainHeading) {
      flushAll()
      const headingText = heading?.[1]
        ? cleanAgentReportText(heading[1])
        : canonicalAgentSectionHeading(plainHeading)
      currentSection = normalizeAgentSection(headingText)
      blocks.push({ type: 'heading', text: headingText })
      continue
    }

    const listItem = line.match(/^(?:[-*]|\d+[.)])\s+(.+)$/)
    if (listItem) {
      flushParagraph()
      flushTable()
      const reference = parseAgentReferenceLine(listItem[1])
      if (reference) {
        flushList()
        flushInsights()
        references.push(reference)
        continue
      }
      const insight = parseAgentInsightLine(listItem[1], currentSection)
      if (insight) {
        flushList()
        flushCoverage()
        flushReferences()
        insights.push(insight)
        continue
      }
      const coverage = parseAgentCoverageLine(listItem[1], currentSection)
      if (coverage) {
        flushList()
        flushInsights()
        flushReferences()
        coverageItems.push(coverage)
        continue
      }
      flushReferences()
      flushInsights()
      flushCoverage()
      listItems.push(listItem[1])
      continue
    }

    const reference = parseAgentReferenceLine(line)
    if (reference) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushCoverage()
      references.push(reference)
      continue
    }

    const insight = parseAgentInsightLine(line, currentSection)
    if (insight) {
      flushParagraph()
      flushList()
      flushTable()
      flushCoverage()
      flushReferences()
      insights.push(insight)
      continue
    }

    const coverage = parseAgentCoverageLine(line, currentSection)
    if (coverage) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushReferences()
      coverageItems.push(coverage)
      continue
    }

    if (shouldRenderLineAsListItem(line, currentSection)) {
      flushParagraph()
      flushTable()
      flushInsights()
      flushCoverage()
      flushReferences()
      listItems.push(line)
      continue
    }

    flushList()
    flushTable()
    flushInsights()
    flushCoverage()
    flushReferences()
    paragraph.push(line)
  }

  flushAll()

  if (blocks.length === 0) {
    return [{ type: 'paragraph', text: 'El agente no devolvió salida.' }]
  }
  return blocks
}

function normalizeAgentReportOutput(output: string): string {
  return output
    .replace(/\s+(Coincide con el bug reportado:)/gi, '\n$1')
    .replace(/\s+(Motivo:)/gi, '\n$1')
}

function isAgentOperationalTrace(line: string): boolean {
  if (!line) return false
  if (/^>\s*build\s*[·-]/i.test(line)) return true
  if (/^(?:[-*]\s*)?>\s*(?:buglens|opencode)\s*[·-]/i.test(line)) return true
  if (/^[→✱✓•]\s+/.test(line)) return true
  if (/\b(Read|Glob|Grep|Explore Agent)\b/.test(line) && /[→✱✓•]/.test(line)) return true
  if (/^✗\s*Invalid Tool\b/i.test(line)) return true
  if (/^The arguments provided to the tool are invalid:/i.test(line)) return true
  return false
}

function isAgentFillerLine(line: string): boolean {
  return (
    /^ahora tengo suficiente información/i.test(line) ||
    /^ahora tengo suficiente contexto/i.test(line) ||
    /^este es mi análisis:?$/i.test(line) ||
    /^(now let me|let me|i(?:'|’)ll|i will|i need to|next,? i|first,? i)\b/i.test(line)
  )
}

function isPlainAgentSectionHeading(line: string): boolean {
  if (!line || /[.:]$/.test(line)) return false
  return Boolean(AGENT_SECTION_HEADINGS[normalizeAgentSection(line)])
}

const AGENT_SECTION_HEADINGS: Record<string, string> = {
  resumen: 'Resumen',
  evidencia: 'Evidencia',
  'cobertura de los pasos reportados': 'Cobertura de los pasos reportados',
  'diagnostico probable': 'Diagnóstico probable',
  'archivos o areas a revisar': 'Archivos o áreas a revisar',
  'hallazgos laterales': 'Hallazgos laterales',
  'estado probable del bug': 'Estado probable del bug',
  'proximos pasos': 'Próximos pasos',
  'informacion faltante': 'Información faltante',
}

function canonicalAgentSectionHeading(line: string): string {
  return AGENT_SECTION_HEADINGS[normalizeAgentSection(line)] ?? cleanAgentReportText(line)
}

function normalizeAgentSection(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseAgentInsightLine(line: string, section: string): AgentInsight | null {
  if (!['evidencia', 'diagnostico probable'].includes(section)) return null
  const cleanedLine = cleanAgentReportText(line)
  const separator = cleanedLine.includes(' — ') ? ' — ' : cleanedLine.includes(': ') ? ': ' : ''
  if (!separator) return null
  const [title = '', ...bodyParts] = cleanedLine.split(separator)
  const body = bodyParts.join(separator).trim()
  if (!title.trim() || !body) return null
  return { title: title.trim(), body }
}

function parseAgentCoverageLine(line: string, section: string): AgentCoverageItem | null {
  if (section !== 'cobertura de los pasos reportados') return null
  const cleanedLine = cleanAgentReportText(line)
  const match = cleanedLine.match(
    /^(.+?)\s*(?:→|=>|:|-)\s*(cubierto|parcial|parcialmente cubierto|cubierto parcialmente|no cubierto|falla|fallando|no verificable|no_verificable|hallazgo lateral|lateral)\.?\s*(.*)$/i,
  )
  if (!match) return null
  const statusText = normalizeAgentStatusValue(match[2] ?? '')
  const detailText = normalizeAgentStatusValue(match[3] ?? '')
  const hasPartialDetail =
    /\b(no verificado|no verificada|sin verificar|no valida|no validado|no validada|backend no|solo frontend)\b/.test(
      detailText,
    )
  const status = statusText.includes('hallazgo')
    ? 'side'
    : statusText === 'lateral'
      ? 'side'
      : statusText.includes('no verificable')
        ? 'unknown'
        : statusText.includes('parcial') || (statusText === 'cubierto' && hasPartialDetail)
          ? 'partial'
          : statusText.includes('no cubierto') || statusText.includes('falla')
            ? 'failed'
            : 'covered'
  const statusLabel =
    status === 'covered'
      ? 'cubierto'
      : status === 'partial'
        ? 'parcial'
        : status === 'failed'
          ? 'falla'
          : status === 'unknown'
            ? 'no verificable'
            : 'lateral'
  return {
    status,
    statusLabel,
    step: cleanAgentReportText(match[1] ?? ''),
    detail: cleanAgentReportText(match[3] ?? ''),
  }
}

function shouldRenderLineAsListItem(line: string, section: string): boolean {
  if (!['proximos pasos', 'informacion faltante'].includes(section)) return false
  return cleanAgentReportText(line).length > 0
}

function parseAgentReferenceLine(line: string): AgentFileReference | null {
  const cleanedLine = cleanAgentReportText(line)
  const parts = cleanedLine.split(/\s+[—-]\s+/)
  const target = parts[0]?.trim() ?? ''
  const relevance = parts.slice(1).join(' — ').trim()

  // El número de línea se separa ANTES de decidir si el target es un archivo:
  // `src/login.ts:42` tiene que reconocerse igual que `src/login.ts`.
  const lineMatch = target.match(/^(.*?)(?::|\s+línea\s+)(\d+(?:-\d+)?)$/i)
  const file = lineMatch ? lineMatch[1].trim() : target
  if (!isLikelyAgentReferenceTarget(file)) return null

  return { file, line: lineMatch ? lineMatch[2] : '', relevance }
}

function isLikelyAgentReferenceTarget(value: string): boolean {
  if (!value) return false
  if (/^(backend|frontend|api|servicio|endpoint|configuración|configuracion):/i.test(value)) {
    return true
  }
  return /(?:^|\/)[\w.-]+\.(?:ts|tsx|js|jsx|html|css|scss|java|kt|cs|go|py|rb|php|sql|json|yml|yaml|properties|xml|md)$/i.test(
    value,
  )
}

function parseMarkdownTableRow(line: string): string[] | null {
  if (!line.includes('|')) return null
  const cells = line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
  if (cells.length < 2) return null
  if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return []
  return cells
}

function tableRowsToReferences(rows: string[][]): AgentFileReference[] {
  const meaningfulRows = rows.filter((row) => row.length > 0)
  if (meaningfulRows.length === 0) return []

  const firstRow = meaningfulRows[0].map((cell) => normalizeAgentTableHeader(cell))
  const hasHeader = firstRow.some((cell) => ['archivo', 'file', 'ruta', 'path'].includes(cell))
  const bodyRows = hasHeader ? meaningfulRows.slice(1) : meaningfulRows
  const fileIndex = hasHeader
    ? firstRow.findIndex((cell) => ['archivo', 'file', 'ruta', 'path'].includes(cell))
    : 0
  const lineIndex = hasHeader
    ? firstRow.findIndex((cell) => ['linea', 'line', 'lineas', 'lines'].includes(cell))
    : 1
  const relevanceIndex = hasHeader
    ? firstRow.findIndex((cell) =>
        ['relevancia', 'motivo', 'razon', 'detalle', 'descripcion'].includes(cell),
      )
    : 2

  return bodyRows
    .map((row) => ({
      file: cleanAgentReportText(row[fileIndex] ?? row[0] ?? ''),
      line: cleanAgentReportText(row[lineIndex] ?? ''),
      relevance: cleanAgentReportText(row[relevanceIndex] ?? row.slice(2).join(' ')),
    }))
    .filter((item) => item.file)
}

function normalizeAgentTableHeader(text: string): string {
  return cleanAgentReportText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function cleanAgentReportText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function CloudAgentReport({ children }: { children: string }) {
  const blocks = parseAgentReport(children)

  return (
    <div className="cloud-agent-report">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h4 key={`${block.type}-${index}`} className="cloud-agent-heading">
              {block.text}
            </h4>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={`${block.type}-${index}`} className="cloud-agent-list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'insights') {
          return <CloudAgentInsights key={`${block.type}-${index}`} items={block.items} />
        }
        if (block.type === 'coverage') {
          return <CloudAgentCoverage key={`${block.type}-${index}`} items={block.items} />
        }
        if (block.type === 'references') {
          return <CloudAgentReferences key={`${block.type}-${index}`} items={block.items} />
        }
        return (
          <p key={`${block.type}-${index}`} className="cloud-agent-paragraph">
            {block.text}
          </p>
        )
      })}
    </div>
  )
}

function CloudAgentCoverage({ items }: { items: AgentCoverageItem[] }) {
  const markerByStatus: Record<AgentCoverageItem['status'], string> = {
    covered: '✓',
    partial: '~',
    failed: '!',
    unknown: '?',
    side: '·',
  }

  return (
    <div className="cloud-agent-coverage">
      {items.map((item, index) => (
        <div
          key={`${item.step}-${index}`}
          className={`cloud-agent-coverage-item cloud-agent-coverage-${item.status}`}
        >
          <span className="cloud-agent-coverage-mark" aria-hidden="true">
            {markerByStatus[item.status]}
          </span>
          <div className="cloud-agent-coverage-copy">
            <div className="cloud-agent-coverage-title">
              <span>{item.step}</span>
              <span className="cloud-agent-coverage-status">{item.statusLabel}</span>
            </div>
            {item.detail && <p className="cloud-agent-coverage-detail">{item.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function CloudAgentInsights({ items }: { items: AgentInsight[] }) {
  return (
    <div className="cloud-agent-insights">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="cloud-agent-insight">
          <div className="cloud-agent-insight-title">{item.title}</div>
          <p className="cloud-agent-insight-body">{item.body}</p>
        </div>
      ))}
    </div>
  )
}

function CloudAgentReferences({ items }: { items: AgentFileReference[] }) {
  return (
    <div className="cloud-agent-references">
      {items.map((item, index) => (
        <div key={`${item.file}-${item.line}-${index}`} className="cloud-agent-reference">
          <div className="cloud-agent-reference-main">
            <span className="cloud-agent-reference-file mono">{item.file}</span>
            {item.line && (
              <span className="cloud-agent-reference-line mono">línea {item.line}</span>
            )}
          </div>
          {item.relevance && <p className="cloud-agent-reference-note">{item.relevance}</p>}
        </div>
      ))}
    </div>
  )
}

export function AgentRunningProgress({ output }: { output: string }) {
  const tasks = parseAgentTodoProgress(output)

  return (
    <div className="agent-running-progress">
      <div className="agent-running-title">el agente está revisando el bug</div>
      <p className="agent-running-text">
        La salida parcial se mantiene como progreso interno hasta que el agente termine el informe.
      </p>
      {tasks.length > 0 && (
        <ul className="agent-running-tasks" aria-label="progreso del agente">
          {tasks.map((task, index) => (
            <li key={`${task.text}-${index}`} className="agent-running-task">
              <span className={`agent-running-task-dot agent-running-task-${task.status}`} />
              <span>{task.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AgentAccessIssueCard({ path }: { path?: string }) {
  return (
    <div className="agent-access-issue">
      <div className="agent-access-issue-title">el agente no pudo acceder al repositorio</div>
      <p className="agent-access-issue-text">
        El comando externo pidió permiso para leer {path ? `“${path}”` : 'el repositorio'} y el
        agente lo rechazó automáticamente. No llegó a hacer un análisis útil de código.
      </p>
      <p className="agent-access-issue-hint">
        Revisá que el repositorio configurado sea el directorio de trabajo permitido por el agente o
        ajustá sus permisos/sandbox para ejecuciones no interactivas.
      </p>
    </div>
  )
}

export function ResolvedSuggestionCard({
  reason,
  canConfirm,
  onConfirm,
  onDismiss,
}: {
  reason: string
  canConfirm: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  return (
    <div className="resolved-suggestion-card">
      <div className="min-w-0">
        <div className="resolved-suggestion-title">parece que está resuelto</div>
        <p className="resolved-suggestion-text">
          {reason ||
            'El agente encontró indicios de que el problema podría estar corregido en el código revisado.'}
        </p>
        <p className="resolved-suggestion-warning">
          Esta inferencia puede ser incorrecta: depende del modelo, la rama revisada y el contexto
          disponible. Confirmalo antes de cerrar el bug.
        </p>
      </div>
      <fieldset className="resolved-suggestion-actions">
        <legend className="sr-only">marcar bug como resuelto</legend>
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          disabled={!canConfirm}
          title={canConfirm ? 'marcar como solucionado' : 'no hay handler de estado disponible'}
        >
          Sí, está resuelto
        </button>
        <button type="button" className="btn-secondary" onClick={onDismiss}>
          No
        </button>
      </fieldset>
    </div>
  )
}

export { cleanAgentReportText }
