"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import ProductGrid from "@/components/configuracion/product-card"
import ProductForm, { type ProductFormResult } from "@/components/configuracion/product-form"
import { createProducto, deleteProducto, updateProducto } from "@/actions/api"
import { hasMinRole, type UserRole } from "@/lib/auth"
import type { Producto, ProductoRequest } from "@/lib/production-data"

interface ProductManagementProps {
  initialProductos: Producto[]
  selectedId: string | null
  userRole: UserRole
  initialError?: string | null
}

type MutationResult = {
  ok: boolean
  errors?: string[]
  code?: string
  fieldErrors?: Record<string, string>
}

const PRODUCT_ERROR_BY_CODE: Record<string, string> = {
  duplicate_name: "Ya existe un producto con ese nombre",
  producto_duplicado: "Ya existe un producto con ese nombre",
  product_not_found: "El producto no existe",
  producto_no_encontrado: "El producto no existe",
  forbidden: "Se requiere rol Supervisor o Administrador",
  human_auth_required: "Se requiere rol Supervisor o Administrador",
}

function errorMessages(result: MutationResult, fallback: string): string[] {
  if (result.code && PRODUCT_ERROR_BY_CODE[result.code]) {
    return [PRODUCT_ERROR_BY_CODE[result.code]]
  }
  const joined = result.errors?.map((message) => message.trim()).filter(Boolean)
  return joined && joined.length > 0 ? joined : [fallback]
}

/** Extrae los parámetros de control de un producto para el body de PUT. */
function controlParams(producto: Producto): Omit<ProductoRequest, "nombre"> {
  const params: Omit<ProductoRequest, "nombre"> = {
    pesoReferenciaKg: producto.pesoReferenciaKg,
    toleranciaPesoPct: producto.toleranciaPesoPct,
    dimensionBaseCm: producto.dimensionBaseCm,
    toleranciaDimensionCm: producto.toleranciaDimensionCm,
    tempMin: producto.tempMin,
    tempMax: producto.tempMax,
    velocidadCintaMin: producto.velocidadCintaMin,
    velocidadCintaMax: producto.velocidadCintaMax,
    capacidadNominalKgH: producto.capacidadNominalKgH ?? null,
  }
  // Setpoints opcionales: se omiten cuando el producto no los tiene.
  if (producto.tempSetpoint != null) params.tempSetpoint = producto.tempSetpoint
  if (producto.velocidadCintaSetpoint != null) {
    params.velocidadCintaSetpoint = producto.velocidadCintaSetpoint
  }
  return params
}

/**
 * Orquesta el CRUD de productos: grid + diálogos de alta, edición de nombre y
 * desactivación + toasts + RBAC. Actúa como contraparte de `SectorManagement`.
 */
