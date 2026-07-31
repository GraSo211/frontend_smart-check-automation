# AGENTS.md

## Stack

- Next.js 16.2.6 (App Router) + React 19 + TypeScript 5.7
- Tailwind CSS v4 (CSS-based config in `app/globals.css` via `@theme inline`, no `tailwind.config.*`)
- shadcn/ui with the **`base-nova` preset** — primitives come from `@base-ui/react` (NOT Radix). See `components.json`.
- `@vercel/analytics` is mounted in `app/layout.tsx` and only renders in production builds.

## Package manager

`pnpm` is canonical (the repo ships `pnpm-lock.yaml` and `node_modules` was installed with pnpm). A `package-lock.json` is also present from an earlier `npm install` — leave it alone, install with pnpm only.

## Commands

Only four scripts exist in `package.json` — there is no test, typecheck, or format script:

| Task | Command |
| --- | --- |
| Dev server (Turbopack) | `pnpm dev` |
| Production build | `pnpm build` |
| Start built app | `pnpm start` |
| Lint | `pnpm lint` |

There is no `tsc` script; run `pnpm exec tsc --noEmit` if you need a one-off type check. `next build` will not fail on type errors (see gotchas).

## Layout

```
app/                      Next.js App Router entry — single page at app/page.tsx
  layout.tsx              Root layout, metadata, Analytics mount, Header + Footer
  page.tsx                Dashboard page (async server component, force-dynamic): fetches runs via getAllProductionRuns() → DashboardContent
  globals.css             Tailwind v4 @import + @theme inline design tokens (oklch)
actions/
  api.ts                  Server data fetchers against the external REST backend. See "Data flow" below.
components/               Feature components (dashboard-content, kpi-cards, supervision-table, filters-bar, turno-badge, mode-toggle, theme-provider)
  layout/                 header.tsx, footer.tsx (mounted by app/layout.tsx)
  ui/                     shadcn-generated primitives (base-nova style). Add new ones with `pnpm dlx shadcn@latest add <name>`.
lib/
  utils.ts                `cn()` helper (clsx + tailwind-merge)
  format.ts               es-AR Intl formatters used across the dashboard
  production-data.ts      In-memory mock dataset (50 runs) + `getProductionPage()` pager + ProductionRun/ProductionResponse types
  sync-store.ts           Client store for the "última sincronización" timestamp
  __tests__/              Unit tests (no run script in package.json — run ad-hoc with `pnpm exec vitest run` or the runner present in node_modules)
public/                   Static icons + create-next-app placeholder assets (do not delete the placeholders — they're treated as content for now)
```

Data flow: `app/page.tsx` is an async server component (`export const dynamic = "force-dynamic"` — never statically prerendered) that calls `getAllProductionRuns()` from `actions/api.ts`, which GETs `GET ${NEXT_PUBLIC_API_URL}/api/v1/lotes-productivos?page=1&pageSize=100` with an 8s `AbortController` timeout and `cache: "no-store"`. On any error/timeout it falls back to the in-memory `PRODUCTION_RUNS` mock from `lib/production-data.ts` and renders an error banner. The page hands `runs` + `lastSyncAt` to `DashboardContent` (`components/dashboard-content.tsx`, `"use client"`), which holds filter state and an `EventSource` SSE subscription to `${NEXT_PUBLIC_API_URL}/api/v1/lotes-productivos/events` for live `lote.created` pushes, and composes `KpiCards` + `FiltersBar` + `SupervisionTable`.

Backend: there IS now an external backend — a Go service on Render (free-tier) at `NEXT_PUBLIC_API_URL` (see `.env.example`). It sleeps after ~15 min idle (cold-start 30–60 s). The 8s fetch timeout + mock fallback exist specifically to tolerate that cold-start at runtime and at build time.

## Conventions specific to this repo

- UI copy is in **Spanish (es-AR locale)**. Use `new Intl.*` with `"es-AR"` and the existing helpers in `lib/format.ts`. Do not translate to English.
- Path alias `@/*` resolves to the repo root (configured in `tsconfig.json` and `components.json`).
- `components.json` declares the `base-nova` style and `lucide` icon library — keep both when adding shadcn components.
- Tailwind v4 tokens live entirely in `app/globals.css` (`@theme inline` + `:root` / `.dark` oklch vars). Add new design tokens there, not in a JS config.
- Some components contain Spanish developer notes / TODOs (e.g. `components/header.tsx:22`). Leave them — they are intentional backlog markers, not bugs.

## Gotchas

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`. The build will pass even with type errors; still try to keep types clean.
- `next.config.ts` also exists but is empty boilerplate and is not what Next.js loads (`.mjs` wins). Don't edit it — edit `next.config.mjs`.
- `lucide-react` is pinned at `^1.16.0` and `next` at `16.2.6` (pinned exact, no caret). Don't bump either casually — other deps assume these versions.
- The `pnpm dev` server uses Turbopack by default in Next 16; the page is fully client-rendered for the table and footer (both marked `"use client"`). KPI cards and header are server components.
- `package.json` `name` is still the default `my-project` and `README.md` is unmodified `create-next-app` boilerplate — neither is the source of truth for the project name (use `app/layout.tsx` metadata / footer string `Smart-Check Automation`).
- Build-time static generation of `/` used to time out (>60 s) on Vercel because the server component fetched the Render backend during prerender (Render free-tier cold-start). Fixed with `export const dynamic = "force-dynamic"` in `app/page.tsx` + the 8s `AbortController` timeout in `actions/api.ts`. Do NOT remove either, or the Vercel build will break again when Render is cold.
- The SSE `EventSource` in `components/dashboard-content.tsx` also hits Render; a cold backend there will keep the client retrying silently. Tolerated for now — see the backend note under "Data flow".
- `package.json` has no test script, but `lib/__tests__/*.test.ts` exist. Run them ad-hoc with `pnpm exec vitest run` (or the runner present in `node_modules`) — don't assume Jest by default.

## Skills

`.agents/skills/` is a curated set of domain skills (shadcn, tailwind-v4-shadcn, react/next best practices, a11y, seo, etc.). Load them with the `skill` tool when the task matches their description — they are the repo's preferred reference over generic knowledge.
