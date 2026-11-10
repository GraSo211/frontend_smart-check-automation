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

There is no `tsc` script; run `pnpm exec tsc --noEmit` for a one-off type check. `pnpm build` (`next build`) verifies types: `next.config.mjs` does not set `typescript.ignoreBuildErrors`.

Tests use Vitest (`pnpm test` → `vitest run`). `vitest.config.mts` defaults to the `node` environment; component tests must start with `// @vitest-environment jsdom` (see `components/horno/__tests__/consigna-form.test.tsx`). Unit tests live in `lib/__tests__/`, component tests in `components/**/__tests__/`.

## Environment

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | server + client bundle | Go API base; required. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | client bundle | Optional Google login. |
| `NEXT_PUBLIC_MEDIAMTX_URL` | client bundle | Public MediaMTX base used by `/supervision`. |
| `JWT_SECRET` | server only | Same value as the Go backend's `JWT_SECRET`; used to verify the session cookie in `proxy.ts` and server components. |
| `NOTIFICACIONES_EMAIL_PROVIDER` | backend only | Selects the email provider (Resend or Gmail API). Never referenced by the frontend. |
| `RESEND_API_KEY` | backend only | API key for Resend email notifications. Never referenced by the frontend. |
| `GMAIL_CLIENT_ID` | backend only | Gmail API OAuth client ID. Never referenced by the frontend. |
| `GMAIL_CLIENT_SECRET` | backend only | Gmail API OAuth client secret. Never referenced by the frontend. |
| `GMAIL_REFRESH_TOKEN` | backend only | Gmail API OAuth refresh token. Never referenced by the frontend. |
| `NOTIFICACIONES_EMAIL_FROM` | backend only | Sender address for email notifications. Never referenced by the frontend. |
| `TELEGRAM_BOT_TOKEN` | backend only | Telegram bot token. Never referenced by the frontend. |

`NEXT_PUBLIC_*` values are inlined at build time; changing one requires a rebuild.

The email provider is chosen in the backend via `NOTIFICACIONES_EMAIL_PROVIDER`; the frontend only displays whether each channel is configured.

## Documentation

- [`README.md`](README.md) — functional scope, pages, environment and deployment.
- [`MANUAL_INSTALACION.md`](MANUAL_INSTALACION.md) — step-by-step install, environment, run, deploy and functional verification.
- [`DESIGN.md`](DESIGN.md) — themes, tokens and interaction states.
- [`RECORDATORIOS.md`](RECORDATORIOS.md) — resolved items and current technical debt.

## Layout