export function ProductManagement({
  initialProductos,
  selectedId,
  userRole,
  initialError = null,
}: ProductManagementProps) {
  const router = useRouter()
  const canManage = hasMinRole(userRole, "Supervisor")

  // Sin UI optimista: la lista proviene de las props del server component y se
  // reconcilia con `router.refresh()` después de cada mutación.
  const productos = initialProductos

  const [hideRetired, setHideRetired] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({})

  const [editName, setEditName] = useState<Producto | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  const [deleting, setDeleting] = useState<Producto | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const visibleProductos = useMemo(
    () => (hideRetired ? productos.filter((producto) => producto.activo) : productos),
    [hideRetired, productos],
  )
  const inactiveCount = useMemo(
    () => productos.filter((producto) => !producto.activo).length,
    [productos],
  )
  const allRetired =
    hideRetired && productos.length > 0 && productos.every((producto) => !producto.activo)

  const openCreate = () => {
    if (!canManage) return
    setCreateFieldErrors({})
    setCreateOpen(true)
  }

  const openEditName = (producto: Producto) => {
    if (!canManage) return
    setEditName(producto)
    setRenameValue(producto.nombre)
    setRenameError(null)
  }

  const openDelete = (producto: Producto) => {
    if (!canManage) return
    setDeleting(producto)
  }

  const handleCreate = async (request: ProductoRequest): Promise<ProductFormResult> => {
    setIsCreating(true)
    setCreateFieldErrors({})
    try {
      const result = await createProducto(request)
      if (result.ok) {
        toast.success("Producto creado.")
        setCreateOpen(false)
        router.push(`/configuracion?productoId=${encodeURIComponent(result.data.id)}`)
        router.refresh()
        return { ok: true }
      }
      // 422 con mapa por campo: se muestra inline en el formulario.
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setCreateFieldErrors(result.fieldErrors)
        toast.error("Revisá los datos del producto", {
          description: Object.values(result.fieldErrors).join(" · "),
        })
        return { ok: false, errors: [] }
      }
      const messages = errorMessages(result, "No se pudo crear el producto.")
      toast.error("No se pudo crear el producto", { description: messages.join(" · ") })
      return { ok: false, errors: messages }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el producto."
      toast.error("No se pudo crear el producto", { description: message })
      return { ok: false, errors: [message] }
    } finally {
      setIsCreating(false)
    }
  }

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editName || isRenaming) return

    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenameError("El nombre es obligatorio.")
      return
    }
    if (trimmed.length < 2) {
      setRenameError("El nombre debe tener al menos 2 caracteres.")
      return
    }

    setIsRenaming(true)
    try {
      const result = await updateProducto(editName.id, {
        ...controlParams(editName),
        nombre: trimmed,
      })
      if (result.ok) {
        toast.success("Nombre actualizado.")
        setEditName(null)
        router.refresh()
      } else {
        const serverNombreError = result.fieldErrors?.nombre
        setRenameError(
          serverNombreError ?? errorMessages(result, "No se pudo actualizar el nombre.").join(" · "),
        )
      }
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "No se pudo actualizar el nombre.")
    } finally {
      setIsRenaming(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    try {
      const result = await deleteProducto(deleting.id)
      if (result.ok) {
        toast.success("Producto desactivado.", { duration: 4000 })
        setDeleting(null)
        router.refresh()
      } else {
        toast.error("No se pudo desactivar el producto", {
          description: errorMessages(result, "No se pudo desactivar el producto.").join(" · "),
        })
      }
    } catch (error) {
      toast.error("No se pudo desactivar el producto", {
        description: error instanceof Error ? error.message : "No se pudo desactivar el producto.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const counterLabel = initialError
    ? "— No disponible"
    : hideRetired
      ? `${visibleProductos.length} de ${productos.length}`
      : `${productos.length} ${productos.length === 1 ? "producto" : "productos"}`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="productos-heading" className="text-base font-semibold text-foreground">
            Productos
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Elegí un producto para configurar sus parámetros.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {counterLabel}
          </span>

          <div className="flex items-center gap-2">
            <Switch
              id="ocultar-retirados"
              checked={hideRetired}
              onCheckedChange={setHideRetired}
              disabled={Boolean(initialError)}
            />
            <Label
              htmlFor="ocultar-retirados"
              className="text-xs font-medium text-muted-foreground"
            >
              Ocultar retirados
              {inactiveCount > 0 ? ` (${inactiveCount})` : ""}
            </Label>
          </div>

          {canManage && (
            <Button
              type="button"
              onClick={openCreate}
              disabled={Boolean(initialError)}
              className="w-full gap-2 sm:w-auto"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuevo producto
            </Button>
          )}
        </div>
      </div>

      <ProductGrid
        productos={visibleProductos}
        selectedId={selectedId}
        error={initialError}
        canManage={canManage}
        onCreate={openCreate}
        onEdit={openEditName}
        onDelete={openDelete}
        allRetired={allRetired}
        onShowRetired={() => setHideRetired(false)}
      />

      {/* Diálogo: nuevo producto */}
      {canManage && (
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (isCreating) return
            setCreateOpen(open)
            if (!open) setCreateFieldErrors({})
          }}
        >
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg font-bold text-foreground">
                Nuevo producto
              </DialogTitle>
              <DialogDescription>
                Definí el nombre y los parámetros de control del producto.
              </DialogDescription>
            </DialogHeader>
            <ProductForm
              mode="create"
              pending={isCreating}
              serverErrors={createFieldErrors}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo: editar nombre */}
      {canManage && (
        <Dialog
          open={Boolean(editName)}
          onOpenChange={(open) => {
            if (!open && !isRenaming) setEditName(null)
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg font-bold text-foreground">
                Editar nombre
              </DialogTitle>
              <DialogDescription>Actualizá el nombre del producto.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRename} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="producto-nombre-edit">Nombre</Label>
                <Input
                  id="producto-nombre-edit"
                  value={renameValue}
                  autoFocus
                  aria-invalid={renameError ? true : undefined}
                  aria-describedby={renameError ? "producto-nombre-edit-error" : undefined}
                  onChange={(event) => {
                    setRenameValue(event.target.value)
                    if (renameError) setRenameError(null)
                  }}
                />
                {renameError && (
                  <p
                    id="producto-nombre-edit-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {renameError}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditName(null)} disabled={isRenaming}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isRenaming} className="gap-2">
                  {isRenaming ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Guardando…
                    </>
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo: desactivar producto */}
      {canManage && (
        <Dialog
          open={Boolean(deleting)}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeleting(null)
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <TriangleAlert className="size-5" aria-hidden="true" />
              </span>
              <DialogTitle className="font-heading text-lg font-bold text-foreground">
                Desactivar producto
              </DialogTitle>
              <DialogDescription>
                {deleting
                  ? `¿Desactivás "${deleting.nombre}"? No se va a poder seleccionar para nuevas corridas. Esta acción se puede revertir desde administración.`
                  : "Confirmá la desactivación del producto."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={isDeleting} autoFocus>
                    Cancelar
                  </Button>
                }
              />
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Desactivando…
                  </>
                ) : (
                  "Desactivar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
