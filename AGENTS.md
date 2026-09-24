# AGENTS.md

## Stack

- Next.js 16.2.6 (App Router) + React 19 + TypeScript 5.7
- Tailwind CSS v4 (CSS-based config in `app/globals.css` via `@theme inline`, no `tailwind.config.*`)
- shadcn/ui with the **`base-nova` preset** — primitives come from `@base-ui/react` (NOT Radix). See `components.json`.
- `@vercel/analytics` is mounted in `app/layout.tsx` and only renders in production builds.

## Package manager

`pnpm` is canonical (the repo ships `pnpm-lock.yaml` and `node_modules` was installed with pnpm). Install with pnpm only.

## Commands

The repository scripts are:

| Task | Command |
| --- | --- |
| Dev server (Turbopack) | `pnpm dev` |
| Production build | `pnpm build` |
| Start built app | `pnpm start` |
| Lint | `pnpm lint` |
| Tests | `pnpm test` |

There is no `tsc` script; run `pnpm exec tsc --noEmit` if you need a one-off type check. `next build` will not fail on type errors (see gotchas).

## Layout

```
app/                      Next.js App Router
  layout.tsx              Root layout, metadata, Analytics mount, theme + Header/Footer
  (auth)/                 Login / unauthorized routes
  (modulos)/page.tsx      Home dashboard (async server component, force-dynamic): getAllLotes() → DashboardContent
  (modulos)/lotes/        Sector-scoped dashboard: getSectores() + getAllLotes() + getLoteAbierto(sector) → lotes DashboardContent
  (modulos)/configuracion/ getProductosConParametros() + getSectores() + cursor-walked getLotes() → config panels
  (modulos)/nodos/        Device catalog: getDevices() + getRegistrationRequests() → approve/reject, edit sector/WHEP, delete
  (modulos)/sectores/     Sector catalog: getSectores() + getDevices() → create/rename/delete (Supervisor+)
  (modulos)/usuarios/     Users + roles (Administrador only)
  (modulos)/supervision/  Live WHEP camera view (Supervisor+)
  (modulos)/alertas/      Placeholder module
  api/lotes/snapshot/     Global multi-sector lote snapshot proxy (parallel sectors, cursor walk, `truncada` flag)
  api/lotes/events/       SSE proxy to the backend /api/v1/lotes/events
  api/nodos/*             Device snapshot/events proxies
  api/system-status/      Backend health probe (GET /health)
  globals.css             Tailwind v4 @import + @theme inline design tokens (oklch, 4 themes)
actions/
  api.ts                  Server data fetchers + mutations (lotes, sectores, dispositivos, parámetros, registro). See "Data flow".
  auth.ts                 Login/logout server actions
  users.ts                Admin user server actions
components/
  dashboard-content.tsx   Home dashboard composition ("use client")
  monitoring-provider.tsx Global monitoring store + SSE client; exposes useProductionData()
  user-management.tsx     Users/roles admin UI
  mode-toggle.tsx         Theme switcher
  theme-provider.tsx      next-themes provider
  lotes/                  dashboard-content, kpi-cards, supervision-table, filters-bar, lote-abierto-card
  configuracion/          product-card, product-parameters, parameters-history
  nodos/                  device-card, devices-state, device-history, device-actions-menu, telemetry-dashboard, pending-registration-requests
  sectores/               sector-management
  supervision/            supervision-view, live-camera, node-selector, segmented-control
  shared/                 connection-indicator, page-button, pagination-state, sector-select
  layout/                 header, footer, sidebar, sidebar-trigger, monitoring-status, placeholder-section
  ui/                     shadcn-generated primitives (base-nova style). Add new ones with `pnpm dlx shadcn@latest add <name>`.
lib/
  utils.ts                `cn()` helper (clsx + tailwind-merge)
  format.ts               es-AR Intl formatters used across the dashboard
  production-data.ts      LoteSector/Sector/Producto/Conteos API contract types
  devices-data.ts         Device, telemetry and registration-request types
  parametros-producto.ts  Product parameter and batch history types + validation
  auth.ts                 Session cookie decode/expiry + role levels (proxy + server)
  auth-redirect.ts        Safe callbackUrl validation
  auth-validation.ts      Login form validation
  api-client.ts           `ApiError` shared by server actions
  pagination.ts           Backend page parsers
  registration.ts         Registration-request parsing/validation
  telemetry.ts            Telemetry sample types + merging
  monitoring-*.ts         Monitoring store + server proxies (runtime/server/store/types)
  camera-*.ts             WHEP camera helpers (health/observer/sources)
  role-badge.ts           Role colors
  sidebar-nav.ts          Sidebar nav model
  sync-store.ts           Client store for the "última sincronización" timestamp
  user-management-state.ts  Users list state helpers
  __tests__/              Unit tests
hooks/
  use-mobile.ts           Viewport breakpoint hook (shadcn sidebar)
public/                   Static logos and icons
proxy.ts                  Next 16 proxy (middleware): route protection + session headers
```

