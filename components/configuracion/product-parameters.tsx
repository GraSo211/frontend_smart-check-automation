"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import ProductForm, { type ProductFormResult } from "@/components/configuracion/product-form"
import { updateProducto } from "@/actions/api"
import { hasMinRole, type UserRole } from "@/lib/auth"
import type { Producto, ProductoRequest } from "@/lib/production-data"

interface ProductParametersProps {
  producto: Producto | null
  userRole?: UserRole
}

// Panel de edición del producto seleccionado: nombre + parámetros de control en
// un único formulario. Un Operario lo ve bloqueado (sólo lectura).
export default function ProductParameters({ producto, userRole = "Operario" }: ProductParametersProps) {
  if (!producto) return <EmptyState />

  return <ParametersForm key={producto.id} producto={producto} userRole={userRole} />
}

function ParametersForm({ producto, userRole }: { producto: Producto; userRole: UserRole }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Solo Supervisores y Administradores pueden editar
  const canEdit = hasMinRole(userRole, "Supervisor")

  const handleSubmit = async (request: ProductoRequest): Promise<ProductFormResult> => {
    if (!canEdit) {
      return { ok: false, errors: ["No tenés permisos para modificar este producto."] }
    }
    setPending(true)
    setFieldErrors({})
    try {
      const result = await updateProducto(producto.id, request)
      if (result.ok) {
        toast.success("Parámetros actualizados.")
        router.refresh()
        return { ok: true }
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setFieldErrors(result.fieldErrors)
        return { ok: false, errors: [] }
      }
      return {
        ok: false,
        errors: result.errors?.length
          ? result.errors
          : ["No se pudieron actualizar los parámetros."],
      }
    } catch (error) {
      return {
        ok: false,
        errors: [error instanceof Error ? error.message : "No se pudieron actualizar los parámetros."],
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Parámetros del producto</CardTitle>
            <CardDescription>
              Valores recomendados para {producto.nombre}. Editalos y guardá para que las corridas
              usen los nuevos rangos.
            </CardDescription>
          </div>
          {!canEdit && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning ring-1 ring-warning/20">
              <Lock className="size-3.5" aria-hidden="true" />
              Solo Lectura (Bloqueado)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
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
              <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-destructive">
                Acceso Denegado — Restricción de Permisos (RBAC)
              </h3>
              <p className="text-sm leading-relaxed text-destructive/90">
                Estás conectado como <span className="font-bold underline">{userRole}</span>. No
                poseés los privilegios requeridos para modificar los rangos operativos ni guardar
                variables del horno. Todos los controles han sido deshabilitados por seguridad.
              </p>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-success"
          >
            <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
            <p className="text-sm font-medium">
              Permisos Activos (<span className="font-bold">{userRole}</span>): Tenés autorización
              completa para modificar y ajustar las variables operativas del horno.
            </p>
          </div>
        )}

        <ProductForm
          key={producto.updatedAt ?? producto.id}
          mode="edit"
          initial={producto}
          pending={pending}
          disabled={!canEdit}
          serverErrors={fieldErrors}
          onSubmit={handleSubmit}
          showDirtyHint
          className="mt-6"
        />
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <SlidersHorizontal className="size-6 text-primary" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Sin producto seleccionado</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Elegí un producto de la grilla para ver y editar sus parámetros recomendados de horno y
            cinta.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
