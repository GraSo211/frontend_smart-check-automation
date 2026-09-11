'use client'

import { useRef, useState } from 'react'
import { UserDTO, createUserAction, getUsersAction, updateUserAction } from '@/actions/users'
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  Search,
  SearchX,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { applyUserPatch, createUserOperationTracker, filterUsersBySearch } from '@/lib/user-management-state'

interface UserManagementProps {
  initialUsers: UserDTO[]
  initialError?: string | null
}

type UserRole = 'Administrador' | 'Supervisor' | 'Operario'

const roleBadgeStyles: Record<UserDTO['rol'], string> = {
  Administrador: 'border-primary/30 bg-primary/10 text-primary',
  Supervisor: 'border-accent/30 bg-accent/10 text-accent',
  Operario: 'border-border bg-secondary/70 text-muted-foreground',
}

export function UserManagement({ initialUsers, initialError = null }: UserManagementProps) {
  const [users, setUsers] = useState<UserDTO[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const pendingIds = useRef(createUserOperationTracker())
  const [pendingUsers, setPendingUsers] = useState<Set<string>>(new Set())
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Estado del formulario de creación
  const [newEmail, setNewEmail] = useState('')
  const [newNombre, setNewNombre] = useState('')
  const [newRol, setNewRol] = useState<UserRole>('Operario')
  const [newPassword, setNewPassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const creatingRef = useRef(false)
  const [creationError, setCreationError] = useState<string | null>(null)

  const setUserPending = (id: string, pending: boolean) => {
    if (!pending) pendingIds.current.end(id)
    setPendingUsers(pendingIds.current.snapshot())
  }

  // Filtrado
  const filteredUsers = filterUsersBySearch(users, searchTerm)

  // Totales
  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.activo).length
  const adminUsers = users.filter((u) => u.rol === 'Administrador').length

  // Handler: Crear Usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creatingRef.current) return
    creatingRef.current = true
    setCreationError(null)
    setIsCreating(true)
    try {
      const res = await createUserAction({ email: newEmail, nombre: newNombre, rol: newRol, password: newPassword || undefined })
      if (res.ok && res.user) {
        setUsers((prev) => [res.user!, ...prev])
        setIsModalOpen(false)
        setNewEmail('')
        setNewNombre('')
        setNewRol('Operario')
        setNewPassword('')
      } else {
        setCreationError(res.message || 'Error al crear usuario.')
      }
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'Error al crear usuario.')
    } finally {
      creatingRef.current = false
      setIsCreating(false)
    }
  }

  // Handler: Toggle Estado Activo/Inactivo
  const handleToggleStatus = async (user: UserDTO) => {
    if (!pendingIds.current.begin(user.id)) return
    setUserPending(user.id, true)
    setRowErrors((prev) => ({ ...prev, [user.id]: '' }))
    const nextState = !user.activo
    try {
      const res = await updateUserAction(user.id, { activo: nextState })
      if (res.ok) setUsers((prev) => applyUserPatch(prev, user.id, { activo: nextState }))
      else setRowErrors((prev) => ({ ...prev, [user.id]: res.message || 'Error al actualizar el estado del usuario.' }))
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [user.id]: error instanceof Error ? error.message : 'Error al actualizar el estado del usuario.' }))
    } finally {
      setUserPending(user.id, false)
    }
  }

  // Handler: Cambiar Rol
  const handleChangeRole = async (user: UserDTO, newRol: 'Administrador' | 'Supervisor' | 'Operario') => {
    if (!pendingIds.current.begin(user.id)) return
    setUserPending(user.id, true)
    setRowErrors((prev) => ({ ...prev, [user.id]: '' }))
    try {
      const res = await updateUserAction(user.id, { rol: newRol })
      if (res.ok) setUsers((prev) => applyUserPatch(prev, user.id, { rol: newRol }))
      else setRowErrors((prev) => ({ ...prev, [user.id]: res.message || 'Error al actualizar el rol.' }))
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [user.id]: error instanceof Error ? error.message : 'Error al actualizar el rol.' }))
    } finally {
      setUserPending(user.id, false)
    }
  }

  const handleRetry = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const result = await getUsersAction()
      if (result.ok) {
        setUsers(result.users ?? [])
        setErrorMsg(null)
      } else setErrorMsg(result.message || 'No se pudieron consultar los usuarios.')
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudieron consultar los usuarios.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const isLoadError = Boolean(errorMsg)
  const rowErrorMessages = Object.entries(rowErrors).filter(([, message]) => Boolean(message))

  return (
    <div className="space-y-8">
      {/* Alertas */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 ring-1 ring-destructive/30">
            <AlertCircle className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-1 items-center justify-between gap-3"><span className="pt-1">{errorMsg}</span><Button type="button" variant="outline" size="sm" onClick={handleRetry} disabled={isRefreshing}>{isRefreshing ? 'Reintentando…' : 'Reintentar'}</Button></div>
        </div>
      )}
      {rowErrorMessages.map(([id, message]) => (
        <div key={id} role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {message}
        </div>
      ))}

      {/* Resumen */}
      <section aria-labelledby="resumen-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="resumen-heading" className="text-base font-semibold text-foreground">
              Resumen
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Estado general de las cuentas corporativas.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {isLoadError ? '— No disponible' : `${totalUsers} ${totalUsers === 1 ? 'usuario' : 'usuarios'}`}
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Users className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Total Usuarios</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{isLoadError ? '—' : totalUsers}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-success/15 text-success">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Usuarios Activos</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{isLoadError ? '—' : activeUsers}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-info/15 text-info">
              <Shield className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Administradores</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{isLoadError ? '—' : adminUsers}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Listado de usuarios */}
      <section aria-labelledby="listado-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="listado-heading" className="text-base font-semibold text-foreground">
              Listado de Usuarios
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gestioná roles y estado de las cuentas corporativas.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {isLoadError ? '— No disponible' : searchTerm
              ? `${filteredUsers.length} de ${totalUsers}`
              : `${totalUsers} ${totalUsers === 1 ? 'usuario' : 'usuarios'}`}
          </span>
        </div>

        {/* Acciones principales y Búsqueda */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-4 text-sm shadow-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <Dialog open={isModalOpen} onOpenChange={(open) => { if (!creatingRef.current) setIsModalOpen(open) }}>
            <DialogTrigger render={<Button onClick={() => setCreationError(null)} className="gap-2 rounded-xl shadow-md transition-shadow hover:shadow-lg" />}>
              <UserPlus className="size-4" />
              <span>Nuevo Usuario Corporativo</span>
            </DialogTrigger>
        {/* Modal de Creación */}
          <DialogContent className="max-w-md">
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-heading text-lg font-bold text-foreground">
                  Alta de Usuario Corporativo
                </DialogTitle>
                <DialogDescription>Completá los datos para registrar una cuenta corporativa.</DialogDescription>
              </DialogHeader>
              {creationError && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{creationError}</div>}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <Label htmlFor="usuario-nombre">
                    Nombre Completo
                  </Label>
                  <input
                    id="usuario-nombre"
                    type="text"
                    required
                    placeholder="ej: Juan Pérez"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <Label htmlFor="usuario-email">
                    Correo Electrónico Corporativo
                  </Label>
                  <input
                    id="usuario-email"
                    type="email"
                    required
                    placeholder="ej: juan.perez@fermar.com.ar"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <Label htmlFor="usuario-rol">
                    Rol Asignado
                  </Label>
                  <select
                    id="usuario-rol"
                    value={newRol}
                    onChange={(e) => setNewRol(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="Operario">Operario (Nivel 1)</option>
                    <option value="Supervisor">Supervisor (Nivel 2)</option>
                    <option value="Administrador">Administrador (Nivel 3)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="usuario-password">
                    Contraseña Local (Opcional)
                  </Label>
                  <input
                    id="usuario-password"
                    type="password"
                    placeholder="Dejar en blanco si ingresará vía Google OAuth"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Si no especificás contraseña, el usuario podrá ingresar exclusivamente con
                    Google.
                  </p>
                </div>

                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" disabled={isCreating} />}>Cancelar</DialogClose>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? <Loader2 className="size-4 animate-spin" /> : 'Crear Usuario'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
          </Dialog>
        </div>

        {/* Vista móvil: cada cuenta mantiene sus datos y acciones sin forzar scroll horizontal. */}
        <div className="space-y-3 2xl:hidden" aria-label="Usuarios en formato compacto">
          {isLoadError ? <UnavailableUsers /> : filteredUsers.length === 0 ? <EmptyUsers hasSearch={Boolean(searchTerm)} /> : filteredUsers.map((user) => (
            <article key={user.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/30" aria-hidden="true">{user.nombre.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-foreground">{user.nombre}</h3><p className="mt-0.5 break-all text-xs text-muted-foreground">{user.email}</p></div>
                <StatusBadge active={user.activo} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rol</dt><dd className="mt-1"><select aria-label={`Rol de ${user.nombre}`} value={user.rol} disabled={pendingUsers.has(user.id)} onChange={(e) => handleChangeRole(user, e.target.value as UserRole)} className={cn('max-w-full cursor-pointer rounded-full border bg-clip-padding px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60', roleBadgeStyles[user.rol])}><option value="Operario">Operario</option><option value="Supervisor">Supervisor</option><option value="Administrador">Administrador</option></select></dd></div>
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Alta</dt><dd className="mt-1 text-xs text-foreground">{new Date(user.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</dd></div>
              </dl>
              <Button size="sm" variant={user.activo ? 'destructive' : 'outline'} disabled={pendingUsers.has(user.id)} onClick={() => handleToggleStatus(user)} className="mt-4 h-9 w-full gap-1.5 rounded-lg text-xs">
                {pendingUsers.has(user.id) ? <Loader2 className="size-3.5 animate-spin" /> : user.activo ? 'Desactivar usuario' : 'Activar usuario'}
              </Button>
            </article>
          ))}
        </div>

        {/* Tabla de escritorio: conserva la vista densa existente. */}
        <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm 2xl:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol Asignado</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Fecha de Alta</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadError || filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
                          <SearchX className="size-5" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-medium text-foreground">{isLoadError ? 'Usuarios no disponibles' : searchTerm ? 'Sin coincidencias' : 'Sin usuarios'}</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          {isLoadError ? 'No se puede mostrar el listado mientras la consulta falla.' : searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda.' : 'No hay usuarios para mostrar.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-secondary/40">
                      {/* Usuario */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
                            {user.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{user.nombre}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-4">
                        <select
                          value={user.rol}
                          disabled={pendingUsers.has(user.id)}
                          onChange={(e) =>
                            handleChangeRole(user, e.target.value as UserRole)
                          }
                          className={cn(
                            'cursor-pointer rounded-full border bg-clip-padding px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                            roleBadgeStyles[user.rol],
                          )}
                        >
                          <option value="Operario">Operario</option>
                          <option value="Supervisor">Supervisor</option>
                          <option value="Administrador">Administrador</option>
                        </select>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4">
                        {user.activo ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-success/40">
                            <CheckCircle2 className="size-3.5" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                            <XCircle className="size-3.5" />
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="sm"
                          variant={user.activo ? 'destructive' : 'outline'}
                          disabled={pendingUsers.has(user.id)}
                          onClick={() => handleToggleStatus(user)}
                          className="h-8 gap-1.5 rounded-lg text-xs"
                        >
                          {pendingUsers.has(user.id) ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : user.activo ? (
                            'Desactivar'
                          ) : (
                            'Activar'
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[11px] font-semibold text-success ring-1 ring-inset ring-success/40">
      <CheckCircle2 className="size-3" aria-hidden="true" /> Activo
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
      <XCircle className="size-3" aria-hidden="true" /> Inactivo
    </span>
  )
}

function EmptyUsers({ hasSearch }: { hasSearch: boolean }) {
  return <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground"><SearchX className="size-5" aria-hidden="true" /></span><p className="text-sm font-medium text-foreground">{hasSearch ? 'Sin coincidencias' : 'Sin usuarios'}</p><p className="max-w-xs text-xs text-muted-foreground">{hasSearch ? 'No se encontraron usuarios que coincidan con la búsqueda.' : 'No hay usuarios para mostrar.'}</p></div>
}

function UnavailableUsers() {
  return <div role="status" className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground"><AlertCircle className="size-5" aria-hidden="true" /></span><p className="text-sm font-medium text-foreground">Usuarios no disponibles</p><p className="max-w-xs text-xs text-muted-foreground">No se puede mostrar el listado mientras la consulta falla.</p></div>
}
