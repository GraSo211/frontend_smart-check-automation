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
  layout.tsx              Root layout, metadata, Analytics mount
  page.tsx                Dashboard page: Header → KpiCards → SupervisionTable → Footer
  globals.css             Tailwind v4 @import + @theme inline design tokens (oklch)
components/               Feature components (header, kpi-cards, supervision-table, turno-badge, footer)
  ui/                     shadcn-generated primitives (base-nova style). Add new ones with `pnpm dlx shadcn@latest add <name>`.
lib/
  utils.ts                `cn()` helper (clsx + tailwind-merge)
  format.ts               es-AR Intl formatters used across the dashboard
  production-data.ts      In-memory mock dataset (50 runs) + `getProductionPage()` pager
public/                   Static icons + create-next-app placeholder assets (do not delete the placeholders — they're treated as content for now)
```

Data flow: `app/page.tsx` imports `PRODUCTION_RUNS` from `lib/production-data.ts` and passes it to `KpiCards`. The table is a client component that paginates the same in-memory dataset via `getProductionPage`. There is no backend, no API route, no DB.

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

## Skills

`.agents/skills/` is a curated set of domain skills (shadcn, tailwind-v4-shadcn, react/next best practices, a11y, seo, etc.). Load them with the `skill` tool when the task matches their description — they are the repo's preferred reference over generic knowledge.
