import React from "react"
import { formatARS, formatImpactoMerma, REFERENCIA_COSTO_MERMA } from "@/lib/economia-merma"
import {
  Document,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer"

import type {
  ReporteFiltrosAplicados,
  ReporteLote,
  ReporteResumen,
  ReporteSerieCalidad,
  ReporteSerieProceso,
} from "@/lib/reportes-types"
import type { ReporteOEE } from "@/lib/oee-types"

import {
  formatConfidence,
  formatDate,
  formatDateTime,
  formatGrupoLabel,
  formatKg,
  formatMinutes,
  formatNumber,
  formatPercent,
  palette,
  scaleLinear,
} from "./palette"

const PAGE_WIDTH = 595.28
const PAGE_PADDING = 28
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING * 2

const FONT = "Helvetica"
const FONT_BOLD = "Helvetica-Bold"

const DETAIL_PAGE_ROWS = 50

export interface ReporteOperativoProps {
  resumen: ReporteResumen
  lotes: ReporteLote[]
  filtros: ReporteFiltrosAplicados
  generatedAt: Date
  /** Nombres legibles de los filtros; si faltan se muestran los IDs. */
  sectorNombre?: string
  productoNombre?: string
  /** El backend dejó un cursor pendiente: el detalle quedó limitado a 150 filas. */
  truncated?: boolean
  /** OEE del período; `null` u omitido deja la página sin datos. */
  oee?: ReporteOEE | null
}

export function ReporteOperativo({
  resumen,
  lotes,
  filtros,
  generatedAt,
  sectorNombre,
  productoNombre,
  truncated = false,
  oee = null,
}: ReporteOperativoProps) {
  const detailChunks = chunk(lotes.slice(0, 150), DETAIL_PAGE_ROWS)
  if (detailChunks.length === 0) detailChunks.push([])

  return (
    <Document
      title="Reporte operativo"
      author="Fermar S.A. · SmartCheck Automation"
      subject="Reporte operativo del período"
    >
      <Page size="A4" style={styles.page} wrap>
        <PageHeader
          resumen={resumen}
          filtros={filtros}
          generatedAt={generatedAt}
          sectorNombre={sectorNombre}
          productoNombre={productoNombre}
        />
        <ProduccionPage resumen={resumen} />
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PageHeader
          resumen={resumen}
          filtros={filtros}
          generatedAt={generatedAt}
          sectorNombre={sectorNombre}
          productoNombre={productoNombre}
        />
        <EconomiaPage resumen={resumen} />
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PageHeader resumen={resumen} filtros={filtros} generatedAt={generatedAt} sectorNombre={sectorNombre} productoNombre={productoNombre} />
        <ProcesoPage resumen={resumen} />
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PageHeader
          resumen={resumen}
          filtros={filtros}
          generatedAt={generatedAt}
          sectorNombre={sectorNombre}
          productoNombre={productoNombre}
        />
        <OEEPage oee={oee} />
        <PageFooter />
      </Page>

      {detailChunks.map((chunk, index) => (
        <Page key={`detalle-${index}`} size="A4" style={styles.page} wrap>
          <PageHeader
            resumen={resumen}
            filtros={filtros}
            generatedAt={generatedAt}
            sectorNombre={sectorNombre}
            productoNombre={productoNombre}
          />
          <DetallePage
            lotes={chunk}
            first={index === 0}
            last={index === detailChunks.length - 1}
            truncado={truncated}
            total={lotes.length}
          />
          <PageFooter />
        </Page>
      ))}
    </Document>
  )
}

function PageHeader({
  resumen,
  filtros,
  generatedAt,
  sectorNombre,
  productoNombre,
}: {
  resumen: ReporteResumen
  filtros: ReporteFiltrosAplicados
  generatedAt: Date
  sectorNombre?: string
  productoNombre?: string
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Fermar S.A. · SmartCheck Automation</Text>
          <Text style={styles.title}>Reporte operativo</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta}>
            Período: {formatDate(resumen.periodo.desde)} – {formatDate(resumen.periodo.hasta)}
          </Text>
          <Text style={styles.headerMeta}>
            Generado: {formatDateTime(generatedAt)} ART
          </Text>
        </View>
      </View>
      <Text style={styles.filters}>
        Filtros: sector {sectorNombre ?? filtros.sector_id ?? "todos"} · producto{" "}
        {productoNombre ?? filtros.producto_id ?? "todos"} · turno{" "}
        {filtros.turno ?? "todos"}
      </Text>
    </View>
  )
}

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>kg estimados = conteo × peso de referencia</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function EmptyBlock({ message = "Sin datos en el período" }: { message?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

function Kpi({
  label,
  value,
  hint,
  compact = false,
}: {
  label: string
  value: string
  hint?: string
  compact?: boolean
}) {
  return (
    <View style={[styles.kpi, compact ? styles.kpiCompact : {}]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  )
}

function EconomiaPage({ resumen }: { resumen: ReporteResumen }) {
  const data = resumen.impacto_economico
  return <View>
    <SectionTitle>Impacto económico de la merma</SectionTitle>
    <Text style={{ fontSize: 22, marginBottom: 12, color: palette.danger }}>{formatImpactoMerma(data)}</Text>
    <Text style={styles.note}>{REFERENCIA_COSTO_MERMA}</Text>
    {!data ? <Text style={styles.note}>Impacto económico no disponible.</Text> : <>
      <Text style={styles.note}>{formatNumber(data.unidades_merma)} piezas de merma · {formatNumber(data.unidades_sin_costo)} sin costo · {formatNumber(data.lotes_sin_conteos)} lotes sin conteos.</Text>
      {data.perdida_ars === null && <Text style={styles.note}>Cálculo incompleto. El subtotal incluye únicamente las mermas que se pudieron valorizar.</Text>}
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={{ width: 200 }}>Producto</Text><Text style={{ width: 115 }}>Costo por pieza (ARS)</Text><Text style={{ width: 70 }}>Merma (u)</Text><Text style={{ width: 150 }}>Pérdida (ARS)</Text>
      </View>
      {data.por_producto.map((p) => <View key={p.producto_id} style={styles.tableRow} wrap={false}>
        <Text style={{ width: 200 }}>{p.nombre}{p.lotes_sin_conteos > 0 ? ` (${p.lotes_sin_conteos} lotes sin conteos)` : ""}</Text>
        <Text style={{ width: 115 }}>{p.costo_unitario_ars == null ? "Sin configurar" : formatARS(p.costo_unitario_ars)}</Text>
        <Text style={{ width: 70 }}>{formatNumber(p.unidades_merma)}</Text>
        <Text style={{ width: 150 }}>{formatARS(p.perdida_ars)}</Text>
      </View>)}
    </>}
  </View>
}

function ProduccionPage({ resumen }: { resumen: ReporteResumen }) {
  const { produccion, calidad } = resumen
  const mermaPct =
    produccion.kg_total_estimados > 0
      ? ((produccion.kg_merma_estimados ?? 0) / produccion.kg_total_estimados) * 100
      : null

  return (
    <View>
      <SectionTitle>Indicadores del período</SectionTitle>
      <View style={styles.kpiGrid}>
        <Kpi
          label="Unidades procesadas"
          value={formatNumber(produccion.unidades)}
          hint={`${formatNumber(produccion.lotes_total)} lotes · ${formatNumber(produccion.lotes_cerrados)} cerrados`}
        />
        <Kpi
          label="kg estimados"
          value={formatKg(produccion.kg_total_estimados)}
          hint={`${formatKg(produccion.kg_ok_estimados)} OK`}
        />
        <Kpi
          label="FPY"
          value={formatPercent(calidad.fpy_pct)}
          hint={`Crudo ${formatPercent(calidad.crudo_pct)} · Quemado ${formatPercent(calidad.quemado_pct)}`}
        />
        <Kpi
          label="Merma"
          value={formatKg(produccion.kg_merma_estimados)}
          hint={mermaPct === null ? "—" : `${formatPercent(mermaPct)} del total`}
        />
        <Kpi
          label="Confianza del modelo"
          value={formatConfidence(calidad.confianza_promedio)}
          hint={`${formatPercent(calidad.lotes_conformes_pct)} lotes conformes`}
        />
        <Kpi
          label="Duración media"
          value={formatMinutes(produccion.duracion_media_min)}
          hint={`P95 ${formatMinutes(produccion.duracion_p95_min)}`}
        />
        <Kpi
          label="Cumplimiento térmico"
          value={formatPercent(resumen.proceso.temp_en_tolerancia_pct)}
          hint="Tiempo dentro de tolerancia"
        />
        <Kpi
          label="Alertas"
          value={formatNumber(resumen.alertas.total)}
          hint={`MTTA ${formatMinutes(resumen.alertas.mtta_min)}`}
        />
        <Kpi
          label="Adopción MPC"
          value={formatPercent(resumen.automatizacion.mpc_pct)}
          hint={`${formatNumber(resumen.automatizacion.decisiones_total)} decisiones`}
        />
      </View>

      <SectionTitle>Calidad diaria (composición %)</SectionTitle>
      <StackedQualityChart serie={calidad.serie_diaria} />

      <SectionTitle>Producción por turno</SectionTitle>
      <TurnoTable resumen={resumen} />
    </View>
  )
}

function StackedQualityChart({ serie }: { serie: ReporteSerieCalidad[] }) {
  if (serie.length === 0) return <EmptyBlock />

  const width = CONTENT_WIDTH
  const height = 96
  const gap = 2
  const barWidth = Math.max(1, (width - gap * (serie.length - 1)) / serie.length)
  const labelStep = Math.max(1, Math.ceil(serie.length / 8))

  return (
    <View style={styles.chart}>
      <View style={styles.legend}>
        <LegendItem color={palette.success} label="FPY" />
        <LegendItem color={palette.warning} label="Crudo" />
        <LegendItem color={palette.danger} label="Quemado" />
      </View>
      <Svg width={width} height={height}>
        <Line
          x1={0}
          y1={height}
          x2={width}
          y2={height}
          stroke={palette.border}
          strokeWidth={0.8}
        />
        {serie.map((dia, index) => {
          const values = [dia.fpy_pct ?? 0, dia.crudo_pct ?? 0, dia.quemado_pct ?? 0]
          const sum = values.reduce((acc, value) => acc + value, 0)
          if (sum <= 0) return null
          const x = index * (barWidth + gap)
          const fpy = (values[0] / sum) * height
          const crudo = (values[1] / sum) * height
          const quemado = (values[2] / sum) * height
          return (
            <React.Fragment key={dia.fecha}>
              <Rect x={x} y={height - fpy} width={barWidth} height={fpy} fill={palette.success} />
              <Rect
                x={x}
                y={height - fpy - crudo}
                width={barWidth}
                height={crudo}
                fill={palette.warning}
              />
              <Rect
                x={x}
                y={height - fpy - crudo - quemado}
                width={barWidth}
                height={quemado}
                fill={palette.danger}
              />
            </React.Fragment>
          )
        })}
      </Svg>
      <View style={styles.axisRow}>
        {serie.map((dia, index) => (
          <Text
            key={dia.fecha}
            style={[styles.axisLabel, { width: barWidth + gap }]}
          >
            {index % labelStep === 0 ? formatDate(dia.fecha).slice(0, 5) : ""}
          </Text>
        ))}
      </View>
    </View>
  )
}

function TurnoTable({ resumen }: { resumen: ReporteResumen }) {
  const grupos = resumen.produccion.por_turno
  if (grupos.length === 0) return <EmptyBlock />
  return (
    <View>
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={[styles.cell, { width: 90 }]}>Turno</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 60 }]}>Lotes</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 80 }]}>Unidades</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 90 }]}>kg estimados</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 80 }]}>FPY</Text>
      </View>
      {grupos.map((grupo) => (
        <View key={grupo.clave} style={styles.tableRow}>
          <Text style={[styles.cell, { width: 90 }]}>
            {formatGrupoLabel(grupo)}
          </Text>
          <Text style={[styles.cell, styles.cellNum, { width: 60 }]}>
            {formatNumber(grupo.lotes)}
          </Text>
          <Text style={[styles.cell, styles.cellNum, { width: 80 }]}>
            {formatNumber(grupo.unidades)}
          </Text>
          <Text style={[styles.cell, styles.cellNum, { width: 90 }]}>
            {formatKg(grupo.kg_estimados)}
          </Text>
          <Text style={[styles.cell, styles.cellNum, { width: 80 }]}>
            {formatPercent(grupo.fpy_pct)}
          </Text>
        </View>
      ))}
    </View>
  )
}

