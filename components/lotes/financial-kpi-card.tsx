"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Banknote, ChevronRight, Info, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatARS, formatNumber } from "@/lib/format"
import type { KPIFinancieroData } from "@/types/kpi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FinancialKpiCardProps {
  data: KPIFinancieroData
  className?: string
}

export function FinancialKpiCard({ data, className }: FinancialKpiCardProps) {
  const [open, setOpen] = useState(false)

  const hasMissingCosts = data.tieneCostosFaltantes || data.productosSinCostoCount > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
          hasMissingCosts && "border-amber-500/30 bg-amber-500/[0.02]",
          className,
        )}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Impacto económico por mermas
              </p>
              {hasMissingCosts && (
                <TooltipProvider delay={100}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span
                          className="inline-flex cursor-help items-center text-amber-600 dark:text-amber-400"
                          aria-label="Advertencia de cálculo parcial"
                        />
                      }
                    >
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs font-normal">
                      {data.advertencia ||
                        "Cálculo parcial: se omitieron lotes o productos sin costo de fabricación configurado."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Primary Value */}
            <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {formatARS(data.totalImpactoEconomico)}
            </p>
          </div>

          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
              hasMissingCosts
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            )}
          >
            <Banknote className="size-5" aria-hidden="true" />
          </span>
        </div>

        {/* Subtext and Status Badge */}
        <div className="mt-3 flex flex-col gap-2 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {formatNumber(data.totalMermasUnidades)}
              </span>{" "}
              unidades defectuosas
            </p>

            <DialogTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                />
              }
            >
              <span>Detalles</span>
              <ChevronRight className="size-3" aria-hidden="true" />
            </DialogTrigger>
          </div>

          {hasMissingCosts && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {data.productosSinCostoCount === 1
                  ? "1 producto sin costo"
                  : `${data.productosSinCostoCount} productos sin costo`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog with Detailed Breakdown */}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Banknote className="size-4" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle>Desglose de Impacto Económico por Mermas</DialogTitle>
              <DialogDescription>
                Cálculo valorizado en pesos argentinos (ARS) según el costo de fabricación historizado
                de cada lote.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Summary metrics header */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Pérdida Total</p>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatARS(data.totalImpactoEconomico)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Mermas Totales</p>
            <p className="font-mono text-lg font-semibold text-foreground">
              {formatNumber(data.totalMermasUnidades)} un.
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Moneda / Lotes</p>
            <p className="font-mono text-sm font-medium text-foreground">
              {data.moneda} · {data.totalLotes} lotes
            </p>
          </div>
        </div>

        {/* Warning if missing costs */}
        {hasMissingCosts && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Advertencia de costos no configurados</p>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {data.advertencia ||
                    "Existen variedades de producto con mermas pero sin costo unitario asignado ($0 o no configurado). El monto total no incluye estas piezas para evitar subestimaciones."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown table */}
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted text-[11px] uppercase font-semibold text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3 py-2">Variedad</th>
                <th className="px-3 py-2 text-right">Mermas</th>
                <th className="px-3 py-2 text-right">Costo Unitario</th>
                <th className="px-3 py-2 text-right">Impacto Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.desgloseProductos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    No hay registros de producción en el período seleccionado.
                  </td>
                </tr>
              ) : (
                data.desgloseProductos.map((p) => (
                  <tr key={p.productoId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      <div className="flex flex-col">
                        <span>{p.productoNombre}</span>
                        {!p.tieneCostoConfigurado ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                            <AlertTriangle className="size-2.5" /> Costo no configurado
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {p.lotesTotales} {p.lotesTotales === 1 ? "lote" : "lotes"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">
                      {formatNumber(p.totalMermasUnidades)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {p.tieneCostoConfigurado && p.costoUnitarioPromedio !== null ? (
                        formatARS(p.costoUnitarioPromedio)
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Sin costo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                      {p.tieneCostoConfigurado ? (
                        formatARS(p.impactoEconomico)
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/configuracion"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Configurar costos de productos</span>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
