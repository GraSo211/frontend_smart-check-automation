"use client"

import { useMemo, useState } from "react"
import { Activity, BrainCircuit, HardDrive, MemoryStick, Thermometer } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildDashboardSamples, formatSnapshot, levelFor, percent, ramUsedMb } from "@/lib/telemetry"
import type { Device, SpecificDevice } from "@/lib/devices-data"

const COLORS = { normal: "var(--success)", warning: "var(--warning)", critical: "var(--critical)", unknown: "var(--muted-foreground)" }

interface Props { device: Device; history: SpecificDevice[]; live?: boolean }

export function TelemetryDashboard({ device, history, live = false }: Props) {
  const metric = device.ultimaMetrica
  const samples = useMemo(() => buildDashboardSamples(device, history), [device, history])
  const offline = device.estado === "offline"
  const current = metric
  const totalRam = current?.memRamTotalMb
  const usedRam = ramUsedMb(totalRam, current?.memRamDisponibleMb)
  const storageTotal = current?.almacenamientoTotalMb
  const storageAvailable = current?.almacenamientoDisponibleMb

  return (
    <section className={cn("min-w-0 space-y-4 transition-opacity", offline && "telemetry-offline")} aria-label={`Panel de gráficos de ${device.nombre}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{live && metric ? "Lectura en vivo" : "Última telemetría registrada"}</p><h2 className="mt-1 break-words text-xl font-semibold">Pulso de {device.nombre}</h2></div>
        {offline && <span className="offline-badge max-w-full whitespace-normal break-words" role="status">Offline — Último reporte: {new Date(metric?.receivedAt || device.lastSeen).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Activity} label="CPU" value={current?.cpuPct} previous={samples.at(-2)?.cpuPct} level={levelFor(current?.cpuPct, 70, 85)} />
        <Kpi icon={BrainCircuit} label="Procesador IA" value={current?.aiProcessorPct} previous={samples.at(-2)?.aiProcessorPct} level={levelFor(current?.aiProcessorPct, 70, 85)} />
        <Kpi icon={MemoryStick} label="RAM libre" value={current?.memRamDisponibleMb} previous={samples.at(-2)?.memRamDisponibleMb} suffix=" MB" level={levelFor(percent(usedRam, totalRam), 70, 85)} />
        <Kpi icon={Thermometer} label="Temperatura SoC" value={current?.tempChip} previous={samples.at(-2)?.tempChip} suffix=" °C" level={levelFor(current?.tempChip, 70, 80)} criticalPulse />
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.35fr_1fr] [&>*]:min-w-0">
        <ChartCard title="Carga del sistema" subtitle="CPU vs procesador IA · últimos reportes"><LineChart rows={samples} /></ChartCard>
        <ChartCard title="Temperatura SoC" subtitle="Umbrales térmicos de operación"><TemperatureChart rows={samples} /></ChartCard>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <ChartCard title="Memoria RAM" subtitle={typeof totalRam === "number" && Number.isFinite(totalRam) && totalRam > 0 ? `${totalRam.toLocaleString("es-AR")} MB totales · libre y usada` : "Capacidad total no disponible"}><RamChart rows={samples} total={totalRam} used={usedRam} /></ChartCard>
        {Number.isFinite(storageTotal) && Number.isFinite(storageAvailable) && storageTotal! > 0 && storageAvailable! >= 0 && storageAvailable! <= storageTotal! ? <DiskCard available={storageAvailable!} total={storageTotal!} /> : <div className="flex min-h-32 items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-5 text-sm text-muted-foreground"><HardDrive className="size-5" /> Almacenamiento no disponible en este reporte.</div>}
      </div>
    </section>
  )
}

function Kpi({ icon: Icon, label, value, previous, suffix = "%", level, criticalPulse }: { icon: typeof Activity; label: string; value?: number; previous?: number; suffix?: string; level: "normal" | "warning" | "critical" | "unknown"; criticalPulse?: boolean }) {
  const delta = typeof value === "number" && Number.isFinite(value) && typeof previous === "number" && Number.isFinite(previous) ? value - previous : undefined
  return <article className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", level === "critical" && criticalPulse && "critical-pulse")}><div className="flex items-center justify-between"><span className="flex size-8 items-center justify-center rounded-lg" style={{ color: COLORS[level], backgroundColor: `${COLORS[level]}18` }}><Icon className="size-4" /></span><span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS[level] }}>{level === "normal" ? "Normal" : level === "warning" ? "Atención" : level === "critical" ? "Crítico" : "Sin datos"}</span></div><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{formatSnapshot(value, suffix)}</p><p className="mt-1 text-[11px] text-muted-foreground">{delta === undefined ? "Sin muestra previa" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("es-AR", { maximumFractionDigits: 1 })}${suffix} vs. anterior`}</p></article>
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 min-w-0"><h3 className="font-semibold">{title}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{subtitle}</p></div>{children}</article> }
function svgPoints(values: Array<number | undefined>, width: number, height: number, max = 100) { return values.map((value, i) => typeof value === "number" && Number.isFinite(value) ? `${(i / Math.max(1, values.length - 1)) * width},${height - (Math.max(0, value) / max) * height}` : "").filter(Boolean).join(" ") }

function LineChart({ rows }: { rows: SpecificDevice[] }) { const [hover, setHover] = useState<number | null>(null); const w=640,h=190; const index=hover ?? rows.length-1; return <div className="relative"><div className="mb-2 flex gap-4 text-[11px] text-muted-foreground"><Legend color="var(--series-cpu)" text="CPU" /><Legend color="var(--series-ai)" text="IA" /></div><svg viewBox={`0 0 ${w} ${h}`} className="chart-svg" role="img" aria-label="Gráfico de CPU y procesador IA de cero a cien por ciento" onMouseLeave={()=>setHover(null)} onMouseMove={e=>setHover(Math.min(rows.length-1, Math.max(0, Math.round((e.nativeEvent.offsetX / e.currentTarget.clientWidth) * (rows.length-1)))))}><Grid /><polyline fill="none" stroke="var(--series-cpu)" strokeWidth="3" points={svgPoints(rows.map(r=>r.cpuPct),w,h)} /><polyline fill="none" stroke="var(--series-ai)" strokeWidth="3" points={svgPoints(rows.map(r=>r.aiProcessorPct),w,h)} />{hover !== null && <line x1={(index/Math.max(1,rows.length-1))*w} x2={(index/Math.max(1,rows.length-1))*w} y1="0" y2={h} stroke="currentColor" strokeDasharray="3 4" opacity=".35" />}</svg>{rows[index] && <Tooltip row={rows[index]} fields={[["CPU", rows[index].cpuPct, "var(--series-cpu)"],["IA",rows[index].aiProcessorPct,"var(--series-ai)"]]} />}</div> }
function TemperatureChart({ rows }: { rows: SpecificDevice[] }) { const w=640,h=190; return <div><svg viewBox={`0 0 ${w} ${h}`} className="chart-svg" role="img" aria-label="Historial de temperatura con referencias de setenta y ochenta grados Celsius"><Grid /><line x1="0" x2={w} y1={h-70/100*h} y2={h-70/100*h} stroke="var(--warning)" strokeDasharray="6 5" /><line x1="0" x2={w} y1={h-80/100*h} y2={h-80/100*h} stroke="var(--critical)" strokeDasharray="6 5" /><polyline fill="none" stroke="var(--critical)" strokeWidth="3" points={svgPoints(rows.map(r=>r.tempChip),w,h,100)} /></svg><div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>70 °C · atención</span><span>80 °C · crítico</span></div></div> }
function RamChart({ rows, total, used }: { rows: SpecificDevice[]; total?: number; used?: number }) {
  if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">RAM total no disponible en este servidor.</div>
  const free = rows.map((row) => percent(row.memRamDisponibleMb, total))
  const freeLabel = typeof used === "number" && Number.isFinite(used) ? formatSnapshot(total - used, " MB") : "Sin datos"
  return <div><svg viewBox="0 0 640 190" className="chart-svg" role="img" aria-label="Área apilada de RAM usada y libre"><Grid /><polyline fill="none" stroke="var(--series-memory)" strokeWidth="3" points={svgPoints(free, 640, 190)} /></svg><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><Legend color="var(--series-memory)" text={`${formatSnapshot(used, " MB")} usada`} /><Legend color="var(--series-memory)" text={`${freeLabel} libre`} /></div></div>
}
function DiskCard({ available, total }: { available: number; total: number }) { const used=total-available; const pct=percent(used,total); return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><h3 className="font-semibold">Almacenamiento</h3><p className="mt-1 text-xs text-muted-foreground">Capacidad del dispositivo</p></div><HardDrive className="size-5 text-primary" /></div><div className="mt-6 h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={pct === undefined ? undefined : { width: `${pct}%` }} /></div><div className="mt-3 flex justify-between text-xs"><span>{used.toLocaleString("es-AR")} MB usados</span><span className="text-muted-foreground">{available.toLocaleString("es-AR")} MB disponibles · {typeof pct === "number" ? pct.toFixed(0) : "Sin datos"}%</span></div></article> }
function Grid(){return <g stroke="currentColor" opacity=".09"><line x1="0" x2="640" y1="0" y2="0"/><line x1="0" x2="640" y1="95" y2="95"/><line x1="0" x2="640" y1="190" y2="190"/></g>}
function Legend({color,text}:{color:string;text:string}){return <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{backgroundColor:color}} />{text}</span>}
function Tooltip({row,fields}:{row:SpecificDevice;fields:[string,number | null | undefined,string][]}){return <div className="pointer-events-none absolute right-2 top-5 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg"><p className="mb-1 text-muted-foreground">{new Date(row.receivedAt).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</p>{fields.map(([label,value,color])=><p key={label} className="flex gap-2"><i className="size-2 self-center rounded-full" style={{backgroundColor:color}} />{label} <strong>{formatSnapshot(value === null ? undefined : value)}</strong></p>)}</div>}