```
app/                      Next.js App Router
  layout.tsx              Root layout, metadata, Analytics mount, theme + Header/Footer
  (auth)/                 Login / unauthorized routes
  (modulos)/page.tsx      Home dashboard (async server component, force-dynamic): getAllLotes() + getAlertas(ACTIVA) + getHornoEstado por sector abierto → HomeDashboard
  (modulos)/lotes/        Sector-scoped dashboard: getSectores() + getAllLotes() + getLoteAbierto(sector) → LotesDashboard
  (modulos)/lotes/[id]/control/ Per-lote MPC control view (ControlCard)
  (modulos)/configuracion/ getProductos() + getSectores() + cursor-walked getLotes() → config panels
  (modulos)/configuracion/notificaciones/ Admin notification settings: getNotificationSettingsAction() → NotificationSettings
  (modulos)/horno/consigna/ Manual oven setpoint form: getProductos() + getSectores() + getLoteAbierto(selectedSector) + getHornoEstado(selectedSector) + getConsignaHistorial(lote)
  (modulos)/linea-produccion/ Sector line view: getSectores() + getProductos() + getLoteAbierto(sector) + getAlertas(ACTIVA)
  (modulos)/reportes/     Report center: KPI summary + filters + CSV/Excel/JSON/PDF downloads through /api/reportes/lotes
  (modulos)/dispositivos/ Device catalog: getDevices() + getRegistrationRequests() → approve/reject, edit sector, rename, show derived WHEP URL, delete
  (modulos)/sectores/     Sector catalog: getSectores() + getDevices() → create/rename/delete (Supervisor+)
  (modulos)/usuarios/     Users + roles (Administrador only)
  (modulos)/supervision/  Live WHEP camera view (Supervisor+)
  (modulos)/alertas/      Operational alerts: getAlertas(estado) + ack (Supervisor+)
  (modulos)/planificacion/ CSV import of production plan, downtime and energy (Supervisor+)
  api/lotes/snapshot/     Global multi-sector lote snapshot proxy (parallel sectors, cursor walk, `truncada` flag)
  api/lotes/events/       SSE proxy to the backend /api/v1/lotes/events
  api/lotes/[id]/control/events/ SSE proxy for `control.propuesta` / `control.evento`
  api/dispositivos/*      Device snapshot/events proxies
  api/reportes/lotes/     CSV/Excel/JSON/PDF built from /api/v1/reportes/{resumen,lotes} (PDF via @react-pdf/renderer)
  api/reportes/trazabilidad/ PDF de trazabilidad por lote + CSV de proceso/alertas/decisiones/consignas
  api/reportes/alertas/  CSV/JSON de alertas del período desde /api/v1/reportes/alertas
  api/planificacion/[tipo]/import/ Proxy multipart a /api/v1/planificacion/{plan,paradas}/import
  api/planificacion/[tipo]/       GET listado de lo importado (proxy con cookie)
  api/planificacion/[tipo]/[id]/  DELETE de una fila importada (proxy con cookie)
  api/system-status/      Backend health probe (GET /health)
  globals.css             Tailwind v4 @import + @theme inline design tokens (oklch, 4 themes)
actions/
  api.ts                  Server data fetchers + mutations (lotes, control, horno/consigna, sectores, dispositivos, alertas, parámetros, registro). See "Data flow".
  auth.ts                 Login/logout server actions
  notifications.ts        Admin notification settings/preferences/test server actions
  reports.ts              Lote report building (CSV/Excel/JSON)
  users.ts                Admin user server actions
components/
  dashboard-content.tsx   Home dashboard composition ("use client")
  monitoring-provider.tsx Global monitoring store + SSE client; exposes useProductionData()
  user-management.tsx     Users/roles admin UI
  mode-toggle.tsx         Theme switcher
  theme-provider.tsx      next-themes provider
  lotes/                  dashboard-content, kpi-cards, supervision-table, filters-bar, lote-abierto-card, control-card
  horno/                  consigna-panel, consigna-form, horno-estado-card, consigna-historial
  configuracion/          product-card, product-parameters, parameters-history
  notificaciones/         notification-settings (channels, recipient preferences, test send)
  dispositivos/           device-card, devices-state, device-history, device-actions-menu, telemetry-dashboard, pending-registration-requests
  sectores/               sector-management
  linea-produccion/       linea-produccion-view
  alertas/                alertas-view
  planificacion/          CSV import cards + loaded-data tables with delete (plan, paradas)
  reportes/               reportes-form, reportes-dashboard (KPI cards + SVG charts + tables)
  supervision/            supervision-view, live-camera, node-selector, segmented-control
  shared/                 connection-indicator, page-button, pagination-state, sector-select
  layout/                 header, footer, sidebar, sidebar-trigger, monitoring-status
  ui/                     shadcn-generated primitives (base-nova style). Add new ones with `pnpm dlx shadcn@latest add <name>`.
lib/
  utils.ts                `cn()` helper (clsx + tailwind-merge)
  format.ts               es-AR Intl formatters used across the dashboard
  reportes.ts             Report filter defaults/validation, download hrefs and display formatters (ART)
  reportes-types.ts       Types for GET /api/v1/reportes/{resumen,lotes}
  reportes-query.ts       Report filter query-string builder shared by actions and tests
  reportes-trazabilidad-csv.ts  CSV datasets (proceso/alertas/decisiones/consignas) for a lote
  reportes-alertas-csv.ts       CSV/JSON builder for period alerts
  oee-types.ts                  Types for GET /api/v1/reportes/oee
  planificacion.ts              CSV import types/templates/URLs
  reportes-pdf/           @react-pdf/renderer operational + per-lote traceability reports (A4, Helvetica, SVG charts)
  production-data.ts      LoteSector/Sector/Producto/Conteos API contract types + validateConsignaInput
  devices-data.ts         Device, telemetry and registration-request types
  alertas.ts              Alert type → readable label map (unknown types fall back to underscores → spaces)
  notification-settings.ts  Notification settings types, backend parsers and Telegram chat ID validation
  auth.ts                 Session cookie verify/expiry + role levels (proxy + server)
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
  __tests__/              Unit tests (includes consigna-validation.test.ts)
hooks/
  use-mobile.ts           Viewport breakpoint hook (shadcn sidebar)
public/                   Static logos and icons
proxy.ts                  Next 16 proxy (middleware): route protection + JWT verification
```

