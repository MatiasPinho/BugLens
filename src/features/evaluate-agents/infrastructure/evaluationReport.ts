import type { AnalyzedBug, ExternalAgentResult } from '../../../shared/contracts/index.js'
import type {
  AgentEvaluationCase,
  EvaluationAgentSelection,
  EvaluationAssessment,
  EvaluationCacheMode,
} from '../application/agentEvaluation.js'

export interface EvaluatedAgentOutput<T> {
  output: T
  assessment: EvaluationAssessment
}

export interface AgentEvaluationRecord {
  caseId: string
  caseTitle: string
  repetition: number
  startedAt: string
  finishedAt: string
  normal: EvaluatedAgentOutput<AnalyzedBug>
  deep?: EvaluatedAgentOutput<ExternalAgentResult>
}

export interface AgentEvaluationManifest {
  id: string
  createdAt: string
  agents: EvaluationAgentSelection
  cacheMode: EvaluationCacheMode
  repeats: number
  settingsPath: string
  provider: string
  normalModel: string
  visionModel: string
  externalAgentCommand: string
  repositories: Array<{ path: string; branch: string }>
  cases: AgentEvaluationCase[]
}

export interface StoredAgentEvaluationRun {
  manifest: AgentEvaluationManifest
  records: AgentEvaluationRecord[]
}

