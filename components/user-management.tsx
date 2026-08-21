'use client'

import { useState } from 'react'
import { UserDTO, createUserAction, updateUserAction } from '@/actions/users'
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
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface UserManagementProps {
  initialUsers: UserDTO[]
}

const roleBadgeStyles: Record<UserDTO['rol'], string> = {
  Administrador: 'border-primary/30 bg-primary/10 text-primary',
  Supervisor: 'border-accent/30 bg-accent/10 text-accent',
  Operario: 'border-border bg-secondary/70 text-muted-foreground',
}

export function UserManagement({ initialUsers }: UserManagementProps) {
  const [users, setUsers] = useState<UserDTO[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Estado del formulario de creación
  const [newEmail, setNewEmail] = useState('')
  const [newNombre, setNewNombre] = useState('')
  const [newRol, setNewRol] = useState<'Administrador' | 'Supervisor' | 'Operario'>('Operario')
  const [newPassword, setNewPassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Filtrado
  const filteredUsers = users.filter(
    (u) =>
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Totales
  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.activo).length
  const adminUsers = users.filter((u) => u.rol === 'Administrador').length

  // Handler: Crear Usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsCreating(true)

    const res = await createUserAction({
      email: newEmail,
      nombre: newNombre,
      rol: newRol,
      password: newPassword || undefined,
    })

    setIsCreating(false)

    if (res.ok && res.user) {
      setUsers([res.user, ...users])
      setIsModalOpen(false)
      setNewEmail('')
      setNewNombre('')
      setNewRol('Operario')
      setNewPassword('')
    } else {
      setErrorMsg(res.message || 'Error al crear usuario.')
    }
  }

  // Handler: Toggle Estado Activo/Inactivo
  const handleToggleStatus = async (user: UserDTO) => {
    setLoadingId(user.id)
    setErrorMsg(null)

    const nextState = !user.activo
    const res = await updateUserAction(user.id, { activo: nextState })

    setLoadingId(null)

    if (res.ok) {
      setUsers(users.map((u) => (u.id === user.id ? { ...u, activo: nextState } : u)))
    } else {
      setErrorMsg(res.message || 'Error al actualizar el estado del usuario.')
    }
  }

  // Handler: Cambiar Rol
  const handleChangeRole = async (user: UserDTO, newRol: 'Administrador' | 'Supervisor' | 'Operario') => {
    setLoadingId(user.id)
    setErrorMsg(null)

    const res = await updateUserAction(user.id, { rol: newRol })

    setLoadingId(null)

    if (res.ok) {
      setUsers(users.map((u) => (u.id === user.id ? { ...u, rol: newRol } : u)))
    } else {
      setErrorMsg(res.message || 'Error al actualizar el rol.')
    }
  }

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
          <span className="pt-1">{errorMsg}</span>
        </div>
      )}

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
            {totalUsers} {totalUsers === 1 ? 'usuario' : 'usuarios'}
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
              <p className="text-2xl font-bold tracking-tight text-foreground">{totalUsers}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Usuarios Activos</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{activeUsers}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500">
              <Shield className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Administradores</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{adminUsers}</p>
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
            {searchTerm
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

          <Button onClick={() => setIsModalOpen(true)} className="gap-2 rounded-xl shadow-md transition-shadow hover:shadow-lg">
            <UserPlus className="size-4" />
            <span>Nuevo Usuario Corporativo</span>
          </Button>
        </div>

        {/* Modal de Creación */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Alta de Usuario Corporativo
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Cerrar"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Juan Pérez"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Correo Electrónico Corporativo
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ej: juan.perez@fermar.com.ar"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Rol Asignado
                  </label>
                  <select
                    value={newRol}
                    onChange={(e) => setNewRol(e.target.value as any)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="Operario">Operario (Nivel 1)</option>
                    <option value="Supervisor">Supervisor (Nivel 2)</option>
                    <option value="Administrador">Administrador (Nivel 3)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Contraseña Local (Opcional)
                  </label>
                  <input
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

                <div className="flex justify-end gap-2 border-t border-border pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isCreating}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? <Loader2 className="size-4 animate-spin" /> : 'Crear Usuario'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tabla de Usuarios */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
                          <SearchX className="size-5" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-medium text-foreground">Sin resultados</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          No se encontraron usuarios que coincidan con la búsqueda.
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
                          disabled={loadingId === user.id}
                          onChange={(e) =>
                            handleChangeRole(user, e.target.value as any)
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
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-700">
                            <CheckCircle2 className="size-3.5" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950/40 px-2.5 py-1 text-xs font-semibold text-zinc-400 ring-1 ring-inset ring-zinc-700">
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
                          disabled={loadingId === user.id}
                          onClick={() => handleToggleStatus(user)}
                          className="h-8 gap-1.5 rounded-lg text-xs"
                        >
                          {loadingId === user.id ? (
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
