// BugKpiGrid.tsx
//
// Resumen numérico de la pantalla de Bugs. Vivía dentro de BugSplitView; al
// pasar la pantalla a tres columnas quedó como pieza propia, encima de las
// columnas y compartida por toda la pantalla.

export function BugKpiGrid({
  active,
  critical,
  missingInfo,
  solved,
}: {
  active: number
  critical: number
  missingInfo: number
  solved: number
}) {
  return (
    <div className="kpi-grid">
      <Kpi label="Activos" value={active} />
      <Kpi label="Críticos" value={critical} tone="kpi-critical" />
      <Kpi label="Falta info" value={missingInfo} tone="kpi-warn" />
      <Kpi label="Solucionados" value={solved} tone="kpi-solved" />
    </div>
  )
}

function Kpi({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`kpi ${tone}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  )
}