interface BaselineScores {
  normal?: number
  deep?: number
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function recordKey(record: Pick<AgentEvaluationRecord, 'caseId' | 'repetition'>): string {
  return `${record.caseId}:${record.repetition}`
}

function baselineScoreMap(baseline?: StoredAgentEvaluationRun): Map<string, BaselineScores> {
  return new Map(
    (baseline?.records ?? []).map((record) => [
      recordKey(record),
      {
        normal: record.normal.assessment.score,
        deep: record.deep?.assessment.score,
      },
    ]),
  )
}

function scoreDelta(current: number, baseline?: number): string {
  if (baseline === undefined) return ''
  const delta = current - baseline
  if (delta === 0) return '<span class="delta neutral">sin cambio</span>'
  const sign = delta > 0 ? '+' : ''
  const tone = delta > 0 ? 'better' : 'worse'
  return `<span class="delta ${tone}">${sign}${delta}</span>`
}

function assessmentHtml(assessment: EvaluationAssessment): string {
  return `<ul class="checks">${assessment.checks
    .map(
      (check) => `<li class="${check.passed ? 'pass' : 'fail'}">
        <span aria-hidden="true">${check.passed ? '✓' : '×'}</span>
        <span>${escapeHtml(check.label)}${check.detail ? `<small>${escapeHtml(check.detail)}</small>` : ''}</span>
      </li>`,
    )
    .join('')}</ul>`
}

function outputHtml(label: string, output: unknown): string {
  return `<details><summary>${escapeHtml(label)}</summary><pre>${escapeHtml(
    typeof output === 'string' ? output : JSON.stringify(output, null, 2),
  )}</pre></details>`
}

function recordHtml(record: AgentEvaluationRecord, baseline?: BaselineScores): string {
  const normal = record.normal
  const deep = record.deep
  return `<article class="case-card">
    <header>
      <div><span class="case-id">${escapeHtml(record.caseId)}</span><h2>${escapeHtml(record.caseTitle)}</h2></div>
      <span class="repetition">Ejecución ${record.repetition}</span>
    </header>
    <div class="agent-grid">
      <section>
        <div class="score-row"><h3>Agente normal</h3><strong>${normal.assessment.score}</strong>${scoreDelta(
          normal.assessment.score,
          baseline?.normal,
        )}</div>
        ${assessmentHtml(normal.assessment)}
        ${outputHtml('Resultado exacto de la app', normal.output)}
        ${outputHtml('Respuesta cruda del modelo', normal.output.analysis.rawResponse)}
      </section>
      ${
        deep
          ? `<section>
        <div class="score-row"><h3>Agente profundo</h3><strong>${deep.assessment.score}</strong>${scoreDelta(
          deep.assessment.score,
          baseline?.deep,
        )}</div>
        ${assessmentHtml(deep.assessment)}
        ${outputHtml('Resultado exacto de la app', deep.output)}
        ${outputHtml('Informe del agente', deep.output.output)}
      </section>`
          : ''
      }
    </div>
  </article>`
}

function average(scores: number[]): number {
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
}

export function buildEvaluationReport(
  run: StoredAgentEvaluationRun,
  baseline?: StoredAgentEvaluationRun,
): string {
  const baselines = baselineScoreMap(baseline)
  const normalAverage = average(run.records.map((record) => record.normal.assessment.score))
  const deepScores = run.records.flatMap((record) =>
    record.deep ? [record.deep.assessment.score] : [],
  )
  const deepAverage = average(deepScores)
  const failedChecks = run.records.reduce(
    (total, record) =>
      total +
      record.normal.assessment.checks.filter((check) => !check.passed).length +
      (record.deep?.assessment.checks.filter((check) => !check.passed).length ?? 0),
    0,
  )

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Evaluación de agentes · ${escapeHtml(run.manifest.id)}</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; background: #f5f7fb; color: #172033; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; }
    main { max-width: 1440px; margin: 0 auto; }
    h1, h2, h3, p { margin-top: 0; }
    .muted { color: #637089; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 24px 0; }
    .metric, .case-card { background: white; border: 1px solid #dce2ec; border-radius: 12px; box-shadow: 0 4px 18px rgba(25, 39, 68, .05); }
    .metric { padding: 18px; }
    .metric strong { display: block; margin-top: 6px; font-size: 28px; }
    .case-card { margin: 18px 0; overflow: hidden; }
    .case-card > header { display: flex; justify-content: space-between; gap: 16px; padding: 20px 22px; border-bottom: 1px solid #e7ebf2; }
    .case-card h2 { margin: 4px 0 0; font-size: 18px; }
    .case-id, .repetition { color: #637089; font-size: 12px; }
    .agent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); }
    .agent-grid > section { padding: 22px; min-width: 0; }
    .agent-grid > section + section { border-left: 1px solid #e7ebf2; }
    .score-row { display: flex; align-items: center; gap: 10px; }
    .score-row h3 { margin: 0 auto 0 0; }
    .score-row strong { font-size: 24px; }
    .delta { padding: 3px 7px; border-radius: 999px; font-size: 11px; }
    .better { background: #e5f7ed; color: #17633a; }
    .worse { background: #fdeaea; color: #9c2929; }
    .neutral { background: #edf0f5; color: #58647a; }
    .checks { list-style: none; padding: 0; margin: 18px 0; display: grid; gap: 8px; }
    .checks li { display: flex; gap: 8px; align-items: flex-start; }
    .checks small { display: block; color: #637089; margin-top: 2px; }
    .pass > span:first-child { color: #1c8750; }
    .fail > span:first-child { color: #c33b3b; }
    details { border-top: 1px solid #edf0f5; padding: 12px 0; }
    summary { cursor: pointer; font-weight: 600; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f6f8fb; padding: 14px; border-radius: 8px; font: 12px/1.55 ui-monospace, monospace; }
    @media (max-width: 760px) { body { padding: 16px; } .agent-grid { grid-template-columns: 1fr; } .agent-grid > section + section { border-left: 0; border-top: 1px solid #e7ebf2; } }
  </style>
</head>
<body>
<main>
  <h1>Evaluación de agentes</h1>
  <p class="muted">${escapeHtml(run.manifest.createdAt)} · ${run.manifest.cases.length} casos · ${run.manifest.repeats} repetición(es) · caché ${escapeHtml(run.manifest.cacheMode)}</p>
  <div class="summary">
    <div class="metric"><span>Promedio normal</span><strong>${normalAverage}</strong></div>
    ${deepScores.length > 0 ? `<div class="metric"><span>Promedio profundo</span><strong>${deepAverage}</strong></div>` : ''}
    <div class="metric"><span>Validaciones fallidas</span><strong>${failedChecks}</strong></div>
    <div class="metric"><span>Ejecuciones</span><strong>${run.records.length}</strong></div>
  </div>
  ${run.records.map((record) => recordHtml(record, baselines.get(recordKey(record)))).join('\n')}
</main>
</body>
</html>`
}
