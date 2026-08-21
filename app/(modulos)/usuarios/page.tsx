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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Gestión de Usuarios y Permisos
          </h2>
          <p className="text-sm text-muted-foreground">
            Administración centralizada de cuentas corporativas, asignación de roles y control de acceso (RBAC).
          </p>
        </div>

        <UserManagement initialUsers={users} />
      </main>
    </div>
  )
}

