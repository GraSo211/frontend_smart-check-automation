# Smart-Check Automation — Style Reference
> serif analytics on warm paper

**Theme:** Smart-Check light/dark

Smart-Check Automation uses a navy, warm-paper and sky-blue system with an explicit light/dark pair. The light theme prioritizes a warm canvas and navy text; the dark theme uses deep navy surfaces with warm-white text and sky-blue primary emphasis. Orange marks attention and operational accents, while semantic green, red and blue tokens communicate status without changing the existing hierarchy or component geometry.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Token | Light | Dark | Role |
| `--background` / `--foreground` | `#F4EFE6` / `#1B2A3A` | `#0F172A` / `#F4EFE6` | Canvas and primary readable text |
| `--card` / `--popover` | `#FFFFFF` | `#1B2A3A` | Elevated surfaces and overlays |
| `--primary` | `#1B2A3A` | `#38BDF8` | Main action and focus emphasis |
| `--secondary` / `--muted` | `#2C3E50` / `#E8E2D6` | `#2C3E50` / `#1E293B` | Supporting surfaces and quiet regions |
| `--accent` | `#E57C20` | `#E57C20` | Operational highlight and attention |
| `--destructive` | `#D32027` | `#FF5252` | Danger, denied access and critical conditions |
| `--success` | `#16805C` | `#5EE0AD` | Healthy, active and completed states |
| `--warning` | `#B86B12` | `#F6A04D` | Attention and threshold states |
| `--info` | `#1687B8` | `#38BDF8` | Informational/live system states |
| `--chart-*` / `--series-*` | Navy, sky, orange, red, slate | Sky, orange, red, slate, warm-white | Data series with stable semantic contrast |

## Tokens — Typography

### Signifier — Display and headline serif — used exclusively for H1/H2 at three sizes; weight stays at 400 (regular) at every scale, which is the signature choice: the serif whispers authority rather than shouting in bold · `--font-signifier`
- **Substitute:** GT Sectra, Tiempos Headline, Source Serif 4, or ui-serif/Georgia as fallback
- **Weights:** 400
- **Sizes:** 44px, 64px, 90px
- **Line height:** 1.30
- **Letter spacing:** -2.25px at 90px, -0.96px at 64px, -0.66px at 44px
- **Role:** Display and headline serif — used exclusively for H1/H2 at three sizes; weight stays at 400 (regular) at every scale, which is the signature choice: the serif whispers authority rather than shouting in bold

