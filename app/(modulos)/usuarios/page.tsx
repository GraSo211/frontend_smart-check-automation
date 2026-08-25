import { getUsersAction } from '@/actions/users'
import { UserManagement } from '@/components/user-management'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gestión de Usuarios y Roles | Smart-Check Automation',
  description: 'Panel de administración de usuarios corporativos y control de acceso (RBAC).',
}

export default async function Page() {
  const result = await getUsersAction()
  const users = result.users || []

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Usuarios
          </div>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Gestión de Usuarios y Permisos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Administración centralizada de cuentas corporativas, asignación de roles y control de
            acceso (RBAC).
          </p>
        </header>

        <UserManagement initialUsers={users} />
      </main>
    </div>
  )
}