function ProcesoPage({ resumen }: { resumen: ReporteResumen }) {
  const { proceso, alertas, automatizacion } = resumen
  return (
    <View>
      <SectionTitle>Temperatura real vs objetivo</SectionTitle>
      <TempChart serie={proceso.serie_diaria} />
      <View style={styles.legend}>
        <LegendItem color={palette.primary} label="Real" />
        <LegendItem color={palette.muted} label="Objetivo" />
      </View>

      <SectionTitle>% del tiempo en tolerancia</SectionTitle>
      <ToleranceChart serie={proceso.serie_diaria} />

      <SectionTitle>Indicadores de proceso</SectionTitle>
      <View style={styles.kpiGridSmall}>
        <Kpi compact label="MAE temperatura" value={`${formatOne(proceso.temp_mae_c)} °C`} />
        <Kpi compact label="MAE velocidad" value={formatOne(proceso.vel_mae)} />
        <Kpi compact label="Temp. en tolerancia" value={formatPercent(proceso.temp_en_tolerancia_pct)} />
        <Kpi compact label="Vel. en tolerancia" value={formatPercent(proceso.vel_en_tolerancia_pct)} />
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <SectionTitle>Alertas</SectionTitle>
          <View style={styles.panel}>
            <InfoRow label="Total" value={formatNumber(alertas.total)} />
            <InfoRow label="ACK" value={formatPercent(alertas.ack_pct)} />
            <InfoRow label="MTTA" value={formatMinutes(alertas.mtta_min)} />
            <Text style={styles.panelSubtitle}>Por severidad</Text>
            {Object.keys(alertas.por_severidad).length === 0 ? (
              <Text style={styles.mutedText}>Sin datos en el período</Text>
            ) : (
              Object.entries(alertas.por_severidad).map(([key, value]) => (
                <InfoRow key={key} label={key} value={formatNumber(value)} />
              ))
            )}
            <Text style={styles.panelSubtitle}>Por tipo</Text>
            {alertas.por_tipo.length === 0 ? (
              <Text style={styles.mutedText}>Sin datos en el período</Text>
            ) : (
              alertas.por_tipo.slice(0, 5).map((item) => (
                <InfoRow key={item.clave} label={item.clave} value={formatNumber(item.total)} />
              ))
            )}
          </View>
        </View>

        <View style={styles.column}>
          <SectionTitle>Automatización</SectionTitle>
          <View style={styles.panel}>
            <InfoRow
              label="Decisiones"
              value={formatNumber(automatizacion.decisiones_total)}
            />
            <InfoRow label="MPC" value={formatPercent(automatizacion.mpc_pct)} />
            <InfoRow label="Operario" value={formatPercent(automatizacion.operario_pct)} />
            <InfoRow label="Sin aplicar" value={formatPercent(automatizacion.sin_aplicar_pct)} />
            <InfoRow label="z MAE" value={formatOne(automatizacion.z_mae)} />
            <Text style={styles.panelSubtitle}>Top skip</Text>
            {automatizacion.top_skip.length === 0 ? (
              <Text style={styles.mutedText}>Sin datos en el período</Text>
            ) : (
              automatizacion.top_skip
                .slice(0, 3)
                .map((item) => (
                  <InfoRow
                    key={item.clave}
                    label={item.clave}
                    value={formatNumber(item.total)}
                  />
                ))
            )}
            <Text style={styles.panelSubtitle}>Modos</Text>
            {Object.keys(automatizacion.modo_pct).length === 0 ? (
              <Text style={styles.mutedText}>Sin datos en el período</Text>
            ) : (
              Object.entries(automatizacion.modo_pct).map(([key, value]) => (
                <InfoRow key={key} label={key} value={formatPercent(value)} />
              ))
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

function TempChart({ serie }: { serie: ReporteSerieProceso[] }) {
  const values: number[] = []
  for (const dia of serie) {
    if (dia.temp_real_prom !== null) values.push(dia.temp_real_prom)
    if (dia.temp_objetivo_prom !== null) values.push(dia.temp_objetivo_prom)
  }
  if (serie.length === 0 || values.length === 0) return <EmptyBlock />

  const min = Math.min(...values) - 2
  const max = Math.max(...values) + 2
  const chartWidth = CONTENT_WIDTH - 34
  const height = 110
  const realPath = buildLinePath(
    serie.map((dia) => dia.temp_real_prom),
    chartWidth,
    height,
    min,
    max,
  )
  const objetivoPath = buildLinePath(
    serie.map((dia) => dia.temp_objetivo_prom),
    chartWidth,
    height,
    min,
    max,
  )

  return (
    <View style={styles.chart}>
      <View style={styles.tempChartRow}>
        <View style={styles.tempAxis}>
          <Text style={styles.axisLabel}>{max.toFixed(0)} °C</Text>
          <Text style={styles.axisLabel}>{((max + min) / 2).toFixed(0)} °C</Text>
          <Text style={styles.axisLabel}>{min.toFixed(0)} °C</Text>
        </View>
        <Svg width={chartWidth} height={height}>
          {[0, 0.5, 1].map((ratio) => (
            <Line
              key={ratio}
              x1={0}
              y1={height * ratio}
              x2={chartWidth}
              y2={height * ratio}
              stroke={palette.border}
              strokeWidth={0.6}
            />
          ))}
          {objetivoPath ? (
            <Path d={objetivoPath} stroke={palette.muted} strokeWidth={1} fill="none" />
          ) : null}
          {realPath ? (
            <Path d={realPath} stroke={palette.primary} strokeWidth={1.4} fill="none" />
          ) : null}
        </Svg>
      </View>
      <AxisDates serie={serie} width={chartWidth} offset={34} />
    </View>
  )
}

function ToleranceChart({ serie }: { serie: ReporteSerieProceso[] }) {
  if (serie.length === 0) return <EmptyBlock />
  const width = CONTENT_WIDTH
  const height = 34
  const gap = 2
  const barWidth = Math.max(1, (width - gap * (serie.length - 1)) / serie.length)
  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={height} x2={width} y2={height} stroke={palette.border} strokeWidth={0.8} />
      {serie.map((dia, index) => {
        const pct = dia.temp_en_tolerancia_pct
        if (pct === null) return null
        const barHeight = scaleLinear(pct, 0, 100, height)
        return (
          <Rect
            key={dia.fecha}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill={palette.primary}
          />
        )
      })}
    </Svg>
  )
}

function AxisDates({
  serie,
  width,
  offset = 0,
}: {
  serie: { fecha: string }[]
  width: number
  offset?: number
}) {
  const step = Math.max(1, Math.ceil(serie.length / 6))
  return (
    <View style={[styles.axisDates, { marginLeft: offset, width }]}>
      {serie.map((dia, index) => (
        <Text key={dia.fecha} style={styles.axisLabel}>
          {index % step === 0 ? formatDate(dia.fecha).slice(0, 5) : ""}
        </Text>
      ))}
    </View>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

/** Traducción de los motivos que devuelve GET /api/v1/reportes/oee. */
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

function OEECallout({ motivos, title }: { motivos: string[]; title: string }) {
  return (
    <View style={styles.callout}>
      <Text style={styles.calloutTitle}>{title}</Text>
      {motivos.length === 0 ? (
        <Text style={styles.calloutText}>No se pudo obtener el OEE del período.</Text>
      ) : (
        motivos.map((motivo) => (
          <Text key={motivo} style={styles.calloutText}>
            • {formatOEEMotivo(motivo)}
          </Text>
        ))
      )}
      <Text style={styles.calloutNote}>
        Cargá el plan de producción y la capacidad de los productos en Planificación.
      </Text>
    </View>
  )
}

function OEEPage({ oee }: { oee: ReporteOEE | null }) {
  if (!oee) {
    return (
      <View>
        <SectionTitle>OEE</SectionTitle>
        <OEECallout title="OEE no disponible" motivos={[]} />
      </View>
    )
  }

  const { global } = oee

  return (
    <View>
      <SectionTitle>OEE</SectionTitle>
      {!global.calculable ? (
        <OEECallout title="OEE no calculable" motivos={global.motivos} />
      ) : null}

      <View style={styles.kpiGrid}>
        <Kpi
          label="OEE"
          value={formatPercent(global.oee_pct)}
          hint="Disponibilidad × Rendimiento × Calidad"
        />
        <Kpi
          label="Disponibilidad"
          value={formatPercent(global.availability_pct)}
          hint="Tiempo operativo / planificado"
        />
        <Kpi
          label="Rendimiento"
          value={formatPercent(global.performance_pct)}
          hint="Producción real / teórica"
        />
        <Kpi
          label="Calidad"
          value={formatPercent(global.quality_pct)}
          hint="kg OK / kg producidos"
        />
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <SectionTitle>Tiempos</SectionTitle>
          <View style={styles.panel}>
            <InfoRow label="Tiempo planificado" value={formatMinutes(global.planned_time_min)} />
            <InfoRow
              label="Paradas no planificadas"
              value={formatMinutes(global.unplanned_downtime_min)}
            />
            <InfoRow label="Tiempo operativo" value={formatMinutes(global.operating_time_min)} />
          </View>
        </View>
        <View style={styles.column}>
          <SectionTitle>Volumen</SectionTitle>
          <View style={styles.panel}>
            <InfoRow label="kg plan" value={formatKg(global.kg_plan)} />
            <InfoRow label="kg producidos" value={formatKg(global.kg_producidos)} />
            <InfoRow label="kg OK" value={formatKg(global.kg_ok)} />
            <InfoRow label="Capacidad teórica" value={formatKg(global.capacidad_teorica_kg)} />
          </View>
        </View>
      </View>

      <SectionTitle>OEE por sector</SectionTitle>
      {oee.por_sector.length === 0 ? (
        <EmptyBlock message="Sin sectores con datos de OEE en el período" />
      ) : (
        <View>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.cell, { width: 200 }]}>Sector</Text>
            <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>OEE</Text>
            <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>A</Text>
            <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>P</Text>
            <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>Q</Text>
          </View>
          {oee.por_sector.map((row) => (
            <View key={row.sector_id} style={styles.tableRow}>
              <Text style={[styles.cell, { width: 200 }]}>
                {row.sector_nombre || row.sector_id}
              </Text>
              <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>
                {formatPercent(row.oee_pct)}
              </Text>
              <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>
                {formatPercent(row.availability_pct)}
              </Text>
              <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>
                {formatPercent(row.performance_pct)}
              </Text>
              <Text style={[styles.cell, styles.cellNum, { width: 62 }]}>
                {formatPercent(row.quality_pct)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const DETAIL_COLUMNS: { label: string; width: number; value: (lote: ReporteLote) => string }[] = [
  { label: "Fecha", width: 52, value: (l) => formatDate(l.abierto_en) },
  { label: "Sector", width: 60, value: (l) => l.sector_nombre || l.sector_id },
  { label: "Producto", width: 84, value: (l) => l.producto_nombre || l.producto_id },
  {
    label: "Turno",
    width: 34,
    value: (l) =>
      l.turno ? formatGrupoLabel({ clave: l.turno, nombre: "" }) : "—",
  },
  { label: "Estado", width: 42, value: (l) => l.estado },
  { label: "Total", width: 30, value: (l) => formatNumber(l.conteos.total) },
  { label: "OK", width: 26, value: (l) => formatNumber(l.conteos.ok) },
  { label: "Crudo", width: 28, value: (l) => formatNumber(l.conteos.crudo) },
  { label: "Quemado", width: 34, value: (l) => formatNumber(l.conteos.quemado) },
  { label: "kg total", width: 46, value: (l) => formatKg(l.kg.total) },
  { label: "Merma", width: 36, value: (l) => formatKg(l.kg.merma) },
  { label: "FPY", width: 30, value: (l) => formatPercent(l.fpy_pct) },
  { label: "Conf.", width: 34, value: (l) => formatConfidence(l.confianza_promedio) },
]

function DetallePage({
  lotes,
  first,
  last,
  truncado,
  total,
}: {
  lotes: ReporteLote[]
  first: boolean
  last: boolean
  truncado: boolean
  total: number
}) {
  const numeric = new Set(["Total", "OK", "Crudo", "Quemado", "kg total", "Merma", "FPY", "Conf."])
  return (
    <View>
      {first ? <SectionTitle>Detalle de lotes</SectionTitle> : null}
      {lotes.length === 0 ? (
        <EmptyBlock />
      ) : (
        <>
          <View style={[styles.tableRow, styles.tableHead]}>
            {DETAIL_COLUMNS.map((column) => (
              <Text
                key={column.label}
                style={[
                  styles.cell,
                  styles.cellTiny,
                  numeric.has(column.label) ? styles.cellNum : {},
                  { width: column.width },
                ]}
              >
                {column.label}
              </Text>
            ))}
          </View>
          {lotes.map((lote) => (
            <View key={lote.id} style={styles.tableRow}>
              {DETAIL_COLUMNS.map((column) => (
                <Text
                  key={column.label}
                  style={[
                    styles.cell,
                    styles.cellTiny,
                    numeric.has(column.label) ? styles.cellNum : {},
                    { width: column.width },
                  ]}
                >
                  {column.value(lote)}
                </Text>
              ))}
            </View>
          ))}
        </>
      )}
      {last && truncado ? (
        <Text style={styles.note}>
          Detalle limitado a 150 lotes; descargá el CSV para el período completo.
        </Text>
      ) : null}
      {last && lotes.length > 0 ? (
        <Text style={styles.note}>{formatNumber(total)} lotes en el detalle.</Text>
      ) : null}
    </View>
  )
}

function formatOne(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

/** Arma el `d` de una polilínea, cortando en los valores nulos. */
export function buildLinePath(
  values: (number | null)[],
  width: number,
  height: number,
  min: number,
  max: number,
): string {
  let path = ""
  let drawing = false
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      drawing = false
      return
    }
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - scaleLinear(value, min, max, height)
    path += `${drawing ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)} `
    drawing = true
  })
  return path.trim()
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 30,
    paddingHorizontal: PAGE_PADDING,
    fontFamily: FONT,
    fontSize: 9,
    color: palette.text,
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingBottom: 6,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: { flexGrow: 1 },
  headerRight: { alignItems: "flex-end" },
  brand: { fontSize: 8, color: palette.muted, letterSpacing: 0.3 },
  title: { fontSize: 18, fontFamily: FONT_BOLD, marginTop: 1 },
  headerMeta: { fontSize: 7.5, color: palette.muted, marginTop: 1 },
  filters: { fontSize: 7.5, color: palette.muted, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 14,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.8,
    borderTopColor: palette.border,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: palette.muted },
  sectionTitle: {
    fontSize: 11,
    fontFamily: FONT_BOLD,
    marginTop: 8,
    marginBottom: 5,
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kpiGridSmall: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kpi: {
    width: 174,
    borderWidth: 0.8,
    borderColor: palette.border,
    borderRadius: 3,
    backgroundColor: palette.soft,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  kpiCompact: { width: 128 },
  kpiLabel: { fontSize: 7, color: palette.muted },
  kpiValue: { fontSize: 13, fontFamily: FONT_BOLD, marginTop: 1 },
  kpiHint: { fontSize: 6.5, color: palette.muted, marginTop: 1 },
  chart: { marginBottom: 4 },
  legend: { flexDirection: "row", gap: 12, marginBottom: 3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendSwatch: { width: 7, height: 7, borderRadius: 1 },
  legendText: { fontSize: 7, color: palette.muted },
  axisRow: { flexDirection: "row", marginTop: 2 },
  axisDates: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  axisLabel: { fontSize: 6, color: palette.muted },
  tempChartRow: { flexDirection: "row", alignItems: "stretch" },
  tempAxis: { width: 34, justifyContent: "space-between", paddingRight: 4 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: palette.border,
    alignItems: "center",
  },
  tableHead: {
    backgroundColor: palette.soft,
    borderTopWidth: 0.8,
    borderTopColor: palette.border,
  },
  cell: { fontSize: 8, paddingVertical: 3, paddingHorizontal: 2 },
  cellTiny: { fontSize: 6.8, paddingVertical: 2.1, paddingHorizontal: 2 },
  cellNum: { textAlign: "right" },
  empty: {
    borderWidth: 0.8,
    borderColor: palette.border,
    borderRadius: 3,
    backgroundColor: palette.soft,
    paddingVertical: 10,
    marginBottom: 4,
  },
  emptyText: { fontSize: 8, color: palette.muted, textAlign: "center" },
  columns: { flexDirection: "row", gap: 12 },
  column: { flexGrow: 1, flexBasis: 0 },
  panel: {
    borderWidth: 0.8,
    borderColor: palette.border,
    borderRadius: 3,
    padding: 6,
    minHeight: 120,
  },
  panelSubtitle: {
    fontSize: 7.5,
    fontFamily: FONT_BOLD,
    marginTop: 5,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    borderBottomWidth: 0.4,
    borderBottomColor: palette.soft,
  },
  infoLabel: { fontSize: 7.5, color: palette.muted, flexGrow: 1, paddingRight: 6 },
  infoValue: { fontSize: 7.5, fontFamily: FONT_BOLD },
  mutedText: { fontSize: 7, color: palette.muted },
  callout: {
    borderWidth: 0.8,
    borderColor: palette.warning,
    borderRadius: 3,
    backgroundColor: "#fffbeb",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  calloutTitle: { fontSize: 9, fontFamily: FONT_BOLD, color: "#92400e" },
  calloutText: { fontSize: 7.5, color: "#92400e", marginTop: 2 },
  calloutNote: { fontSize: 7, color: palette.muted, marginTop: 4 },
  note: { fontSize: 7, color: palette.muted, marginTop: 6 },
})
