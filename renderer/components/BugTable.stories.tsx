import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AnalyzedBug } from '../../src/types/index'
import { makeBug } from './_storyFixtures'
import BugTable from './BugTable'

const bugs: AnalyzedBug[] = [
  makeBug({
    id: 'b1',
    title: 'Login no responde',
    summary: 'el botón de login a veces tira 500',
    severity: 'high',
    category: 'backend',
    status: 'en_progreso',
  }),
  makeBug({
    id: 'b2',
    title: 'Form armas',
    summary: 'campos sin validación',
    status: 'nuevo',
    observed:
      '1. organismo registrante acepta menos de 5\n2. número de serie permite más de 20\n3. no muestra el error en rojo',
    missing: ['el mensaje exacto del error'],
  }),
  makeBug({
    id: 'b3',
    title: 'Export Excel',
    summary: 'el botón exportar no hace nada',
    severity: 'low',
    status: 'solucionado',
  }),
  makeBug({
    id: 'b4',
    title: 'Filtro de fecha',
    summary: 'no filtra por rango',
    category: 'frontend',
    status: 'cerrado',
  }),
  makeBug({
    id: 'b5',
    title: 'Carga de avatar',
    summary: 'no se pudo reproducir',
    severity: 'low',
    status: 'no_replicado',
  }),
]

const manyBugs: AnalyzedBug[] = Array.from({ length: 64 }, (_, index) => {
  const statuses = ['nuevo', 'en_progreso', 'solucionado', 'cerrado'] as const
  const severities = ['critical', 'high', 'medium', 'low'] as const
  const categories = ['frontend', 'backend', 'data', 'config'] as const
  return makeBug({
    id: `page-${index + 1}`,
    title: `Bug paginado ${String(index + 1).padStart(2, '0')}`,
    summary: 'caso de QA dentro de una importación larga',
    status: statuses[index % statuses.length],
    severity: severities[index % severities.length],
    category: categories[index % categories.length],
  })
})

const agentCoverageOutput = `## Resumen
El formulario de armas tiene validaciones implementadas para los pasos reportados, pero queda una inconsistencia lateral entre frontend y backend.

## Cobertura de los pasos reportados
✓ Nº de serie > 20 caracteres — cubierto. maxInputLength limita a 20 y el validador exige longitud exacta.
△ Organismo registrante < 5 caracteres — parcial. El frontend lo valida, pero falta confirmar el mensaje visual.
? Fecha adquisición año 4000 — no verificable. El código tiene max de fecha, falta prueba manual en navegador.
! Guardar sin otra moneda — falla. El control se habilita, pero no se encontró required aplicado.
→ Backend acepta 100 caracteres para organismo registrante mientras el frontend limita a 50.

## Estado probable del bug
Estado probable: parcialmente_resuelto
Coincide con el bug reportado: parcial`

const agentResolvedOutput = `## Resumen
Todos los pasos reportados tienen validación o bloqueo explícito en el código actual.

## Cobertura de los pasos reportados
✓ Nº de serie > 20 caracteres — cubierto.
✓ Organismo registrante < 5 caracteres — cubierto.
✓ Fecha adquisición año 4000 — cubierto.
✓ Texto en campos numéricos — cubierto.

## Estado probable del bug
Estado probable: resuelto
Coincide con el bug reportado: sí`

const agentErrorOutput = `TODOS
[•] Explorar frontend [ ] Revisar backend [ ] Sintetizar evidencia

✗ Invalid Tool
The arguments provided to the tool are invalid: Model tried to call unavailable tool 'bash'.`

const meta: Meta<typeof BugTable> = {
  title: 'buglens/BugTable',
  component: BugTable,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BugTable>

// Tabla con bugs en distintos estados/severidades. Abre en la pestaña "activos"
// (nuevo / en progreso); cambiá a "históricos" (solucionado / cerrado / no
// replicado) o "todos" con el control segmentado. El selector de estado de cada
// fila es interactivo; expandí un bug para ver el reporte reescrito.
export const Default: Story = {
  args: { results: bugs, onSetStatus: () => {}, onDelete: () => {} },
}

// Un bug que junta varios problemas (observed numerado → badge "N problemas" al expandir).
export const MultiProblema: Story = { args: { results: [bugs[1]], onSetStatus: () => {} } }

export const SinResultados: Story = { args: { results: [] } }

export const ConPaginacion: Story = {
  args: { results: manyBugs, onSetStatus: () => {}, onDelete: () => {} },
}

export const ConAgenteExterno: Story = {
  args: {
    results: [
      (() => {
        const bug = makeBug({
          id: 'b6',
          title: 'Form armas',
          summary: 'validaciones reportadas en el formulario de armas',
          status: 'nuevo',
          observed:
            '1. número de serie acepta más de 20 caracteres\n2. organismo registrante acepta menos de 5\n3. fecha de adquisición permite año 4000\n4. guardar sin otra moneda',
          expected: 'los campos deberían bloquear valores inválidos y mostrar errores claros',
          steps: ['abrir /form', 'ingresar datos inválidos', 'guardar'],
          missing: ['captura actual del mensaje visual'],
        })
        bug.analysis.externalAgent = {
          ok: true,
          command: 'codex exec',
          durationMs: 141000,
          output: agentCoverageOutput,
        }
        return bug
      })(),
    ],
    expandedId: 'b6',
    onSetStatus: () => {},
    onAnalyzeExternalAgent: async () => ({
      ok: true,
      command: 'codex exec',
      durationMs: 141000,
      output: agentCoverageOutput,
    }),
  },
}

export const AgenteSugiereResuelto: Story = {
  args: {
    results: [
      (() => {
        const bug = makeBug({
          id: 'b7',
          title: 'Depósitos bancarios',
          summary: 'validaciones históricas en depósitos bancarios',
          status: 'nuevo',
          observed: 'el índice de cotización permite letras y el CUIL inválido muestra error Java',
          expected: 'debería bloquear letras y mostrar un mensaje amigable',
          steps: ['abrir /form', 'ingresar letras en índice', 'ingresar CUIL inválido'],
        })
        bug.analysis.externalAgent = {
          ok: true,
          command: 'opencode run',
          durationMs: 125000,
          output: agentResolvedOutput,
        }
        return bug
      })(),
    ],
    expandedId: 'b7',
    onSetStatus: () => {},
  },
}

export const AgenteConErrorYLogs: Story = {
  args: {
    results: [
      (() => {
        const bug = makeBug({
          id: 'b8',
          title: 'Login queda cargando',
          summary: 'el agente no pudo completar el análisis',
          status: 'en_progreso',
        })
        bug.analysis.externalAgent = {
          ok: false,
          command: 'codex exec',
          durationMs: 90000,
          error: 'El agente externo quedó en progreso interno sin entregar un informe durante 90s.',
          output: agentErrorOutput,
        }
        return bug
      })(),
    ],
    expandedId: 'b8',
    onAnalyzeExternalAgent: async () => ({
      ok: false,
      command: 'codex exec',
      durationMs: 90000,
      error: 'El agente externo quedó en progreso interno sin entregar un informe durante 90s.',
      output: agentErrorOutput,
    }),
  },
}
