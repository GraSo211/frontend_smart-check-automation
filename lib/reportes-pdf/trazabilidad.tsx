import React from "react"
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
  ReporteTrazabilidad as ReporteTrazabilidadData,
  ReporteTrazabilidadAlerta,
  ReporteTrazabilidadConfianza,
  ReporteTrazabilidadConsigna,
  ReporteTrazabilidadDecision,
  ReporteTrazabilidadLote,
  ReporteTrazabilidadPunto,
} from "@/lib/reportes-types"

import { buildLinePath } from "./reporte-operativo"
import {
  formatConfidence,
  formatDateTime,
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

const CONSIGNA_ROWS_PER_PAGE = 20
const ALERTA_ROWS_PER_PAGE = 12
const DECISION_ROWS_PER_PAGE = 10

export interface ReporteTrazabilidadProps {
  data: ReporteTrazabilidadData
  generatedAt: Date
}

export function ReporteTrazabilidad({ data, generatedAt }: ReporteTrazabilidadProps) {
  const { lote, proceso, confianza_clases, decisiones, consignas, alertas } = data

  const consignaChunks = chunk(consignas, CONSIGNA_ROWS_PER_PAGE)
  const alertaChunks = chunk(alertas, ALERTA_ROWS_PER_PAGE)
  // El backend devuelve las decisiones más recientes primero; el PDF narra el
  // lote en orden cronológico.
  const decisionesAsc = [...decisiones].sort(
    (a, b) => new Date(a.creada_en).getTime() - new Date(b.creada_en).getTime(),
  )
  const decisionChunks = chunk(decisionesAsc, DECISION_ROWS_PER_PAGE)
  const detailPages = Math.max(alertaChunks.length, decisionChunks.length, 1)

  return (
    <Document
      title={`Trazabilidad ${lote.id}`}
      author="Fermar S.A. · SmartCheck Automation"
      subject="Trazabilidad de lote"
    >
      <Page size="A4" style={styles.page} wrap>
        <PageHeader lote={lote} generatedAt={generatedAt} />
        <MetadataBlock lote={lote} />

        <SectionTitle>Indicadores del lote</SectionTitle>
        <KpiGrid lote={lote} proceso={proceso} />

        <SectionTitle>Temperatura real vs objetivo</SectionTitle>
        <LineChart serie={proceso.serie} kind="temp" />
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PageHeader lote={lote} generatedAt={generatedAt} />
        <SectionTitle>Velocidad real vs objetivo</SectionTitle>
        <LineChart serie={proceso.serie} kind="vel" />

        <SectionTitle>% del tiempo en tolerancia</SectionTitle>
        <ToleranceBars proceso={proceso} />

        <SectionTitle>Confianza por clase</SectionTitle>
        <ConfianzaTable filas={confianza_clases} />

        <SectionTitle>Consignas</SectionTitle>
        <ConsignasTable filas={consignaChunks[0] ?? []} />
        <PageFooter />
      </Page>

      {consignaChunks.slice(1).map((filas, index) => (
        <Page key={`consignas-${index}`} size="A4" style={styles.page} wrap>
          <PageHeader lote={lote} generatedAt={generatedAt} />
          <SectionTitle>Consignas (continuación)</SectionTitle>
          <ConsignasTable filas={filas} />
          <PageFooter />
        </Page>
      ))}

      {Array.from({ length: detailPages }, (_, index) => (
        <Page key={`detalle-${index}`} size="A4" style={styles.page} wrap>
          <PageHeader lote={lote} generatedAt={generatedAt} />
          <SectionTitle>{index === 0 ? "Alertas" : "Alertas (continuación)"}</SectionTitle>
          <AlertasTable filas={alertaChunks[index] ?? []} />
          <SectionTitle>
            {index === 0 ? "Decisiones MPC" : "Decisiones MPC (continuación)"}
          </SectionTitle>
          <DecisionesTable filas={decisionChunks[index] ?? []} />
          <PageFooter />
        </Page>
      ))}
    </Document>
  )
}

function PageHeader({
  lote,
  generatedAt,
}: {
  lote: ReporteTrazabilidadLote
  generatedAt: Date
}) {
  const cerrado = lote.cerrado_en ? formatDateTime(lote.cerrado_en) : "abierto"
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Fermar S.A. · SmartCheck Automation</Text>
          <Text style={styles.title}>Trazabilidad de lote</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta}>Lote: {lote.id}</Text>
          <Text style={styles.headerMeta}>
            Período: {formatDateTime(lote.abierto_en)} – {cerrado}
          </Text>
          <Text style={styles.headerMeta}>
            Generado: {formatDateTime(generatedAt)} ART
          </Text>
        </View>
      </View>
      <Text style={styles.filters}>Filtros: no aplican (lote único)</Text>
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

function EmptyBlock({ message = "Sin datos" }: { message?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
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

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  )
}

function MetadataBlock({ lote }: { lote: ReporteTrazabilidadLote }) {
  return (
    <View style={styles.metadataGrid}>
      <View style={styles.metadataColumn}>
        <InfoRow label="Sector" value={lote.sector_nombre || lote.sector_id} />
        <InfoRow label="Producto" value={lote.producto_nombre || lote.producto_id} />
        <InfoRow label="Turno" value={lote.turno ?? "—"} />
        <InfoRow label="Modo" value={lote.modo ?? "—"} />
        <InfoRow label="Estado" value={lote.estado} />
        <InfoRow label="Motivo de cierre" value={lote.motivo_cierre ?? "—"} />
        <InfoRow label="Duración" value={formatMinutes(lote.duracion_min)} />
      </View>
      <View style={styles.metadataColumn}>
        <InfoRow label="Temperatura objetivo" value={formatOne(lote.temp1_objetivo, " °C")} />
        <InfoRow label="Velocidad objetivo" value={formatVel(lote.vel_objetivo)} />
        <InfoRow label="Tolerancia térmica" value={formatOne(lote.tolerancia_temp_c, " °C")} />
        <InfoRow
          label="Umbral crudo / quemado"
          value={`${formatOne(lote.umbral_aceptacion_crudo, "%")} / ${formatOne(lote.umbral_aceptacion_quemado, "%")}`}
        />
        <InfoRow label="Delta temp. máx." value={formatOne(lote.delta_temp1_max_c, " °C")} />
        <InfoRow label="Delta vel. máx." value={formatVel(lote.delta_vel_max)} />
        <InfoRow
          label="Cerrado"
          value={lote.cerrado_en ? formatDateTime(lote.cerrado_en) : "abierto"}
        />
      </View>
    </View>
  )
}

function KpiGrid({
  lote,
  proceso,
}: {
  lote: ReporteTrazabilidadLote
  proceso: ReporteTrazabilidadData["proceso"]
}) {
  const mermaPct =
    lote.kg.total && lote.kg.total > 0 && lote.kg.merma !== null
      ? (lote.kg.merma / lote.kg.total) * 100
      : null

  return (
    <View style={styles.kpiGrid}>
      <Kpi
        label="Unidades totales"
        value={formatNumber(lote.conteos.total)}
        hint={`${formatMinutes(lote.duracion_min)} de proceso`}
      />
      <Kpi label="OK" value={formatNumber(lote.conteos.ok)} hint={formatPercent(lote.fpy_pct)} />
      <Kpi label="Crudo" value={formatNumber(lote.conteos.crudo)} hint={formatPercent(lote.crudo_pct)} />
      <Kpi
        label="Quemado"
        value={formatNumber(lote.conteos.quemado)}
        hint={formatPercent(lote.quemado_pct)}
      />
      <Kpi label="FPY" value={formatPercent(lote.fpy_pct)} hint="First pass yield" />
      <Kpi
        label="kg estimados"
        value={formatKg(lote.kg.total)}
        hint={`Merma ${formatKg(lote.kg.merma)}${mermaPct === null ? "" : ` (${formatPercent(mermaPct)})`}`}
      />
      <Kpi label="Confianza del modelo" value={formatConfidence(lote.confianza_promedio)} />
      <Kpi label="MAE temperatura" value={formatOne(proceso.temp_mae_c, " °C")} />
      <Kpi
        label="Temp. en tolerancia"
        value={formatPercent(proceso.temp_en_tolerancia_pct)}
      />
      <Kpi label="MAE velocidad" value={formatVel(proceso.vel_mae)} />
    </View>
  )
}

function LineChart({
  serie,
  kind,
}: {
  serie: ReporteTrazabilidadPunto[]
  kind: "temp" | "vel"
}) {
  const realKey = kind === "temp" ? "temp_real" : "vel_real"
  const objetivoKey = kind === "temp" ? "temp_objetivo" : "vel_objetivo"
  const real = serie.map((punto) => punto[realKey])
  const objetivo = serie.map((punto) => punto[objetivoKey])
  const values: number[] = []
  for (const value of [...real, ...objetivo]) {
    if (value !== null && Number.isFinite(value)) values.push(value)
  }
  if (serie.length === 0 || values.length === 0) return <EmptyBlock />

  const pad = kind === "temp" ? 2 : 0.02
  const min = Math.min(...values) - pad
  const max = Math.max(...values) + pad
  const chartWidth = CONTENT_WIDTH - 46
  const height = 116
  const realPath = buildLinePath(real, chartWidth, height, min, max)
  const objetivoPath = buildLinePath(objetivo, chartWidth, height, min, max)
  const unit = kind === "temp" ? " °C" : ""
  const fmt = (value: number) => (kind === "temp" ? value.toFixed(0) : value.toFixed(2))

  return (
    <View style={styles.chart}>
      <View style={styles.legend}>
        <LegendItem color={palette.primary} label="Real" />
        <LegendItem color={palette.muted} label="Objetivo" />
      </View>
      <View style={styles.chartRow}>
        <View style={styles.chartAxis}>
          <Text style={styles.axisLabel}>
            {fmt(max)}
            {unit}
          </Text>
          <Text style={styles.axisLabel}>
            {fmt((max + min) / 2)}
            {unit}
          </Text>
          <Text style={styles.axisLabel}>
            {fmt(min)}
            {unit}
          </Text>
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
      <TimeAxis serie={serie} width={chartWidth} offset={46} />
    </View>
  )
}

function TimeAxis({
  serie,
  width,
  offset = 0,
}: {
  serie: ReporteTrazabilidadPunto[]
  width: number
  offset?: number
}) {
  const step = Math.max(1, Math.ceil(serie.length / 6))
  return (
    <View style={[styles.axisDates, { marginLeft: offset, width }]}>
      {serie.map((punto, index) => (
        <Text key={punto.ts} style={styles.axisLabel}>
          {index % step === 0 ? formatDateTime(punto.ts).slice(11, 16) : ""}
        </Text>
      ))}
    </View>
  )
}

function ToleranceBars({ proceso }: { proceso: ReporteTrazabilidadData["proceso"] }) {
  const filas = [
    { label: "Temperatura", value: proceso.temp_en_tolerancia_pct, color: palette.primary },
    { label: "Velocidad", value: proceso.vel_en_tolerancia_pct, color: palette.success },
  ]
  if (filas.every((fila) => fila.value === null)) return <EmptyBlock />

  const barWidth = 330
  const barHeight = 10
  return (
    <View style={styles.barPanel}>
      {filas.map((fila) => (
        <View key={fila.label} style={styles.barRow}>
          <Text style={styles.barLabel}>{fila.label}</Text>
          <Svg width={barWidth} height={barHeight}>
            <Rect
              x={0}
              y={0}
              width={barWidth}
              height={barHeight}
              fill={palette.soft}
              stroke={palette.border}
              strokeWidth={0.6}
            />
            <Rect
              x={0}
              y={0}
              width={scaleLinear(fila.value ?? 0, 0, 100, barWidth)}
              height={barHeight}
              fill={fila.color}
            />
          </Svg>
          <Text style={styles.barValue}>{formatPercent(fila.value)}</Text>
        </View>
      ))}
    </View>
  )
}

function ConfianzaTable({ filas }: { filas: ReporteTrazabilidadConfianza[] }) {
  if (filas.length === 0) return <EmptyBlock />
  return (
    <View>
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={[styles.cell, { width: 180 }]}>Clase</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 110 }]}>Confianza media</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 100 }]}>Desvío</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 149 }]}>Muestras</Text>
      </View>
      {filas.map((fila) => (
        <View key={fila.clase} style={styles.tableRow}>
          <Text style={[styles.cell, { width: 180 }]}>{fila.clase}</Text>
          <Text style={[styles.cell, styles.cellNum, { width: 110 }]}>
            {formatConfidence(fila.confianza_media)}
          </Text>
          <Text style={[styles.cell, styles.cellNum, { width: 100 }]}>
            {formatConfidence(fila.confianza_stddev)}
          </Text>
          <Text style={[styles.cell, styles.cellNum, { width: 149 }]}>
            {formatNumber(fila.muestras)}
          </Text>
        </View>
      ))}
    </View>
  )
}

