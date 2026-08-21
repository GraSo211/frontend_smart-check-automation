import { SidebarProvider } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import AppSidebar from '@/components/layout/sidebar'
import { getSession } from '@/lib/auth'

export default async function ModulosLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Leemos la sesión en el servidor para hidratar el Header.
  // getSession() retorna null en rutas públicas (login, unauthorized) —
  // el middleware ya maneja la protección de rutas autenticadas.
  const session = await getSession()
  const user = session
    ? { nombre: session.nombre, rol: session.rol }
    : undefined

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <div className="flex min-h-svh flex-1 flex-col">
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </div>
    </SidebarProvider>
  )
}
