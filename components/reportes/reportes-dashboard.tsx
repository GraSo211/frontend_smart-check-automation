import {
  AlertTriangle,
  Boxes,
  Bot,
  Factory,
  Flame,
  Gauge,
  Info,
  Thermometer,
  Timer,
  ShieldCheck,
} from "lucide-react"

import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { APP_TIME_ZONE } from "@/lib/format"
import type { ReporteOEE } from "@/lib/oee-types"

import type {
  ReporteClaveTotal,
  ReporteGrupo,
  ReporteResumen,
  ReporteSerieAlertas,
  ReporteSerieCalidad,
  ReporteSerieProceso,
} from "@/lib/reportes-types"
import {
  type AppliedFilters,
  formatConfidence,
  formatGrupoLabel,
  formatKg,
  formatMinutes,
  formatPercent,
  formatUnits,
} from "@/lib/reportes"

interface ReportesDashboardProps {
  resumen: ReporteResumen
  appliedFilters: AppliedFilters
  oee?: ReporteOEE | null
  oeeError?: string | null
}

export function ReportesDashboard({
  resumen,
  appliedFilters,
  oee,
  oeeError,
}: ReportesDashboardProps) {
  const { produccion, calidad, proceso, alertas, automatizacion } = resumen
  const hasProduction = produccion.lotes_total > 0

  if (!hasProduction) {
    return <EmptyPeriod />
  }

  return (
    <div className="space-y-8">
      <NavAnchors />

      <section id="resumen">
        <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
          Resumen ejecutivo
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Boxes}
            label="Unidades procesadas"
            value={formatUnits(produccion.unidades)}
            hint={`${produccion.lotes_total} lotes · ${produccion.lotes_cerrados} cerrados`}
            accent="text-primary"
          />
          <KpiCard
            icon={Factory}
            label="kg estimados"
            value={formatKg(produccion.kg_total_estimados)}
            hint="Peso proyectado por conteos"
            accent="text-info"
            badge="estimado"
          />
          <KpiCard
            icon={ShieldCheck}
            label="FPY"
            value={formatPercent(calidad.fpy_pct)}
            hint="First Pass Yield"
            accent="text-success"
          />
          <KpiCard
            icon={Flame}
            label="Merma"
            value={formatKg(produccion.kg_merma_estimados)}
            secondaryValue={formatPercent(
              produccion.kg_total_estimados
                ? ((produccion.kg_merma_estimados ?? 0) /
                    produccion.kg_total_estimados) *
                    100
                : null,
            )}
            hint="kg y % sobre total"
            accent="text-destructive"
          />
          <KpiCard
            icon={Gauge}
            label="Confianza del modelo"
            value={formatConfidence(calidad.confianza_promedio)}
            hint="Promedio de confianza"
            accent="text-warning"
          />
          <KpiCard
            icon={Timer}
            label="Duración media"
            value={formatMinutes(produccion.duracion_media_min)}
            hint="Por lote cerrado"
            accent="text-primary"
          />
          <KpiCard
            icon={Thermometer}
            label="Cumplimiento térmico"
            value={formatPercent(proceso.temp_en_tolerancia_pct)}
            hint="Tiempo dentro de tolerancia"
            accent="text-info"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Alertas"
            value={alertas.total.toLocaleString("es-AR")}
            secondaryValue={formatMinutes(alertas.mtta_min)}
            hint="MTTA medio"
            accent="text-destructive"
          />
          <KpiCard
            icon={Bot}
            label="Adopción MPC"
            value={formatPercent(automatizacion.mpc_pct)}
            hint="Decisiones automáticas"
            accent="text-success"
          />
        </div>
      </section>

      <section id="calidad" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Calidad diaria</CardTitle>
            <CardDescription>FPY, crudo y quemado por día</CardDescription>
          </CardHeader>
          <CardContent>
            {calidad.serie_diaria.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin datos de calidad en el período.
              </p>
            ) : (
              <StackedQualityChart data={calidad.serie_diaria} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temperatura</CardTitle>
            <CardDescription>
              Real vs objetivo · {formatPercent(proceso.temp_en_tolerancia_pct)} en tolerancia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proceso.serie_diaria.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin datos de temperatura en el período.
              </p>
            ) : (
              <TemperatureChart data={proceso.serie_diaria} />
            )}
          </CardContent>
        </Card>
      </section>

      <section id="alertas" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alertas por día</CardTitle>
            <CardDescription>Críticas y total</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas.serie_diaria.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin alertas en el período.
              </p>
            ) : (
              <AlertsDailyChart data={alertas.serie_diaria} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de alertas</CardTitle>
            <CardDescription>Por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas.por_tipo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin alertas en el período.
              </p>
            ) : (
              <TypeDistributionList
                data={alertas.por_tipo}
                ariaLabel="Distribución de alertas por tipo"
                colorClass="bg-chart-2"
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section id="produccion" className="grid gap-6 lg:grid-cols-3">
        <ProductionBarCard
          title="Producción por turno"
          description="Unidades por turno"
          data={produccion.por_turno}
        />
        <ProductionBarCard
          title="Producción por sector"
          description="Unidades por sector"
          data={produccion.por_sector}
        />
        <ProductionBarCard
          title="Producción por producto"
          description="Unidades por producto"
          data={produccion.por_producto}
        />
      </section>

      <section id="desglose">
        <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
          Desglose operativo
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <BreakdownTable
            title="Por turno"
            rows={produccion.por_turno}
            caption="Producción desagregada por turno"
          />
          <BreakdownTable
            title="Por sector"
            rows={produccion.por_sector}
            caption="Producción desagregada por sector"
          />
          <BreakdownTable
            title="Por producto"
            rows={produccion.por_producto}
            caption="Producción desagregada por producto"
          />
          <div className="space-y-6">
            <TypeDistributionCard
              title="Alertas por tipo"
              data={alertas.por_tipo}
              emptyText="Sin alertas en el período"
              colorClass="bg-chart-2"
            />
            <TypeDistributionCard
              title="Top razones de skip del MPC"
              data={automatizacion.top_skip}
              emptyText="Sin skips en el período"
              colorClass="bg-chart-3"
            />
          </div>
        </div>
      </section>

      <section id="oee" className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            OEE
          </h2>
          {(appliedFilters.productoId || appliedFilters.turno) ? (
            <p className="text-xs text-muted-foreground">
              El OEE se calcula por sector/período; no aplica filtro por producto
              o turno.
            </p>
          ) : null}
        </div>

        {oeeError ? (
          <OEErrorState message={oeeError} />
        ) : oee ? (
          <OEEDashboard oee={oee} />
        ) : (
          <OEErrorState message="No hay datos de OEE para el período." />
        )}
      </section>

      <section
        id="descargas"
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <h2 className="font-heading text-base font-semibold text-foreground">
          Descargas
        </h2>
        <p className="text-xs text-muted-foreground">
          Las descargas usan los filtros aplicados: {appliedFilters.desde} a{" "}
          {appliedFilters.hasta}
          {appliedFilters.sectorId ? ` · sector ${appliedFilters.sectorId}` : ""}
          {appliedFilters.productoId
            ? ` · producto ${appliedFilters.productoId}`
            : ""}
          {appliedFilters.turno ? ` · turno ${appliedFilters.turno}` : ""}.
        </p>
      </section>
    </div>
  )
}

