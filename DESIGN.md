# Smart-Check Automation — Referencia de diseño

Sistema de diseño del panel de supervisión de producción de Fermar S.A. La
interfaz usa un **sistema de temas dual**: la identidad **Fermar** (cálida, en
`oklch`) y la identidad **SCA** (navy + celeste, en `hex`). Cada identidad tiene
su variante clara y oscura, y el tema se aplica con el atributo `data-theme` en
`<html>`.

Fuente de verdad: [`app/globals.css`](app/globals.css) y
[`app/layout.tsx`](app/layout.tsx). No existe `tailwind.config.*`: Tailwind v4 se
configura en CSS con `@theme inline`.

## Tipografía

Las fuentes se cargan con `next/font/google` en `app/layout.tsx` y se exponen
como variables CSS.

| Rol | Fuente | Variable | Uso |
|---|---|---|---|
| Sans / cuerpo | **Outfit** | `--font-sans` | Texto, UI y navegación |
| Títulos | **Sora** | `--font-heading` | `h1`–`h6` (aplicado en `@layer base`) |
| Mono | Geist Mono | `--font-mono` | Datos técnicos y telemetría (declarada en `@theme inline`; no se carga vía `next/font`) |

`html` usa `font-sans` por defecto; el `<body>` recibe ambas variables.

## Temas

`ThemeProvider` (`components/theme-provider.tsx`) aplica el tema con
`attribute="data-theme"` y acepta cuatro valores:

| Tema | Selector en `globals.css` | Formato | Rol |
|---|---|---|---|
| `fermar-light` | `:root` | oklch | Base por defecto cuando no hay atributo |
| `fermar-dark` | `[data-theme="fermar-dark"], [data-theme="dark"]` | oklch | Oscuro de Fermar; `dark` es alias heredado |
| `sca-light` | `[data-theme="sca-light"]` | hex | Identidad SCA clara |
| `sca-dark` | `[data-theme="sca-dark"]` | hex | **`defaultTheme`** de la app |

La variante `dark:` de Tailwind se define como
`@custom-variant dark (&:is([data-theme$="-dark"] *))`: aplica a cualquier tema
cuyo nombre termine en `-dark`.

## Tokens de color

Todos los tokens viven en `app/globals.css` (en `:root` y en los bloques
`[data-theme=...]`) y se exponen a Tailwind desde `@theme inline` como
`--color-<token>`. En los componentes se usan como utilidades (`bg-background`,
`text-muted-foreground`, `border-border`, …), no como valores crudos.

### Tema Fermar (oklch)

| Token | `fermar-light` (`:root`) | `fermar-dark` |
|---|---|---|
| `--background` | `oklch(0.972 0.022 83.3)` | `oklch(0.2 0.025 355)` |
| `--foreground` | `oklch(0.338 0.042 3.3)` | `oklch(0.972 0.022 83.3)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.26 0.03 355)` |
| `--card-foreground` | `oklch(0.338 0.042 3.3)` | `oklch(0.972 0.022 83.3)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.26 0.03 355)` |
| `--popover-foreground` | `oklch(0.338 0.042 3.3)` | `oklch(0.972 0.022 83.3)` |
| `--primary` | `oklch(0.759 0.121 8)` | `oklch(0.759 0.121 8)` |
| `--primary-foreground` | `oklch(0.338 0.042 3.3)` | `oklch(0.338 0.042 3.3)` |
| `--secondary` | `oklch(0.94 0.015 60)` | `oklch(0.26 0.03 355)` |
| `--secondary-foreground` | `oklch(0.338 0.042 3.3)` | `oklch(0.972 0.022 83.3)` |
| `--muted` | `oklch(0.95 0.012 60)` | `oklch(0.24 0.025 355)` |
| `--muted-foreground` | `oklch(0.5 0.035 30)` | `oklch(0.65 0.03 60)` |
| `--accent` | `oklch(0.667 0.151 55.1)` | `oklch(0.667 0.151 55.1)` |
| `--accent-foreground` | `oklch(1 0 0)` | `oklch(0.338 0.042 3.3)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--border` | `oklch(0.85 0.015 60)` | `oklch(0.4 0.03 355 / 0.5)` |
| `--input` | `oklch(0.85 0.015 60)` | `oklch(0.4 0.03 355 / 0.6)` |
| `--ring` | `oklch(0.759 0.121 8)` | `oklch(0.759 0.121 8)` |

