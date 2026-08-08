"use client"

import { useState } from "react"
import { ShieldAlert, ShieldCheck, Lock, Save, CheckCircle2, Sliders, AlertTriangle } from "lucide-react"
import { hasMinRole, type UserRole } from "@/lib/auth"
import { Button } from "@/components/ui/button"

interface OvenConfigPanelProps {
  userRole?: UserRole
}

export function OvenConfigPanel({ userRole = "Operario" }: OvenConfigPanelProps) {
  // Solo Supervisores y Administradores pueden editar
  const canEdit = hasMinRole(userRole, "Supervisor")

  // Estado local para los parámetros del horno
  const [tempMinH1, setTempMinH1] = useState("180")
  const [tempMaxH1, setTempMaxH1] = useState("230")
  const [tempMinH2, setTempMinH2] = useState("185")
  const [tempMaxH2, setTempMaxH2] = useState("235")
  const [velCinta, setVelCinta] = useState("12.5")
  const [limiteQuemados, setLimiteQuemados] = useState("5.0")

  // Toast / Alerta de estado
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    if (!canEdit) {
      setToastMessage({
        type: "error",
        text: "Acceso Denegado: Tu rol de Operario no tiene permisos para guardar cambios en los parámetros del horno.",
      })
      return
    }

    setToastMessage({
      type: "success",
      text: "Parámetros del horno actualizados correctamente en el sistema.",
    })

    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  const handleUnauthorizedClick = () => {
    if (!canEdit) {
      setToastMessage({
        type: "error",
        text: "Acceso Denegado: Los campos de configuración están bloqueados para el rol Operario.",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Banner de Alerta RBAC (Toast o Banner destacado) ─── */}
      {!canEdit ? (
        <div
          role="alert"
          id="banner-acceso-denegado"
          className="flex items-start gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive shadow-sm"
        >
          <div className="rounded-lg bg-destructive/15 p-2 ring-1 ring-destructive/30">
            <ShieldAlert className="size-6 shrink-0 text-destructive" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base tracking-tight text-destructive flex items-center gap-2">
              Acceso Denegado — Restricción de Permisos (RBAC)
            </h3>
            <p className="text-sm leading-relaxed text-destructive/90">
              Estás conectado como <span className="font-bold underline">{userRole}</span>. No poseés los privilegios requeridos para modificar los rangos operativos ni guardar variables del horno. Todos los controles han sido deshabilitados por seguridad.
            </p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300"
        >
          <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium">
            Permisos Activos (<span className="font-bold">{userRole}</span>): Tenés autorización completa para modificar y ajustar las variables operativas del horno.
          </p>
        </div>
      )}

      {/* Toast flotante temporal */}
      {toastMessage && (
        <div
          role="alert"
          className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all ${
            toastMessage.type === "error"
              ? "border-destructive/40 bg-destructive/90 text-destructive-foreground"
              : "border-emerald-500/40 bg-emerald-950/90 text-emerald-100"
          }`}
        >
          {toastMessage.type === "error" ? (
            <AlertTriangle className="size-5 shrink-0 text-amber-300" />
          ) : (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-300" />
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Formulario de Configuración del Horno ─── */}
      <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-1 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">Parámetros Operativos de Temperatura y Cinta</h2>
          </div>
          {!canEdit && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Lock className="size-3.5" aria-hidden="true" />
              Solo Lectura (Bloqueado)
            </span>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Horno 1 */}
          <div className="space-y-4 rounded-lg border border-border/80 p-4 bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Zona Horno 1 (H1)</span>
              {!canEdit && <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="temp-min-h1" className="block text-xs font-medium text-muted-foreground mb-1">
                  Temp Mínima (°C)
                </label>
                <input
                  id="temp-min-h1"
                  type="number"
                  disabled={!canEdit}
                  value={tempMinH1}
                  onChange={(e) => setTempMinH1(e.target.value)}
                  onClick={handleUnauthorizedClick}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted"
                />
              </div>
              <div>
                <label htmlFor="temp-max-h1" className="block text-xs font-medium text-muted-foreground mb-1">
                  Temp Máxima (°C)
                </label>
                <input
                  id="temp-max-h1"
                  type="number"
                  disabled={!canEdit}
                  value={tempMaxH1}
                  onChange={(e) => setTempMaxH1(e.target.value)}
                  onClick={handleUnauthorizedClick}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Horno 2 */}
          <div className="space-y-4 rounded-lg border border-border/80 p-4 bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Zona Horno 2 (H2)</span>
              {!canEdit && <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="temp-min-h2" className="block text-xs font-medium text-muted-foreground mb-1">
                  Temp Mínima (°C)
                </label>
                <input
                  id="temp-min-h2"
                  type="number"
                  disabled={!canEdit}
                  value={tempMinH2}
                  onChange={(e) => setTempMinH2(e.target.value)}
                  onClick={handleUnauthorizedClick}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted"
                />
              </div>
              <div>
                <label htmlFor="temp-max-h2" className="block text-xs font-medium text-muted-foreground mb-1">
                  Temp Máxima (°C)
                </label>
                <input
                  id="temp-max-h2"
                  type="number"
                  disabled={!canEdit}
                  value={tempMaxH2}
                  onChange={(e) => setTempMaxH2(e.target.value)}
                  onClick={handleUnauthorizedClick}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Velocidad de Cinta */}
          <div className="space-y-4 rounded-lg border border-border/80 p-4 bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Velocidad de Cinta Transportadora</span>
              {!canEdit && <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            </h3>
            <div>
              <label htmlFor="vel-cinta" className="block text-xs font-medium text-muted-foreground mb-1">
                Velocidad Objetivo (m/min)
              </label>
              <input
                id="vel-cinta"
                type="number"
                step="0.1"
                disabled={!canEdit}
                value={velCinta}
                onChange={(e) => setVelCinta(e.target.value)}
                onClick={handleUnauthorizedClick}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted"
              />
            </div>
          </div>

          {/* Límite de Alerta de Quemados */}
          <div className="space-y-4 rounded-lg border border-border/80 p-4 bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Umbral de Alerta de Merma</span>
              {!canEdit && <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            </h3>
            <div>
              <label htmlFor="limite-quemados" className="block text-xs font-medium text-muted-foreground mb-1">
                % Máximo de Quemados Permitido
              </label>
              <input
                id="limite-quemados"
                type="number"
                step="0.5"
                disabled={!canEdit}
                value={limiteQuemados}
                onChange={(e) => setLimiteQuemados(e.target.value)}
                onClick={handleUnauthorizedClick}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted"
              />
            </div>
          </div>
        </div>

        {/* ─── Botones de Acción ─── */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button
            id="btn-guardar-config-horno"
            type="submit"
            disabled={!canEdit}
            className="gap-2"
          >
            {canEdit ? (
              <Save className="size-4" aria-hidden="true" />
            ) : (
              <Lock className="size-4" aria-hidden="true" />
            )}
            <span>{canEdit ? "Guardar Parámetros" : "Guardar Bloqueado"}</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