function formatoResultadoConsigna(fila: ReporteTrazabilidadConsigna): string {
  switch (fila.estado) {
    case "APLICADA":
      return "Aplicada"
    case "PENDIENTE":
      return "Pendiente"
    case "RECHAZADA":
      return `Error: ${fila.motivo_error ?? "sin detalle"}`
    default:
      return fila.exitosa ? "Enviada" : `Error: ${fila.motivo_error ?? "sin detalle"}`
  }
}

function ConsignasTable({ filas }: { filas: ReporteTrazabilidadConsigna[] }) {
  if (filas.length === 0) return <EmptyBlock />
  return (
    <View>
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={[styles.cell, { width: 100 }]}>Hora</Text>
        <Text style={[styles.cell, { width: 66 }]}>Origen</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 74 }]}>T objetivo</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 74 }]}>V objetivo</Text>
        <Text style={[styles.cell, { width: 225 }]}>Resultado</Text>
      </View>
      {filas.map((fila) => (
        <View key={fila.id} style={styles.tableRow}>
          <Text style={[styles.cell, { width: 100 }]}>{formatDateTime(fila.creada_en)}</Text>
          <Text style={[styles.cell, { width: 66 }]}>{fila.origen}</Text>
          <Text style={[styles.cell, styles.cellNum, { width: 74 }]}>
            {formatOne(fila.temperatura_objetivo, " °C")}
          </Text>
          <Text style={[styles.cell, styles.cellNum, { width: 74 }]}>
            {formatVel(fila.velocidad_cinta_objetivo)}
          </Text>
          <Text style={[styles.cell, { width: 225 }]}>{formatoResultadoConsigna(fila)}</Text>
        </View>
      ))}
    </View>
  )
}

