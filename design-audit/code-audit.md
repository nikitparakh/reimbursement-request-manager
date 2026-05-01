# Code-Level Style Audit

## Spacing

**Findings**

- The app shell is predictable: `main` uses horizontal padding and vertical rhythm from the layout, not per-page art direction.

```7:8:src/app/(app)/layout.tsx
      <main className="bg-background mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
```

- Major screens repeat the same vertical stack: `space-y-6` on the root (`profile`, `admin/inbox`, `admin/requests`, `user/requests`, `admin/teams`, `admin/requests/[id]`).

- `gap-4` shows up repeatedly for grids and dashboard tile rows. Fractional steps (`gap-2.5`, `py-2.5`, `gap-1.5`) live inside shadcn primitives. Mixes "4-step" layout spacing with "0.25rem-tuned" control spacing without a documented rule.

- Verdict: Tailwind-default "comfortable SaaS" feel, not an intentional 8pt system.

---

## Border Radius

- Cards are globally `rounded-xl` with `ring-1 ring-foreground/10`. Everything reads as one surface family.

- `rounded-lg` dominates inputs, buttons, popovers/select content (Nova/shadcn defaults).

- `rounded-md` for denser spots (timeline comment chips, collapsible triggers, dashboard `TileIcon` container).

- `rounded-full` for icon wells, unread dots, scroll thumbs.

- Outlier: `badge.tsx` uses `rounded-4xl` (pill) — distinct shape language from cards.

```8:8:src/components/ui/badge.tsx
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent ...
```

**Verdict:** Consistent because shadcn defaults are enforced everywhere, not because the product defined roles.

---

## Color tokens

- `components.json` confirms slate + CSS variables (matches plan).

- `chart-*` utilities are dead weight in components. Search for `bg-chart-` / `text-chart-` under `src` returned zero matches. Defined in CSS but unused in TSX.

```17:21:src/app/globals.css
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
```

- `primary` is almost entirely "slate button / link / focus" (OKLCH neutrals), not a brand chroma.

- `accent` shows up mostly in menu/select focus (`focus:bg-accent`) — i.e. still a gray wash.

- The only strong chroma in first-party UI lives in `status-badge.tsx`, which hard-codes Tailwind palette classes (amber/emerald/red/indigo/cyan/purple/blue). Useful for states, but sits outside the semantic token story and still feels like "default status colors."

**Verdict:** Yes, the page chrome is duotone slate (`background` / `card` / `muted-foreground`), with `destructive` and status-badge rainbows as exceptions. `chart-*` is dead weight in components.

---

## Typography

**Font setup**

- No `next/font` / Geist import appears anywhere under `src`. Root layout applies `font-sans` on `<body>` only.

```10:17:src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen font-sans text-foreground antialiased">
        {children}
        <Toaster richColors closeButton />
```

- `globals.css` maps `--font-heading` to `--font-sans` — `font-heading` is literally not a second voice.

```7:8:src/app/globals.css
    --font-heading: var(--font-sans);
    --font-sans: var(--font-sans);
```

**Type scale / hierarchy**

- `PageHeader` titles stop at `text-xl` → `sm:text-2xl`. There is **no oversized display type** anywhere in the hierarchy.

```27:37:src/components/ui/page-header.tsx
            <h1
              className={cn(
                "font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              )}
            >
```

- `CardTitle` defaults to `text-base` (`card.tsx`), so section titles collapse toward body copy.

- `text-sm` + `font-medium` / `font-semibold` carry most hierarchy.

- Italics exist only for "empty / placeholder" affordances.

- `tabular-nums` appears in one comments badge — good, but isolated.

---

## Motion / Animation

- Motion is almost entirely Radix/shadcn defaults: `animate-in` / `fade-in` / `zoom-in-95` on overlays, `transition-colors` on inputs/buttons, `animate-spin` on loaders, `animate-pulse` on some badges.

- One product-level motion touch: chevron rotate on a collapsible card (`collapsible-request-card.tsx:172`).

- No custom `@keyframes` in `globals.css`. Theme imports `tw-animate-css` but that's library-driven, not bespoke motion.

- No route-level transitions.

**Verdict:** Functional, library-default micro-motion only. Nothing that signals "crafted product."

---

## Backgrounds

- No gradients, mesh, grain, or dot grids. Searches for `bg-gradient`, `bg-grid`, `noise`, `backdrop-` returned only dialog/sheet scrims (`bg-black/10` + light blur).

- Surfaces are flat `bg-background` / `bg-card` / `bg-muted/20`. `EmptyState` dashed border is the lone "texture" cue.