Data flow: the backend contract is the **sector/lotes** one. `actions/api.ts` exposes `getSectores()` (`GET /api/v1/sectores`), `getProductos()` (`GET /api/v1/productos`), `getLotes(sectorId, { productoId?, limite?, antesDe? })` (`GET /api/v1/lotes`, cursor-paginated via `siguiente_cursor`; `sector_id` is required with OAuth), `getAllLotes()` (walks every sector in parallel, following each cursor, deduplicated by id), and `getLoteAbierto(sectorId)` (`GET /api/v1/lotes/abierto`, `lote:null` when there is none). All use an 8s `AbortController` timeout and `cache: "no-store"`, and forward the OAuth `session_token` cookie via `getSessionHeaders()`.

The home page (`app/(modulos)/page.tsx`) calls `getAllLotes()`; `/lotes` adds `getSectores()` + `getLoteAbierto()`; `/configuracion` walks `getLotes()` per sector/product. The client provider (`components/monitoring-provider.tsx`) stays **global**: it fetches the global snapshot from `app/api/lotes/snapshot/route.ts` (parallel sectors, cursor walk, emits a `truncada` flag) and subscribes to `app/api/lotes/events/route.ts` (`lote.creado` / `lote.actualizado` / `lote.cerrado`, payload = raw `LoteSector`). `useProductionData()` returns `LoteSector[]` plus `truncated`; pages filter by sector client-side.

Backend: there IS now an external backend — a Go service on Render (free-tier) at `NEXT_PUBLIC_API_URL` (see `.env.example`). It sleeps after ~15 min idle (cold-start 30–60 s). The 8s fetch timeout prevents a cold-start from blocking a request indefinitely; the resulting error is propagated to the page.

## Conventions specific to this repo

- UI copy is in **Spanish (es-AR locale)**. Use `new Intl.*` with `"es-AR"` and the existing helpers in `lib/format.ts`. Do not translate to English.
- Path alias `@/*` resolves to the repo root (configured in `tsconfig.json` and `components.json`).
- `components.json` declares the `base-nova` style and `lucide` icon library — keep both when adding shadcn components.
- Tailwind v4 tokens live entirely in `app/globals.css` (`@theme inline` + `:root` / `.dark` oklch vars). Add new design tokens there, not in a JS config.
## Gotchas

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`. The build will pass even with type errors; still try to keep types clean.
- `lucide-react` is pinned at `^1.16.0` and `next` at `16.2.6` (pinned exact, no caret). Don't bump either casually — other deps assume these versions.
- `pnpm dev` uses Turbopack by default in Next 16. Page shells and KPI cards are server components; the header, footer, sidebar and most interactive modules are client components (`"use client"`).
- `package.json` `name` is still the default `my-project` — it is not the source of truth for the project name (use `app/layout.tsx` metadata / footer string `Smart-Check Automation`).
- Build-time static generation of `/` used to time out (>60 s) on Vercel because the server component fetched the Render backend during prerender (Render free-tier cold-start). Fixed with `export const dynamic = "force-dynamic"` in `app/(modulos)/page.tsx` + the 8s `AbortController` timeout in `actions/api.ts`. Do NOT remove either, or the Vercel build will break again when Render is cold.
- The SSE `EventSource` in `components/lotes/dashboard-content.tsx` (via the `/api/lotes/events` proxy) also hits Render; a cold backend there will keep the client retrying silently. Tolerated for now — see the backend note under "Data flow".
- `package.json` runs Vitest through `pnpm test`; don't assume Jest by default.

## Skills

`.agents/skills/` is a curated set of domain skills (shadcn, tailwind-v4-shadcn, react/next best practices, a11y, seo, etc.). Load them with the `skill` tool when the task matches their description — they are the repo's preferred reference over generic knowledge.