function AlertasTable({ filas }: { filas: ReporteTrazabilidadAlerta[] }) {
  if (filas.length === 0) return <EmptyBlock />
  return (
    <View>
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={[styles.cell, { width: 100 }]}>Hora</Text>
        <Text style={[styles.cell, { width: 92 }]}>Tipo</Text>
        <Text style={[styles.cell, { width: 52 }]}>Severidad</Text>
        <Text style={[styles.cell, { width: 50 }]}>Estado</Text>
        <Text style={[styles.cell, { width: 245 }]}>Mensaje</Text>
      </View>
      {filas.map((fila) => (
        <View key={fila.id} style={styles.tableRow}>
          <Text style={[styles.cell, { width: 100 }]}>{formatDateTime(fila.creada_en)}</Text>
          <Text style={[styles.cell, { width: 92 }]}>{fila.tipo}</Text>
          <Text style={[styles.cell, { width: 52 }, severityStyle(fila.severidad)]}>
            {fila.severidad}
          </Text>
          <Text style={[styles.cell, { width: 50 }]}>{fila.estado}</Text>
          <Text style={[styles.cell, { width: 245 }]}>{fila.mensaje}</Text>
        </View>
      ))}
    </View>
  )
}

function DecisionesTable({ filas }: { filas: ReporteTrazabilidadDecision[] }) {
  if (filas.length === 0) return <EmptyBlock />
  return (
    <View>
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={[styles.cell, { width: 96 }]}>Hora</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 112 }]}>T / V propuesto</Text>
        <Text style={[styles.cell, { width: 78 }]}>Aplicado por</Text>
        <Text style={[styles.cell, styles.cellNum, { width: 78 }]}>z obs / pred</Text>
        <Text style={[styles.cell, { width: 175 }]}>Razón skip</Text>
      </View>
      {filas.map((fila) => (
        <View key={fila.id} style={styles.tableRow}>
          <Text style={[styles.cell, { width: 96 }]}>{formatDateTime(fila.creada_en)}</Text>
          <Text style={[styles.cell, styles.cellNum, { width: 112 }]}>
            {formatOne(fila.temp_propuesto, " °C")} · {formatVel(fila.vel_propuesto)}
          </Text>
          <Text style={[styles.cell, { width: 78 }]}>{fila.aplicado_por ?? "—"}</Text>
          <Text style={[styles.cell, styles.cellNum, { width: 78 }]}>
            {formatDecimal(fila.z_observado, 2)} / {formatDecimal(fila.z_predicho, 2)}
          </Text>
          <Text style={[styles.cell, { width: 175 }]}>{fila.razon_skipped ?? "—"}</Text>
        </View>
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

function severityStyle(severidad: string) {
  if (severidad === "CRITICAL") return { color: palette.danger }
  if (severidad === "WARNING") return { color: palette.warning }
  return { color: palette.muted }
}

function formatDecimal(value: number | null, digits: number): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatOne(value: number | null, suffix = ""): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${formatDecimal(value, 1)}${suffix}`
}

/** La velocidad de cinta se maneja en m/s con 3 decimales (0,200). */
function formatVel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${formatDecimal(value, 3)} m/s`
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
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
  headerRight: { alignItems: "flex-end", maxWidth: 330 },
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
  metadataGrid: { flexDirection: "row", gap: 14 },
  metadataColumn: { flexGrow: 1, flexBasis: 0 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    borderBottomWidth: 0.4,
    borderBottomColor: palette.soft,
  },
  infoLabel: { fontSize: 7.5, color: palette.muted, flexGrow: 1, paddingRight: 6 },
  infoValue: { fontSize: 7.5, fontFamily: FONT_BOLD },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kpi: {
    width: 174,
    borderWidth: 0.8,
    borderColor: palette.border,
    borderRadius: 3,
    backgroundColor: palette.soft,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  kpiLabel: { fontSize: 7, color: palette.muted },
  kpiValue: { fontSize: 13, fontFamily: FONT_BOLD, marginTop: 1 },
  kpiHint: { fontSize: 6.5, color: palette.muted, marginTop: 1 },
  chart: { marginBottom: 4 },
  legend: { flexDirection: "row", gap: 12, marginBottom: 3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendSwatch: { width: 7, height: 7, borderRadius: 1 },
  legendText: { fontSize: 7, color: palette.muted },
  chartRow: { flexDirection: "row", alignItems: "stretch" },
  chartAxis: { width: 46, justifyContent: "space-between", paddingRight: 4 },
  axisDates: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  axisLabel: { fontSize: 6, color: palette.muted },
  barPanel: {
    borderWidth: 0.8,
    borderColor: palette.border,
    borderRadius: 3,
    padding: 6,
    gap: 5,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 70, fontSize: 7.5, color: palette.muted },
  barValue: { width: 54, fontSize: 7.5, fontFamily: FONT_BOLD, textAlign: "right" },
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
  cell: { fontSize: 7.4, paddingVertical: 2.6, paddingHorizontal: 2 },
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
})