**Verdict:** Visually shallow depth — everything reads like a spreadsheet app skin.

---

## Shadows

- Default cards don't ship a drop shadow; depth is `ring-1` (very Nova/modern shadcn).

- `shadow-sm` applied manually on auth cards, fatal error states, navbar.

- Overlays use `shadow-md` / `shadow-lg` from primitives.

**Verdict:** Conservative and template-y; no layered/branded shadow language.

---

## Hover / focus / active

- Buttons have `active:translate-y-px` — small "physical" press, nicer than pure opacity but still generic.

- Navigation uses muted hovers / opacity (navbar `hover:opacity-80`, links `hover:text-primary`).

- Dashboard hover on tiles is `transition-colors hover:border-primary/40` — subtle border tint within grayscale.

- Most interactive polish lives in `src/components/ui/*`, not in feature components.

---

## Page-by-page generic-ness

| Page | Rating | Evidence |
|------|--------|----------|
| `(app)/page.tsx` (dashboard) | Mixed | District logo + `PageHeader` + uniform `Card` tiles with Lucide + `bg-muted` icon wells |
| `profile/page.tsx` | Generic | `PageHeader` + single default `Card` + form. No sectioning, illustration, or bg treatment |
| `admin/inbox/page.tsx` | Generic | Stacked approval cards, classic |
| `admin/requests/page.tsx` | Generic | `PageHeader` + table inside one `Card` |
| `admin/requests/[id]/page.tsx` | Mixed | Slightly richer: back link, 3-up stat cards, sections; still `Card` + `text-2xl` money |
| `admin/teams/page.tsx` | Mixed | Nested cards for registrations add hierarchy |
| `coach/inbox/page.tsx` | Generic | No UI — immediate redirect |
| `user/requests/page.tsx` | Generic | Same pattern as admin list |
| `(auth)/sign-in/page.tsx` | Generic | Centered `Card` + `shadow-sm` + logo + `PageHeader` inside card — textbook template |

**Note:** `src/app/loading.tsx` does not exist. Segment loading lives at `src/app/(app)/loading.tsx`.

---

## Component composition quality

| Component | Rating | Observations |
|-----------|--------|--------------|
| `page-header.tsx` | Generic | Transparent `Card` wrapper; `h1` caps at `text-2xl`. Forgettable |
| `empty-state.tsx` | Generic | `Archive` Lucide, dashed border, muted fill — readable, forgettable |
| `status-timeline.tsx` | Mixed | Functional vertical timeline; muted donut nodes + `Separator` as spine. Fine for ERP, zero wow |
| `status-badge.tsx` | Mixed | Most color literacy in the app, but textbook status colors. Not branded |
| `notification-bell.tsx` | Generic | `Popover` + ghost buttons; unread dot uses `primary`. System UI, anonymous |
| `navbar.tsx` | Generic | Sticky `border-b shadow-sm`, logo, `NavigationMenu`. Standard SaaS chrome. Signed-out CTA duplicates shadcn button styling inline rather than composing `Button` |

---

## Generic-feeling code smells

### BLOCKER

- `src/app/global-error.tsx` is unfinished product UI: raw `<h1>` / `<p>` on `body`, no `Card`, no layout parity with `error.tsx`.

### MAJOR

- `font-heading` is aliased to `font-sans` — promise of hierarchy without implementation.
- No display / mono stack loaded in code despite the rebuild narrative mentioning Geist; `layout.tsx` never imports a font.
- `chart-*` theme tokens unused in components — dead design surface area.
- Surface system is uniform: global `Card` = `rounded-xl` + subtle ring (no intentional elevation steps).

### MINOR

- Navbar signed-out `<Link>` reimplements `Button` colors by hand (`navbar.tsx:67-71`).
- `status-badge.tsx` uses bespoke Tailwind color classes instead of mapping to semantic tokens.
- No emoji / illustration layer anywhere.
- Coach `inbox` route is a redirect stub — routes suggest structure the UI doesn't deliver.

---

## TL;DR

The codebase is a faithful shadcn/radix-nova implementation on slate variables: `space-y-6` page shells, `Card` / `PageHeader` / table compositions, `ring-1` cards, `text-sm` + `medium/semibold` hierarchy, library-default motion. The only places that break the gray box are status badges (hard-coded Tailwind colors) and occasional primary-tint hovers — not enough to feel like a designed product.

The single biggest opportunity is to introduce a real typographic and color system: load a distinct display face via `next/font`, widen the hue story beyond slate + destructive, and elevate layouts beyond "transparent header + xl card lattice."
