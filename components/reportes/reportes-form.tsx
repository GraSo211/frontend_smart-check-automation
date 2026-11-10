"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Download,
  FileDown,
  FileJson,
  FileText,
  Filter,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { SectorSelect } from "@/components/shared/sector-select"
import type { Producto, Sector } from "@/lib/production-data"
import {
  type AppliedFilters,
  buildAlertasDownloadHref,
  buildDownloadHref,
  buildReportesQuery,
  buildTrazabilidadCsvHref,
  buildTrazabilidadDownloadHref,
  getDefaultReporteDateRange,
  isLoteUUID,
  TURNOS,
} from "@/lib/reportes"
import type { TrazabilidadDataset } from "@/lib/reportes-trazabilidad-csv"

const TRAZABILIDAD_DATASETS: { value: TrazabilidadDataset; label: string }[] = [
  { value: "proceso", label: "Métricas" },
  { value: "alertas", label: "Alertas" },
  { value: "decisiones", label: "Decisiones" },
  { value: "consignas", label: "Consignas" },
]

interface ReportesFormProps {
  appliedFilters: AppliedFilters
  sectores: Sector[]
  productos: Producto[]
  catalogErrors: { sectores?: string; productos?: string }
  lotesTotal?: number | null
}

export function ReportesForm({
  appliedFilters,
  sectores,
  productos,
  catalogErrors,
  lotesTotal,
}: ReportesFormProps) {
  const router = useRouter()
  const [desde, setDesde] = useState(appliedFilters.desde)
  const [hasta, setHasta] = useState(appliedFilters.hasta)
  const [sectorId, setSectorId] = useState(appliedFilters.sectorId)
  const [productoId, setProductoId] = useState(appliedFilters.productoId)
  const [turno, setTurno] = useState(appliedFilters.turno)
  const [formError, setFormError] = useState<string | null>(null)
  const [loteId, setLoteId] = useState("")
  const [trazabilidadDataset, setTrazabilidadDataset] =
    useState<TrazabilidadDataset>("proceso")

  const defaults = getDefaultReporteDateRange()
  const hasFilters =
    appliedFilters.sectorId !== "" ||
    appliedFilters.productoId !== "" ||
    appliedFilters.turno !== "" ||
    appliedFilters.desde !== defaults.desde ||
    appliedFilters.hasta !== defaults.hasta

  function applyFilters() {
    if (!desde || !hasta) {
      setFormError("Completá las fechas desde y hasta.")
      return
    }
    if (desde > hasta) {
      setFormError("La fecha desde no puede ser posterior a la fecha hasta.")
      return
    }
    const days =
      (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) /
        86_400_000 +
      1
    if (days > 366) {
      setFormError("El rango máximo es de 366 días.")
      return
    }
    setFormError(null)
    router.push(
      `/reportes?${buildReportesQuery({
        desde,
        hasta,
        sectorId,
        productoId,
        turno,
      })}`,
    )
  }

  function clearFilters() {
    router.push("/reportes")
  }

  const csvHref = buildDownloadHref(appliedFilters, "csv", ",")
  const csvExcelHref = buildDownloadHref(appliedFilters, "csv", ";")
  const jsonHref = buildDownloadHref(appliedFilters, "json")
  const pdfHref = buildDownloadHref(appliedFilters, "pdf")
  const alertasHref = buildAlertasDownloadHref(appliedFilters)

  return (
    <div className="space-y-5">
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault()
          applyFilters()
        }}
      >
        <div>
          <label
            htmlFor="reportes-desde"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Desde
          </label>
          <input
            id="reportes-desde"
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div>
          <label
            htmlFor="reportes-hasta"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Hasta
          </label>
          <input
            id="reportes-hasta"
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <SectorSelect
          id="reportes-sector"
          label="Sector"
          value={sectorId}
          onChange={setSectorId}
          sectores={sectores}
          allowEmpty
          emptyOptionLabel="Todos los sectores"
          disabled={sectores.length === 0}
          error={catalogErrors.sectores ?? null}
        />

        <div>
          <label
            htmlFor="reportes-producto"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Producto
          </label>
          <select
            id="reportes-producto"
            value={productoId}
            onChange={(event) => setProductoId(event.target.value)}
            disabled={productos.length === 0}
            className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Todos los productos</option>
            {productos.map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.nombre}
              </option>
            ))}
            {productos.length === 0 ? (
              <option value="">Sin productos disponibles</option>
            ) : null}
          </select>
          {catalogErrors.productos ? (
            <p className="mt-1 text-xs text-destructive">
              {catalogErrors.productos}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="reportes-turno"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Turno
          </label>
          <select
            id="reportes-turno"
            value={turno}
            onChange={(event) => setTurno(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Todos los turnos</option>
            {TURNOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">
            <Search className="size-4" aria-hidden="true" />
            Aplicar filtros
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Limpiar
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                hasFilters
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary/70 text-muted-foreground"
              }`}
            >
              <Filter className="size-3.5" aria-hidden="true" />
              {hasFilters ? "Filtros activos" : "Sin filtros"}
            </span>
          </div>
        </div>
        {formError ? (
          <p
            role="alert"
            className="text-xs font-medium text-destructive sm:col-span-2 lg:col-span-4"
          >
            {formError}
          </p>
        ) : null}
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Descargas</span>
          {" · "}
          {lotesTotal === null || lotesTotal === undefined
            ? "Cantidad de lotes no disponible"
            : `${lotesTotal.toLocaleString("es-AR")} lotes en el período`}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={csvHref}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FileDown className="size-4" aria-hidden="true" />
            CSV
          </a>
          <a
            href={csvExcelHref}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Download className="size-4" aria-hidden="true" />
            Excel es-AR
          </a>
          <a
            href={jsonHref}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FileJson className="size-4" aria-hidden="true" />
            JSON
          </a>
          <a
            href={alertasHref}
            download
            title="Máximo 5.000 alertas por descarga; el período puede quedar truncado."
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <TriangleAlert className="size-4" aria-hidden="true" />
            Alertas CSV
          </a>
          <a
            href={pdfHref}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FileText className="size-4" aria-hidden="true" />
            PDF
          </a>
        </div>
      </div>

      <div
        className="border-t border-border pt-5"
        aria-label="Trazabilidad por lote"
      >
        <h3 className="mb-3 font-heading text-sm font-semibold text-foreground">
          Trazabilidad por lote
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="reportes-trazabilidad-lote"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              ID del lote
            </label>
            <input
              id="reportes-trazabilidad-lote"
              type="text"
              value={loteId}
              onChange={(event) => setLoteId(event.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              aria-describedby="trazabilidad-ayuda trazabilidad-error"
              className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            <p
              id="trazabilidad-ayuda"
              className="mt-1 text-xs text-muted-foreground"
            >
              Copiá el ID del lote desde el historial o desde el CSV.{" "}
              <Link
                href="/lotes"
                className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ir al historial
              </Link>
            </p>
            {loteId && !isLoteUUID(loteId) ? (
              <p
                id="trazabilidad-error"
                className="mt-1 text-xs font-medium text-destructive"
                aria-live="polite"
              >
                El ID no tiene formato válido.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end">
            {isLoteUUID(loteId) ? (
              <>
                <div>
                  <label
                    htmlFor="reportes-trazabilidad-dataset"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Dataset
                  </label>
                  <select
                    id="reportes-trazabilidad-dataset"
                    value={trazabilidadDataset}
                    onChange={(event) =>
                      setTrazabilidadDataset(
                        event.target.value as TrazabilidadDataset,
                      )
                    }
                    className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-36"
                  >
                    {TRAZABILIDAD_DATASETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <a
                  href={buildTrazabilidadDownloadHref(loteId)}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <FileText className="size-4" aria-hidden="true" />
                  Descargar PDF de trazabilidad
                </a>
                <a
                  href={buildTrazabilidadCsvHref(loteId, trazabilidadDataset)}
                  download
                  aria-label="Descargar CSV de trazabilidad"
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <FileDown className="size-4" aria-hidden="true" />
                  CSV
                </a>
              </>
            ) : (
              <button
                type="button"
                disabled
                aria-describedby="trazabilidad-error"
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
              >
                <FileText className="size-4" aria-hidden="true" />
                Descargar PDF de trazabilidad
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