Data flow: the backend contract is the **sector/lotes** one. `actions/api.ts` exposes `getSectores()` (`GET /api/v1/sectores`), `getProductos()` (`GET /api/v1/productos`), `getLotes(sectorId, { productoId?, limite?, antesDe? })` (`GET /api/v1/lotes`, cursor-paginated via `siguiente_cursor`; `sector_id` is required with OAuth), `getAllLotes()` (walks every sector in parallel, following each cursor, deduplicated by id), and `getLoteAbierto(sectorId)` (`GET /api/v1/lotes/abierto`, `lote:null` when there is none). All use an 8s `AbortController` timeout and `cache: "no-store"`, and forward the OAuth `session_token` cookie via `getSessionHeaders()`.

Reports use `getReporteResumen()` (`GET /api/v1/reportes/resumen`) and `getReporteLotes()` (`GET /api/v1/reportes/lotes`, cursor-paginated) with a 20s timeout. Dates are `YYYY-MM-DD` in ART, inclusive, default last 30 days, max 366. `/reportes` renders the summary server-side; `/api/reportes/lotes` walks the detail cursor and returns CSV, Excel es-AR CSV (`delim=;`), JSON, or an A4 PDF rendered with `@react-pdf/renderer` (Node runtime, no Chromium). The per-lote traceability PDF uses `getReporteTrazabilidad(loteId)` (`GET /api/v1/reportes/trazabilidad`) and is reachable from `/reportes` and from each row of the lote table. Report kg are estimates: `count × productos.peso_referencia_kg`.

OEE uses `getReporteOEE()` (`GET /api/v1/reportes/oee`) and is only calculable when the period has a production plan, product nominal capacity (`capacidadNominalKgH`) and closed lotes. Plan/paradas are loaded as CSV from `/planificacion` (Supervisor+), listed there with deletion, and edited by re-importing the CSV (upsert). The test/proxy routes forward multipart/GET/DELETE to the Go API. `kg_plan` is prorated by its overlap with the report period; plan imports reject overlapping rows within a sector (same-key re-imports update instead). OEE is calculated per sector/period (it ignores product/turno filters) and is shown on `/reportes`, in the operational PDF, and with explicit `motivos` when data is missing.

The home page (`app/(modulos)/page.tsx`) calls `getAllLotes()`, `getAlertas({ estado: "ACTIVA" })` and `getHornoEstado(sectorId)` for every sector with an open lote; each fetch is independent so one failure does not block the rest. The KPIs of savings and fixed 15% waste impact have been removed: the home now shows observed waste units/rate, active alerts from the backend and the average of the latest real oven telemetry. `/lotes` adds `getSectores()` + `getLoteAbierto()`; `/configuracion` walks `getLotes()` per sector/product. The client provider (`components/monitoring-provider.tsx`) stays **global**: it fetches the global snapshot from `app/api/lotes/snapshot/route.ts` (parallel sectors, cursor walk, emits a `truncada` flag) and subscribes to `app/api/lotes/events/route.ts` (`lote.creado` / `lote.actualizado` / `lote.cerrado`, payload = raw `LoteSector`). `useProductionData()` returns `LoteSector[]` plus `truncated`; pages filter by sector client-side.