function NavAnchors() {
  const links = [
    { href: "#resumen", label: "Resumen" },
    { href: "#calidad", label: "Calidad y proceso" },
    { href: "#alertas", label: "Alertas" },
    { href: "#produccion", label: "Producción" },
    { href: "#desglose", label: "Desglose" },
    { href: "#oee", label: "OEE" },
    { href: "#descargas", label: "Descargas" },
  ]

  return (
    <nav aria-label="Secciones del reporte" className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  secondaryValue,
  hint,
  accent,
  badge,
}: {
  icon: React.ElementType
  label: string
  value: string
  secondaryValue?: string
  hint: string
  accent: string
  badge?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {secondaryValue ? (
            <p className="font-mono text-sm font-medium text-muted-foreground">
              {secondaryValue}
            </p>
          ) : null}
        </div>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted ${accent}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {badge ? (
          <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function EmptyPeriod() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-16 text-center shadow-sm">
      <span className="flex size-12 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground">
        <Info className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Sin datos en el período
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          No se encontraron lotes para los filtros seleccionados. Probá ampliando
          el rango o sacando filtros.
        </p>
      </div>
    </div>
  )
}

function StackedQualityChart({ data }: { data: ReporteSerieCalidad[] }) {
  const width = 600
  const height = 260
  const padding = { top: 10, right: 10, bottom: 60, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const barCount = data.length
  const gap = barCount <= 1 ? 0 : (chartWidth / barCount) * 0.2
  const barWidth = chartWidth / barCount - gap
  const labelStep = Math.max(1, Math.ceil(barCount / 12))

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label="Calidad diaria: FPY, crudo y quemado por día"
      >
        <title>Calidad diaria: FPY, crudo y quemado por día</title>
        {[0, 50, 100].map((pct) => {
          const y = padding.top + chartHeight - (pct / 100) * chartHeight
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.15}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-muted-foreground"
              >
                {pct}%
              </text>
            </g>
          )
        })}
        {data.map((day, index) => {
          const x =
            padding.left +
            index * (chartWidth / barCount) +
            gap / 2
          const fpy = day.fpy_pct ?? 0
          const crudo = day.crudo_pct ?? 0
          const quemado = day.quemado_pct ?? 0
          const hFpy = (fpy / 100) * chartHeight
          const hCrudo = (crudo / 100) * chartHeight
          const hQuemado = (quemado / 100) * chartHeight
          const yBase = padding.top + chartHeight
          return (
            <g key={day.fecha}>
              <rect
                x={x}
                y={yBase - hFpy}
                width={barWidth}
                height={hFpy}
                className="fill-success"
              />
              <rect
                x={x}
                y={yBase - hFpy - hCrudo}
                width={barWidth}
                height={hCrudo}
                className="fill-warning"
              />
              <rect
                x={x}
                y={yBase - hFpy - hCrudo - hQuemado}
                width={barWidth}
                height={hQuemado}
                className="fill-destructive"
              />
              {index % labelStep === 0 ? (
                <text
                  x={x + barWidth / 2}
                  y={yBase + 16}
                  textAnchor="middle"
                  className="text-[9px] fill-muted-foreground"
                  transform={`rotate(-45, ${x + barWidth / 2}, ${yBase + 16})`}
                >
                  {formatShortDate(day.fecha)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <li className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-success" />
          FPY
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-warning" />
          Crudo
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-destructive" />
          Quemado
        </li>
      </ul>
    </>
  )
}

function TemperatureChart({ data }: { data: ReporteSerieProceso[] }) {
  const width = 600
  const height = 260
  const padding = { top: 10, right: 10, bottom: 60, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const values = data.flatMap((d) => {
    const out: number[] = []
    if (d.temp_real_prom !== null) out.push(d.temp_real_prom)
    if (d.temp_objetivo_prom !== null) out.push(d.temp_objetivo_prom)
    return out
  })
  const rawMin = values.length ? Math.min(...values) : 0
  const rawMax = values.length ? Math.max(...values) : 100
  const paddingTemp = Math.max(2, (rawMax - rawMin) * 0.1)
  const min = rawMin - paddingTemp
  const max = rawMax + paddingTemp
  const range = max - min || 1

  const x = (index: number) =>
    padding.left + (index / Math.max(1, data.length - 1)) * chartWidth
  const y = (value: number) =>
    padding.top + chartHeight - ((value - min) / range) * chartHeight

  const labelStep = Math.max(1, Math.ceil(data.length / 12))
  const realPoints = data
    .map((d, i) =>
      d.temp_real_prom !== null ? `${x(i)},${y(d.temp_real_prom)}` : "",
    )
    .filter(Boolean)
    .join(" ")
  const targetPoints = data
    .map((d, i) =>
      d.temp_objetivo_prom !== null ? `${x(i)},${y(d.temp_objetivo_prom)}` : "",
    )
    .filter(Boolean)
    .join(" ")

  const ticks = [min, (min + max) / 2, max]

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label="Temperatura real vs objetivo por día"
      >
        <title>Temperatura real vs objetivo por día</title>
        {ticks.map((val) => {
          const yy = y(val)
          return (
            <g key={val}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                strokeOpacity={0.15}
              />
              <text
                x={padding.left - 8}
                y={yy + 4}
                textAnchor="end"
                className="text-[10px] fill-muted-foreground"
              >
                {val.toFixed(0)}°C
              </text>
            </g>
          )
        })}
        <polyline
          points={targetPoints}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <polyline
          points={realPoints}
          fill="none"
          stroke="var(--info)"
          strokeWidth={2}
        />
        {data.map(
          (d, i) =>
            d.temp_real_prom !== null && (
              <circle
                key={d.fecha}
                cx={x(i)}
                cy={y(d.temp_real_prom)}
                r={3}
                fill="var(--info)"
              />
            ),
        )}
        {data.map((d, i) =>
          i % labelStep === 0 ? (
            <text
              key={`label-${d.fecha}`}
              x={x(i)}
              y={padding.top + chartHeight + 16}
              textAnchor="middle"
              className="text-[9px] fill-muted-foreground"
              transform={`rotate(-45, ${x(i)}, ${padding.top + chartHeight + 16})`}
            >
              {formatShortDate(d.fecha)}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <li className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[var(--info)]" />
          Real
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[var(--muted-foreground)]" />
          Objetivo
        </li>
      </ul>
    </>
  )
}

function AlertsDailyChart({ data }: { data: ReporteSerieAlertas[] }) {
  const width = 600
  const height = 240
  const padding = { top: 10, right: 10, bottom: 60, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const max = Math.max(...data.map((d) => d.total), 1)
  const labelStep = Math.max(1, Math.ceil(data.length / 12))

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart-svg"
      role="img"
      aria-label="Alertas por día y severidad"
    >
      <title>Alertas por día y severidad</title>
      {[0, Math.round(max / 2), max].map((val) => {
        const y = padding.top + chartHeight - (val / max) * chartHeight
        return (
          <g key={val}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="text-[10px] fill-muted-foreground"
            >
              {val}
            </text>
          </g>
        )
      })}
      {data.map((d, index) => {
        const barWidth = (chartWidth / data.length) * 0.6
        const x =
          padding.left +
          index * (chartWidth / data.length) +
          (chartWidth / data.length - barWidth) / 2
        const hTotal = (d.total / max) * chartHeight
        const hCrit = d.criticas ? (d.criticas / max) * chartHeight : 0
        const yBase = padding.top + chartHeight
        return (
          <g key={d.fecha}>
            <rect
              x={x}
              y={yBase - hTotal}
              width={barWidth}
              height={hTotal}
              className="fill-warning"
            />
            {hCrit > 0 ? (
              <rect
                x={x}
                y={yBase - hCrit}
                width={barWidth}
                height={hCrit}
                className="fill-destructive"
              />
            ) : null}
            {index % labelStep === 0 ? (
              <text
                x={x + barWidth / 2}
                y={yBase + 16}
                textAnchor="middle"
                className="text-[9px] fill-muted-foreground"
                transform={`rotate(-45, ${x + barWidth / 2}, ${yBase + 16})`}
              >
                {formatShortDate(d.fecha)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function TypeDistributionList({
  data,
  ariaLabel,
  colorClass,
}: {
  data: ReporteClaveTotal[]
  ariaLabel: string
  colorClass: string
}) {
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {data.map((item) => (
        <li key={item.clave}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-foreground">{item.clave}</span>
            <span className="font-mono text-muted-foreground">
              {item.total.toLocaleString("es-AR")}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${colorClass}`}
              style={{ width: `${(item.total / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ProductionBarCard({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: ReporteGrupo[]
}) {
  const max = Math.max(...data.map((d) => d.unidades), 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin datos en el período.
          </p>
        ) : (
          <ul className="space-y-3" aria-label={title}>
            {data.map((item) => (
              <li key={item.clave}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {formatGrupoLabel(item)}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {item.unidades.toLocaleString("es-AR")} u
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{ width: `${(item.unidades / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function BreakdownTable({
  title,
  rows,
  caption,
}: {
  title: string
  rows: ReporteGrupo[]
  caption: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin datos en el período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th
                    scope="col"
                    className="py-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Nombre
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Lotes
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Unidades
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    kg est.
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    FPY
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.clave}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {formatGrupoLabel(row)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                      {row.lotes}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">
                      {row.unidades.toLocaleString("es-AR")}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                      {formatKg(row.kg_estimados)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                      {formatPercent(row.fpy_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TypeDistributionCard({
  title,
  data,
  emptyText,
  colorClass,
}: {
  title: string
  data: ReporteClaveTotal[]
  emptyText: string
  colorClass: string
}) {
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2" aria-label={title}>
            {data.map((item) => (
              <li key={item.clave}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{item.clave}</span>
                  <span className="font-mono text-muted-foreground">
                    {item.total.toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${colorClass}`}
                    style={{ width: `${(item.total / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function formatOEEMotivo(motivo: string): string {
  switch (motivo) {
    case "sin_plan_produccion":
      return "Sin plan de producción cargado"
    case "sin_produccion":
      return "Sin producción en el período"
    default:
      if (motivo.startsWith("sin_capacidad_producto:")) {
        return "Producto sin capacidad nominal configurada"
      }
      return motivo
  }
}

function OEErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-12 text-center shadow-sm">
      <Info className="size-6 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-foreground">{message}</p>
        <Link
          href="/planificacion"
          className="mt-1 inline-block text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ir a Planificación
        </Link>
      </div>
    </div>
  )
}

function OEECallout({ motivos }: { motivos: string[] }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning"
    >
      <p className="font-medium">OEE no calculable</p>
      <ul className="mt-1 list-inside list-disc text-warning/80">
        {motivos.map((motivo) => (
          <li key={motivo}>{formatOEEMotivo(motivo)}</li>
        ))}
      </ul>
      <Link
        href="/planificacion"
        className="mt-2 inline-block text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ir a Planificación
      </Link>
    </div>
  )
}

function OEEDashboard({ oee }: { oee: ReporteOEE }) {
  const global = oee.global

  return (
    <div className="space-y-6">
      {!global.calculable ? <OEECallout motivos={global.motivos} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Gauge}
          label="OEE"
          value={formatPercent(global.oee_pct)}
          hint="Disponibilidad × Rendimiento × Calidad"
          accent="text-primary"
        />
        <KpiCard
          icon={Timer}
          label="Disponibilidad"
          value={formatPercent(global.availability_pct)}
          hint="Tiempo operativo / planificado"
          accent="text-info"
        />
        <KpiCard
          icon={Factory}
          label="Rendimiento"
          value={formatPercent(global.performance_pct)}
          hint="Producción real / teórica"
          accent="text-warning"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Calidad"
          value={formatPercent(global.quality_pct)}
          hint="kg OK / kg producidos"
          accent="text-success"
        />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tiempos y producción</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Tiempo planificado
                </dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatMinutes(global.planned_time_min)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Paradas planificadas
                </dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatMinutes(global.planned_downtime_min)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Paradas no planificadas
                </dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatMinutes(global.unplanned_downtime_min)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Tiempo operativo
                </dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatMinutes(global.operating_time_min)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">kg plan</dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatKg(global.kg_plan)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">kg producidos</dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatKg(global.kg_producidos)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">kg OK</dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatKg(global.kg_ok)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Capacidad teórica
                </dt>
                <dd className="font-mono font-medium text-foreground">
                  {formatKg(global.capacidad_teorica_kg)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OEE por sector</CardTitle>
        </CardHeader>
        <CardContent>
          {oee.por_sector.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin sectores en el período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  OEE desagregado por sector
                </caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th
                      scope="col"
                      className="py-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Sector
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      OEE
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      A
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      P
                    </th>
                    <th
                      scope="col"
                      className="py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Q
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {oee.por_sector.map((row) => (
                    <tr
                      key={row.sector_id}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {row.sector_nombre || row.sector_id}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">
                        {formatPercent(row.oee_pct)}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                        {formatPercent(row.availability_pct)}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                        {formatPercent(row.performance_pct)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {formatPercent(row.quality_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  if (!Number.isFinite(date.getTime())) return iso.slice(0, 10)
  return date.toLocaleDateString("es-AR", {
    month: "short",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  })
}