### Tema SCA (hex)

| Token | `sca-light` | `sca-dark` |
|---|---|---|
| `--background` | `#F4EFE6` | `#0F172A` |
| `--foreground` | `#1B2A3A` | `#F4EFE6` |
| `--card` | `#FFFFFF` | `#1B2A3A` |
| `--card-foreground` | `#1B2A3A` | `#F4EFE6` |
| `--popover` | `#FFFFFF` | `#1B2A3A` |
| `--popover-foreground` | `#1B2A3A` | `#F4EFE6` |
| `--primary` | `#1B2A3A` | `#38BDF8` |
| `--primary-foreground` | `#F4EFE6` | `#0F172A` |
| `--secondary` | `#2C3E50` | `#2C3E50` |
| `--secondary-foreground` | `#F4EFE6` | `#F4EFE6` |
| `--muted` | `#E8E2D6` | `#1E293B` |
| `--muted-foreground` | `#4A5568` | `#94A3B8` |
| `--accent` | `#E57C20` | `#E57C20` |
| `--accent-foreground` | `#FFFFFF` | `#0F172A` |
| `--destructive` | `#D32027` | `#FF5252` |
| `--border` | `#C9D3DF` | `#2C3E50` |
| `--input` | `#C9D3DF` | `#2C3E50` |
| `--ring` | `#1B2A3A` | `#38BDF8` |

### Sidebar

Cada tema define su propia paleta de sidebar (`--sidebar*`), que consumen las
primitivas de `components/ui/sidebar.tsx`.

| Token | `fermar-light` | `fermar-dark` | `sca-light` | `sca-dark` |
|---|---|---|---|---|
| `--sidebar` | `oklch(0.338 0.042 3.3)` | `oklch(0.16 0.02 355)` | `#1B2A3A` | `#0A0F1E` |
| `--sidebar-foreground` | `oklch(0.972 0.022 83.3)` | `oklch(0.972 0.022 83.3)` | `#F4EFE6` | `#F4EFE6` |
| `--sidebar-primary` | `oklch(0.759 0.121 8)` | `oklch(0.759 0.121 8)` | `#38BDF8` | `#38BDF8` |
| `--sidebar-primary-foreground` | `oklch(0.338 0.042 3.3)` | `oklch(0.338 0.042 3.3)` | `#0F172A` | `#0F172A` |
| `--sidebar-accent` | `oklch(0.667 0.151 55.1)` | `oklch(0.667 0.151 55.1)` | `#2C3E50` | `#1E293B` |
| `--sidebar-accent-foreground` | `oklch(1 0 0)` | `oklch(1 0 0)` | `#F4EFE6` | `#F4EFE6` |
| `--sidebar-border` | `oklch(0.45 0.035 3.3)` | `oklch(0.3 0.025 355)` | `#2C3E50` | `#1E293B` |
| `--sidebar-ring` | `oklch(0.759 0.121 8)` | `oklch(0.759 0.121 8)` | `#38BDF8` | `#38BDF8` |

## Tokens de estado, series y video

Son semánticos y se comparten entre temas, con variante clara y oscura. Usar
cada color sólo en su rol.

| Token | Claro (`fermar-light` / `sca-light`) | Oscuro (`fermar-dark` / `sca-dark`) | Rol |
|---|---|---|---|
| `--success` | `#16805c` | `#5ee0ad` | Saludable, activo, completado |
| `--warning` | `#b86b12` / `#B86B12` | `#f6a04d` / `#F6A04D` | Atención y umbrales |
| `--info` | `#1687b8` / `#1687B8` | `#38bdf8` / `#38BDF8` | Estados informativos / en vivo |
| `--critical` | `#d32027` / `#D32027` | `#ff5252` / `#FF5252` | Peligro y condiciones críticas |
| `--series-cpu` | `#1687b8` / `#1687B8` | `#38bdf8` / `#38BDF8` | Serie de CPU |
| `--series-ai` | `#e57c20` / `#E57C20` | `#f6a04d` / `#F6A04D` | Serie del procesador de IA |
| `--series-memory` | `#1687b8` / `#1687B8` | `#38bdf8` / `#38BDF8` | Serie de memoria |
| `--video-surface` | `#0b1220` / `#0B1220` | `#0b1220` | Fondo del reproductor WHEP |
| `--video-overlay` | `rgb(0 0 0 / 0.55)` | `rgb(0 0 0 / 0.55)` | Overlay de estado sobre el video |
| `--video-foreground` | `#ffffff` / `#FFFFFF` | `#ffffff` | Texto sobre el video |

