import type { Metadata } from 'next'

import { Hero } from '@/components/landing/hero'
import { LandingFooter } from '@/components/landing/landing-footer'

export const metadata: Metadata = {
  title: 'SmartCheck Automation | Fermar S.A.',
  description:
    'La calidad no se audita al final. Se ve en cada lote. Supervisión en tiempo real de lotes, hornos y dispositivos IoT Edge para la panificadora industrial Fermar S.A.',
}

export default function InicioPage() {
  return (
    <>
      <Hero />
      <LandingFooter />
    </>
  )
}
