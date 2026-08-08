import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Outfit, Sora } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { SidebarProvider } from '@/components/ui/sidebar'
import './globals.css'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import AppSidebar from '@/components/layout/sidebar'
import { getSession } from '@/lib/auth'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-heading',
})

export const metadata: Metadata = {
  title: 'Smart-Check Automation | Fermar S.A.',
  description:
    'Panel de supervisión de producción para la panificadora industrial Fermar S.A. — control de calidad en tiempo real y telemetría de hornos vía IoT Edge.',
}

export default async function RootLayout({
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
    <html lang="es" className={`bg-background`} suppressHydrationWarning> 
      <body className={`${outfit.variable} ${sora.variable} font-sans bg-background`} suppressHydrationWarning>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="sca-dark"
            disableTransitionOnChange
            themes={["fermar-light", "fermar-dark", "sca-light", "sca-dark"]}
          >
          <SidebarProvider>
            <AppSidebar />
            <div className="flex min-h-svh flex-1 flex-col">
              <Header user={user} />
              <div className="flex flex-1 flex-col">{children}</div>
              <Footer />
            </div>
            <Toaster />
          </SidebarProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