> Los literales hex difieren en mayúsculas entre los bloques Fermar y SCA (por
> ejemplo `#16805c` vs `#16805C`). Es el mismo color; se respeta el literal de
> cada bloque.

## Tokens de datos (gráficos)

`--chart-1` a `--chart-5` alimentan las series de gráficos y se exponen como
utilidades `chart-1`…`chart-5`.

| Token | `fermar-light` (`:root`) | `fermar-dark` | `sca-light` | `sca-dark` |
|---|---|---|---|---|
| `--chart-1` | `oklch(0.759 0.121 8)` | `oklch(0.759 0.121 8)` | `#1B2A3A` | `#38BDF8` |
| `--chart-2` | `oklch(0.667 0.151 55.1)` | `oklch(0.667 0.151 55.1)` | `#38BDF8` | `#E57C20` |
| `--chart-3` | `oklch(0.55 0.12 160)` | `oklch(0.55 0.12 160)` | `#E57C20` | `#FF5252` |
| `--chart-4` | `oklch(0.6 0.1 280)` | `oklch(0.6 0.1 280)` | `#D32027` | `#94A3B8` |
| `--chart-5` | `oklch(0.4 0.04 3.3)` | `oklch(0.4 0.04 3.3)` | `#94A3B8` | `#F4EFE6` |

## Radios

El radio base es `--radius: 0.625rem` (10px) y el resto de la escala se deriva
con `calc()`. Cambiar `--radius` re-escala todo el sistema.

| Token | Cálculo | Valor |
|---|---|---|
| `--radius-sm` | `--radius * 0.6` | `0.375rem` |
| `--radius-md` | `--radius * 0.8` | `0.5rem` |
| `--radius-lg` | `--radius` | `0.625rem` |
| `--radius-xl` | `--radius * 1.4` | `0.875rem` |
| `--radius-2xl` | `--radius * 1.8` | `1.125rem` |
| `--radius-3xl` | `--radius * 2.2` | `1.375rem` |
| `--radius-4xl` | `--radius * 2.6` | `1.625rem` |

## Espaciado y sombras

No hay tokens propios de espaciado ni de sombra. La app usa la escala y las
sombras por defecto de Tailwind v4. Si en el futuro se necesitan tokens
globales, se agregan en `app/globals.css`, no en un `tailwind.config.*`.

## Clases de componentes

Definidas en `@layer components` de `app/globals.css`:

| Clase | Rol |
|---|---|
| `.chart-svg` | SVG de gráfico responsivo (ancho completo, `min-height: 150px`). |
| `.offline-badge` | Chip de estado desconectado (borde y fondo mezclados con `--muted`). |
| `.telemetry-offline` | Atenúa en escala de grises un bloque de telemetría sin conexión y restaura el badge. |
| `.critical-pulse` | Pulso de atención con `--destructive`; se desactiva con `prefers-reduced-motion: reduce`. |

## Convenciones

- **Tokens sólo en `app/globals.css`.** No hay `tailwind.config.*`: Tailwind v4
  se configura con `@theme inline` y los colores se mapean como
  `--color-<token>`.
- **Usar utilidades semánticas** (`bg-background`, `text-muted-foreground`,
  `border-border`) en lugar de valores crudos.
- **Colores de estado y series sólo en su rol**: `success`, `warning`, `info`,
  `critical` y `series-*` no son decorativos.
- **La variante oscura** se activa con `[data-theme$="-dark"]`, no con la clase
  `.dark`.
- **Agregar un tema** requiere registrarlo en `app/layout.tsx`
  (`themes={[...]}`) y definir su bloque `[data-theme="..."]` en
  `app/globals.css`.
- **La UI se escribe en español (es-AR)**; el formato de fechas y números sale
  de `lib/format.ts`.
