# Smart-Check Automation

Panel de supervisión de producción para la panificadora industrial **Fermar S.A.** — control de calidad en tiempo real y telemetría de hornos vía IoT Edge.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | [Next.js](https://nextjs.org) 16.2.6 (App Router) |
| UI | React 19 + TypeScript 5.7 |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com) (CSS-first config) |
| Componentes | [shadcn/ui](https://ui.shadcn.com) con preset `base-nova` (sobre [Base UI](https://base-ui.com)) |
| Iconos | [Lucide](https://lucide.dev) |
| Analytics | [Vercel Analytics](https://vercel.com/analytics) (solo en producción) |
| Paquete | `pnpm` (canonical) |

## Estructura

```
app/
├── layout.tsx          Layout raíz, metadata, ThemeProvider
├── page.tsx            Dashboard página principal (servidor)
├── globals.css         Tokens de diseño Tailwind v4 + shadcn
actions/
├── api.ts              Cliente HTTP para API de producción
components/
├── header.tsx          Encabezado con marca y badge de sistema
├── footer.tsx          Pie con reloj de sincronización IoT simulado
├── kpi-cards.tsx       Tarjetas de métricas resumen
├── supervision-table.tsx Tabla con paginación, filtros y búsqueda
├── turno-badge.tsx     Badge de turno (mañana/tarde/noche)
├── mode-toggle.tsx     Selector de tema claro/oscuro/sistema
├── theme-provider.tsx  Wrapper de next-themes
└── ui/                 Primitivas shadcn (button, dropdown-menu)
lib/
├── format.ts           Formateadores es-AR (número, fecha, calidad)
├── production-data.ts  Dataset mock (50 corridas) + paginador
├── utils.ts            Helper cn() (clsx + tailwind-merge)
└── __tests__/          Tests unitarios (vitest)
```

## Comandos

| Comando | Descripción |
|---------|------------|
| `pnpm dev` | Servidor de desarrollo (Turbopack) |
| `pnpm build` | Build de producción |
| `pnpm start` | Iniciar servidor de producción |
| `pnpm lint` | ESLint |
| `pnpm test` | Tests unitarios (vitest) |
| `pnpm exec tsc --noEmit` | Type check manual |

## Entorno

Variable por defecto en `.env.local`:

```
API_URL=http://localhost:8080
```

Si no hay API disponible, el dashboard usa datos simulados (50 corridas de prueba).

## Desarrollo

```bash
pnpm install
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Agregar componentes shadcn

```bash
pnpm dlx shadcn@latest add <componente>
```

El preset `base-nova` y `lucide` ya están configurados en `components.json`.

## Dashboard

La página principal muestra:
- **KPIs**: Unidades procesadas, tasa de calidad, tasa de merma, promedio de hornos.
- **Tabla de supervisión**: Lotes de producción paginados con filtros por producto, turno y rango de temperatura.
- Las tarjetas KPI se actualizan automáticamente al cambiar los filtros.

## Convenciones

- UI en **español (es-AR)** con `Intl.NumberFormat` y helpers en `lib/format.ts`.
- Alias `@/*` configurado en `tsconfig.json`.
- Componentes servidor por defecto; solo los que necesitan interactividad llevan `"use client"`.

## Licencia

Uso interno — Fermar S.A.