`/horno/consigna` (`force-dynamic`) composes `getProductos()`, `getSectores()`, `getLoteAbierto(selectedSector)`, `getHornoEstado(selectedSector)` and `getConsignaHistorial(initialLoteId)`. The sector is selected via query-string (`?sector_id=...`) or defaults to the first available. `GET /api/v1/horno?sector_id=<id>` returns a projection of the latest real telemetry from the Pi (`metricas_horno`), including temperature, belt speed, combustion temp, humidity, ambient readings, targets and detection confidence; states like `SIN_LOTE`, `SIN_TELEMETRIA`, `SIN_DATOS` and `DESACTUALIZADO` are surfaced by the card. `POST /api/v1/horno/consigna` requires an open lote in `MANUAL` mode; the backend enqueues it for the Pi and devuelve `estado: "PENDIENTE"` junto con un `decisionId`. El ack de la Pi marca la decisión en `decisiones_control` y la consigna en `historial_consignas` como `estado: "APLICADA"`. `exitosa` sigue presente por compatibilidad con backends previos. Each fetch fails independently: productos/sectores render an inline `role="alert"`, while the oven state and history degrade inside their cards.

Backend: there IS now an external backend — a Go service on Render (free-tier) at `NEXT_PUBLIC_API_URL` (see `.env.example`). It sleeps after ~15 min idle (cold-start 30–60 s). The 8s fetch timeout prevents a cold-start from blocking a request indefinitely; the resulting error is propagated to the page.

MediaMTX: `NEXT_PUBLIC_MEDIAMTX_URL` is the public base (http/https, no path). The WHEP URL is derived in the front as `<base>/<slug(nombre)>-<entrada|salida>/whep`; it is not editable per device. The Raspberry publishes to the same path over RTSP.

Lote control (`components/lotes/control-card.tsx`, `/lotes/[id]/control`): mode changes go through `cambiarModo()` (`PATCH /api/v1/lotes/{id}/modo`) and require Supervisor (`canControl`). In `SUPERVISION` the card pulls `GET /api/v1/lotes/{id}/consigna-propuesta` on mount and every 10 s; a 204 clears the pending proposal, and the `control.propuesta` SSE event also feeds it. **There is at most one pending proposal per lote — it is not a queue.** The "Aprobar propuesta pendiente" button is enabled only when a proposal exists and `autorizada !== true`; the approval modal's confirm button applies the same guard. After approving, the card shows "Aprobada. La Pi la aplicará en el próximo ciclo." until the Pi applies it and the next pull returns 204.

## Conventions specific to this repo

- UI copy is in **Spanish (es-AR locale)**. Use `new Intl.*` with `"es-AR"` and the existing helpers in `lib/format.ts`. Do not translate to English.
- Path alias `@/*` resolves to the repo root (configured in `tsconfig.json` and `components.json`).
- `components.json` declares the `base-nova` style and `lucide` icon library — keep both when adding shadcn components.
- Tailwind v4 tokens live entirely in `app/globals.css` (`@theme inline` + `:root` / `.dark` oklch vars). Add new design tokens there, not in a JS config.
## Gotchas

- `next.config.mjs` only sets `output: "standalone"` and `images.unoptimized: true`. It does **not** set `typescript.ignoreBuildErrors`, so `pnpm build` fails on type errors. Run `pnpm exec tsc --noEmit` to see them in isolation.
- `lucide-react` is pinned at `^1.16.0` and `next` at `16.2.6` (pinned exact, no caret). Don't bump either casually — other deps assume these versions.
- `pnpm dev` uses Turbopack by default in Next 16. Page shells and KPI cards are server components; the header, footer, sidebar and most interactive modules are client components (`"use client"`).
- `package.json` `name` is `smartcheck-automation-frontend`; the display name still comes from `app/layout.tsx` metadata and the footer string `SmartCheck Automation`.
- Build-time static generation of `/` used to time out (>60 s) on Vercel because the server component fetched the Render backend during prerender (Render free-tier cold-start). Fixed with `export const dynamic = "force-dynamic"` in `app/(modulos)/page.tsx` + the 8s `AbortController` timeout in `actions/api.ts`. Do NOT remove either, or the Vercel build will break again when Render is cold.
- The SSE `EventSource` in `components/lotes/dashboard-content.tsx` (via the `/api/lotes/events` proxy) also hits Render; a cold backend there will keep the client retrying silently. Tolerated for now — see the backend note under "Data flow".
- `package.json` runs Vitest through `pnpm test`; don't assume Jest by default.

## Skills

`.agents/skills/` is a curated set of domain skills (shadcn, tailwind-v4-shadcn, react/next best practices, a11y, seo, etc.). Load them with the `skill` tool when the task matches their description — they are the repo's preferred reference over generic knowledge.