### Sohne — Body, UI, and navigation sans — the workhorse covering everything from 14px metadata to 26px subheads; the half-step weights (430, 450, 480) create fine-grained hierarchy without jumping to bold · `--font-sohne`
- **Substitute:** Inter, Söhne (Klim Type Foundry), or ui-sans-serif/system-ui stack
- **Weights:** 400, 430, 450, 480, 500
- **Sizes:** 14px, 15px, 16px, 17px, 18px, 20px, 22px, 26px
- **Line height:** 1.00–1.50
- **Letter spacing:** -0.234px at 26px, -0.162px at 18px, 0 at body sizes
- **Role:** Body, UI, and navigation sans — the workhorse covering everything from 14px metadata to 26px subheads; the half-step weights (430, 450, 480) create fine-grained hierarchy without jumping to bold

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 15px | 1.5 | — | `--text-caption` |
| body | 17px | 1.35 | — | `--text-body` |
| body-lg | 20px | 1.35 | — | `--text-body-lg` |
| subheading | 22px | 1.5 | — | `--text-subheading` |
| heading-sm | 26px | 1.18 | -0.23px | `--text-heading-sm` |
| heading | 44px | 1.3 | -0.66px | `--text-heading` |
| heading-lg | 64px | 1.3 | -0.96px | `--text-heading-lg` |
| display | 90px | 1.3 | -2.25px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |
| 124 | 124px | `--spacing-124` |
| 128 | 128px | `--spacing-128` |
| 160 | 160px | `--spacing-160` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 24px |
| images | 12px |
| inputs | 16px |
| buttons | 9999px |
| smallCards | 16px |
| elevatedCards | 20px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.08) ...` | `--shadow-subtle` |
| subtle-2 | `oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0...` | `--shadow-subtle-2` |
| subtle-3 | `rgba(4, 23, 43, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1)...` | `--shadow-subtle-3` |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 80px
- **Card padding:** 20px
- **Element gap:** 8px

## Components

### Pill Button — Filled
**Role:** Primary call-to-action (Get started, Book a demo)

Background `--primary`, text `--primary-foreground`, border 1px solid `--primary-foreground` (invisible against fill), border-radius 9999px (fully rounded), padding 0 20px, height auto with text. Sohne 16px weight 400. No shadow. The pill shape and primary fill is the signature action element.

### Pill Button — Ghost
**Role:** Secondary action paired with filled primary (Book a demo beside Get started)

Background transparent, text `--primary`, border 1px solid `--primary`, border-radius 9999px, padding 0 20px. Sohne 16px weight 400. Shares the pill geometry with the filled variant so they read as a matched pair on the same baseline.

### Text Link with Arrow
**Role:** Inline navigation and section transitions (Learn more →, Read the story →)

No background, no border, no border-radius, text `--primary`, Sohne 16px weight 400, padding 20px 0. The arrow glyph (→) is part of the label, not a separate icon. This is the lowest-emphasis interactive element — underlines only on hover.

### Nav Link
**Role:** Top navigation items (Product, Resources, Customers, Pricing)

No background or border, text `--primary`, Sohne 16px weight 400, padding 2px 0. Sits in a transparent top bar with the logo left and CTAs right. The nav is whisper-quiet — no background, no shadow, no separator.

### Neutral Card
**Role:** Feature blocks, content containers, and base card surface

Background `--card` or `--muted`, border-radius 24px, no shadow, no border, padding varies (0 internally with content children providing their own padding). This is the default workhorse card — flat, soft, and quiet.

### Accent Operational Card
**Role:** Editorial highlight or callout panel (customer quotes, feature spotlights)

Background `--accent`, text and strokes `--accent-foreground`, border-radius 24px, no shadow, no border. The orange accent creates operational emphasis — these cards should be rare (one per page maximum) to preserve their impact.

### Floating Product Artifact
**Role:** Hero and section visual elements (region table, activation chart, registration card, AI composer)

Background `--card`, border-radius 20px, subtle box-shadow: 0 0 0 1px rgba(4,23,43,0.05), 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1), padding 16px 20px 12px 12px. These are the product UI fragments that float around hero text — they are the only elements with visible shadow, and only at 10% opacity.

### Input / Composer
**Role:** AI question input field (Ask anything…)

Background `--card`, border 1px solid `--border` or hairline, border-radius 16px, padding 16px, placeholder text `--muted-foreground` in Sohne 16px. Contains left-side @ and ⓘ icons and a right-side primary circular send button (40px diameter, `--primary` fill, primary-foreground arrow icon).

### Stat Card with Chart
**Role:** Data display fragment (Registrations 2.4k, Activation 46.2%)

Card floating artifact surface with a bold metric in Sohne 20px weight 500 `--foreground`, a delta line (↑ 5.5x vs last week) in Sohne 14px `--muted-foreground`, and a minimal line or radial chart in `--chart-1` stroke. No axes, no gridlines — the chart is a gestural line, not a data dashboard.

### Avatar Bubble
**Role:** User presence indicator on floating cards (JB, AF initials)

Circular, 40px diameter, border-radius 9999px, background tinted (light green for JB, light blue for AF), 2-letter monogram in Sohne weight 500, small directional arrow (cursor pointer) extending from the bubble edge.

### Tag / Category Label
**Role:** Section or content category markers (Marketing, Finance, Sales)

No background, no border, text in Sohne 14px weight 400 `--muted-foreground`. Intentionally ghost-like — these are typographic tags, not badges. They group without visual weight.

## Do's and Don'ts

### Do
- Use Signifier weight 400 at 44/64/90px for all display and heading copy; never substitute a sans-serif at these sizes
- Use the `--accent` card surface at most once per page and only for operational emphasis — treat it as a rare accent, not a background
- Set border-radius to 9999px on all buttons and 24px on all content cards; these are the two structural radii of the system
- Pair every filled pill button (`--primary`) with a ghost pill button (`--primary` border, transparent fill) as a secondary action on the same row
- Use Sohne half-step weights (430, 450, 480) for body hierarchy before reaching weight 500 — the scale is finer than standard 400/500/700
- Set letter-spacing to -0.025em on 90px display, -0.015em on 64/44px headings, and -0.009em on 26/18px Sohne — tighter tracking at larger sizes is the typographic signature
- Keep the 4px base unit: use 4/8/12/16/20/24px for component padding, and 80px for section gaps

### Don't
- Don't use colors outside the defined Smart-Check semantic and chart tokens; use success, warning, info and critical only for their intended states
- Don't use bold (600+) or semibold (500) weights in Signifier — the serif stays at 400 across all sizes, that restraint is the signature
- Don't apply drop shadows to content cards (Neutral Card or Accent Operational Card) — only floating product artifacts earn elevation
- Don't use border-radius below 16px on cards or below 9999px on buttons — sharp corners and moderate radii are not part of this system
- Don't underline inline text links at rest — the arrow suffix (→) carries the link affordance; underlines appear only on hover
- Don't place the `--accent` card on a non-card section background — it needs `--card` or `--muted` beneath it to preserve contrast
- Don't use status colors outside their semantic roles; `--critical` and `--warning` are reserved for threshold and danger states

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Canvas | `--background` | Default page background |
| 1 | Card Mist | `--muted` | Quietly nested content blocks, feature cards, tab panels |
| 2 | Section Fog | `--secondary` | Alternating section bands that break up the canvas without contrast |
| 3 | Accent Operational | `--accent` | Operational accent cards and attention emphasis |
| 4 | Elevated Card | `--card` | Floating product UI artifacts (region tables, activation charts, AI composer) that overlap hero/section content with subtle shadow |

## Elevation

- **Floating Product Artifact:** `0 0 0 1px rgba(4,23,43,0.05), 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)`
- **Modal / Overlay Card:** `oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0,0,0,0.1) 0px 8px 40px 0px`
- **Dropdown / Popover:** `oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0,0,0,0.08) 0px 4px 24px 0px`

## Imagery

Imagery is product-first, not lifestyle: floating UI fragments (region tables with 5-row data, line charts showing activation over Aug–Nov, radial progress rings, AI input composers) are positioned as cropped screenshots around editorial headlines. No photography, no illustration, no abstract graphics. All product visuals sit on `--card` floating-artifact cards with hairline borders and soft 10% shadows. Avatar circles carry a small directional cursor pointer — a visual motif that signals live interaction. The hero composition is a text-and-UI collage, not a centered headline with a stock photo.

## Layout

Page model is max-width 1200px centered, with hero sections going near full-bleed but staying within the container. The hero pattern is a centered oversized serif headline with a subhead and pill button pair, surrounded by four floating product artifact cards (region table top-left, registration card right, activation chart bottom-left, AI composer bottom-center) that overlap the `--background` canvas at varied offsets. Sections alternate between `--background` and `--muted` backgrounds to create quiet rhythm without strong contrast. Feature sections use a 2-column text+UI layout with generous 80px vertical gaps. Navigation is a single transparent top bar (no background, no border, no shadow) with logo left, nav links center, and two CTAs (text link + filled pill) right. The overall density is spacious — the page breathes between sections, and content never crowds the edges.

## Agent Prompt Guide

## Quick Color Reference
- light text: #1B2A3A · dark text: #F4EFE6
- light background: #F4EFE6 · dark background: #0F172A
- border: #C9D3DF (light) · #2C3E50 (dark)
- muted text: #4A5568 (light) · #94A3B8 (dark)
- accent: #E57C20
- primary action: #1B2A3A (light) · #38BDF8 (dark)
- status: success #16805C/#5EE0AD · warning #B86B12/#F6A04D · info #1687B8/#38BDF8 · critical #D32027/#FF5252

## Example Component Prompts
1. **Hero headline + accent card collage**: `--background` canvas. Display headline at 90px Signifier weight 400, `--foreground`, letter-spacing -2.25px, with one italicized phrase mid-sentence. Subhead at 17px Sohne weight 400, `--muted-foreground`. Below: a filled pill button (background `--primary`, text `--primary-foreground`, border-radius 9999px, padding 0 20px, Sohne 16px) and a ghost pill button (background transparent, border 1px solid `--primary`, text `--primary`, border-radius 9999px) side by side. Surround the text with three `--card` floating product artifact cards: a data table card, a line chart card, and a stat card — each with background `--card`, border-radius 20px, box-shadow 0 0 0 1px rgba(4,23,43,0.05) + 0 20px 25px -5px rgba(0,0,0,0.1), positioned with negative margins to overlap the text margins.

2. **Accent editorial card**: Background `--accent`, text `--accent-foreground`, border-radius 24px, no shadow, padding 40px. Title at 26px Sohne weight 450, `--accent-foreground`, letter-spacing -0.23px. Body quote at 18px Sohne weight 430, `--accent-foreground`. Attribution at 14px Sohne weight 400, `--accent-foreground`. Place this card once on a `--background` section, never on a low-contrast background.

3. **Neutral feature card**: Background `--muted`, border-radius 24px, no shadow, padding 32px 20px. Category label at 14px Sohne weight 400, `--muted-foreground` (no background, no badge style). Title at 20px Sohne weight 500, `--foreground`. Body at 16px Sohne weight 400, `--foreground`, line-height 1.5. Text link below: Sohne 16px weight 400, `--primary`, no border-radius, padding 20px 0, with → arrow suffix.

4. **AI composer input**: `--card` background, border 1px solid `--border`, border-radius 16px, padding 16px, width 480px. Placeholder text Ask anything… at 16px Sohne weight 400, `--muted-foreground`. Left side: two ghost icon buttons (40px circle, no fill). Right side: 40px circular send button with background `--primary`, primary-foreground arrow icon centered.

5. **Section with alternating background**: Section background `--secondary`, padding 80px vertical. Section title at 64px Signifier weight 400, `--foreground`, letter-spacing -0.96px. Subhead at 18px Sohne weight 430, `--muted-foreground`. Below: 3-column grid of neutral feature cards (`--muted` background, 24px radius, 20px padding, no shadow) with 24px column gap.

## Similar Brands

- **Linear** — Same focused dark-text-on-surface approach with oversized serif-free type and pill-shaped CTAs; Linear's restraint matches this system's clarity
- **Pitch** — Presentation tool that pairs serif display headlines with a warm accent palette and floating UI cards; shares the editorial-product hybrid visual language
- **Arc** — Browser with a soft warm-toned interface, generous border-radius on cards, and the same whisper-quiet typography approach
- **Framer** — Large serif headlines floating over white with minimal chrome and pill controls; shares the magazine-spread page architecture

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --background: #F4EFE6;
  --foreground: #1B2A3A;
  --card: #FFFFFF;
  --primary: #1B2A3A;
  --primary-foreground: #F4EFE6;
  --secondary: #2C3E50;
  --muted: #E8E2D6;
  --muted-foreground: #4A5568;
  --accent: #E57C20;
  --destructive: #D32027;
  --success: #16805C;
  --warning: #B86B12;
  --info: #1687B8;
  --critical: #D32027;

  /* Typography — Font Families */
  --font-signifier: 'Signifier', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-sohne: 'Sohne', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 15px;
  --leading-caption: 1.5;
  --text-body: 17px;
  --leading-body: 1.35;
  --text-body-lg: 20px;
  --leading-body-lg: 1.35;
  --text-subheading: 22px;
  --leading-subheading: 1.5;
  --text-heading-sm: 26px;
  --leading-heading-sm: 1.18;
  --tracking-heading-sm: -0.23px;
  --text-heading: 44px;
  --leading-heading: 1.3;
  --tracking-heading: -0.66px;
  --text-heading-lg: 64px;
  --leading-heading-lg: 1.3;
  --tracking-heading-lg: -0.96px;
  --text-display: 90px;
  --leading-display: 1.3;
  --tracking-display: -2.25px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-w430: 430;
  --font-weight-w450: 450;
  --font-weight-w480: 480;
  --font-weight-medium: 500;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-124: 124px;
  --spacing-128: 128px;
  --spacing-160: 160px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 80px;
  --card-padding: 20px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-sm: 0.01px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;

  /* Named Radii */
  --radius-cards: 24px;
  --radius-images: 12px;
  --radius-inputs: 16px;
  --radius-buttons: 9999px;
  --radius-smallcards: 16px;
  --radius-elevatedcards: 20px;

  /* Shadows */
  --shadow-subtle: oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.08) 0px 4px 24px 0px;
  --shadow-subtle-2: oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 8px 40px 0px;
  --shadow-subtle-3: rgba(4, 23, 43, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px;

  /* Surfaces */
  --surface-canvas: var(--background);
  --surface-card-mist: var(--muted);
  --surface-section-fog: var(--secondary);
  --surface-accent-operational: var(--accent);
  --surface-elevated-card: var(--card);
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --background: #0F172A;
  --foreground: #F4EFE6;
  --card: #1B2A3A;
  --primary: #38BDF8;
  --primary-foreground: #0F172A;
  --secondary: #2C3E50;
  --muted: #1E293B;
  --muted-foreground: #94A3B8;
  --accent: #E57C20;
  --destructive: #FF5252;
  --success: #5EE0AD;
  --warning: #F6A04D;
  --info: #38BDF8;
  --critical: #FF5252;

  /* Typography */
  --font-signifier: 'Signifier', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-sohne: 'Sohne', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 15px;
  --leading-caption: 1.5;
  --text-body: 17px;
  --leading-body: 1.35;
  --text-body-lg: 20px;
  --leading-body-lg: 1.35;
  --text-subheading: 22px;
  --leading-subheading: 1.5;
  --text-heading-sm: 26px;
  --leading-heading-sm: 1.18;
  --tracking-heading-sm: -0.23px;
  --text-heading: 44px;
  --leading-heading: 1.3;
  --tracking-heading: -0.66px;
  --text-heading-lg: 64px;
  --leading-heading-lg: 1.3;
  --tracking-heading-lg: -0.96px;
  --text-display: 90px;
  --leading-display: 1.3;
  --tracking-display: -2.25px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-124: 124px;
  --spacing-128: 128px;
  --spacing-160: 160px;

  /* Border Radius */
  --radius-sm: 0.01px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;

  /* Shadows */
  --shadow-subtle: oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.08) 0px 4px 24px 0px;
  --shadow-subtle-2: oklab(0 0 0 / 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 8px 40px 0px;
  --shadow-subtle-3: rgba(4, 23, 43, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px;
}
```
