# shadcn UI Rewrite — Design Document

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Full UI engine swap. Replace every UI primitive in `src/components/ui/` with shadcn/ui equivalents, rebuild every domain component on top of the new primitives, keep all functionality identical.

## Goal

Rebuild the entire UI on shadcn/ui — primitives, compositions, domain components, and pages — without changing any application functionality.

## Non-Goals

- No new product features.
- No status-label cleanup (e.g. `COACH_APPROVED` → "Approved by coach"). Enum text in badges is preserved.
- No information-architecture changes from the UI sensibility audit. Those remain a separate effort.

## Decisions

| Topic | Choice |
|---|---|
| shadcn theme | Out-of-the-box, `baseColor: green`, `cssVariables: true`, `radius: 0.5rem`, default style |
| Scope | Replace primitives **and** rebuild every domain component using shadcn primitives + composition |
| Icons | `lucide-react` everywhere; replace inline SVGs |
| Forms | `react-hook-form` + `zod` for every form (shadcn `<Form>` pattern) |
| Tables | `@tanstack/react-table` + shadcn DataTable pattern for every list table |
| Toasts | `sonner`; replaces transient inline `<Alert>` for fetch results |
| Branding | Keep Novi logo. Use cleaner copy where natural during rebuild. No formal copy migration. |
| Old primitives | Deleted as each consumer migrates. End state: `src/components/ui/` contains only shadcn-generated files plus the documented composition wrappers. |
| Migration order | Bottom-up, one primitive at a time. Each task: generate → migrate consumers → delete old → lint + unit → commit. |
| Verification cadence | Lint + unit per task. Integration per domain group. E2E per phase boundary and at affected milestones. |

## Tech Stack Additions

| Package | Purpose |
|---|---|
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn `cn()` |
| `tailwindcss-animate` (or `tw-animate-css` per shadcn 2026 init) | shadcn animations on Tailwind v4 |
| `lucide-react` | shadcn icon convention |
| `@radix-ui/*` | Pulled per-component by `npx shadcn add` |
| `react-hook-form`, `@hookform/resolvers` | shadcn `<Form>` |
| `@tanstack/react-table` | shadcn DataTable |
| `sonner` | Toasts |
| `cmdk` | Pulled in by shadcn `<Command>` if combobox filters land |
| `date-fns` | Pulled in if Calendar/DatePicker is used |

`zod` is already a dep.

## Architecture

### Foundation files

- New: `components.json` at workspace root.
- New: `src/lib/utils.ts` — exports `cn()`.
- Edit: `src/app/globals.css` — replace lone `@import "tailwindcss";` with shadcn's full Tailwind v4 `@theme inline` block plus OKLCH color tokens (green base) and a `@custom-variant dark` block. Dark mode is wired but unused.
- Edit: `src/app/layout.tsx` — add `<Toaster />` (sonner). Body bg: `bg-background`.
- Keep: `tsconfig.json` — `@/*` paths already match shadcn defaults.

### Component layout (end state)

```
src/components/ui/                     # shadcn-generated + thin compositions kept here
  button.tsx                           shadcn-generated
  card.tsx                             shadcn-generated
  badge.tsx                            shadcn-generated
  input.tsx                            shadcn-generated
  textarea.tsx                         shadcn-generated
  select.tsx                           shadcn-generated (Radix)
  label.tsx                            shadcn-generated
  alert.tsx                            shadcn-generated (extended with success/warning variants)
  form.tsx                             shadcn-generated
  table.tsx                            shadcn-generated
  popover.tsx                          shadcn-generated
  scroll-area.tsx                      shadcn-generated
  sheet.tsx                            shadcn-generated
  dropdown-menu.tsx                    shadcn-generated
  navigation-menu.tsx                  shadcn-generated
  dialog.tsx                           shadcn-generated
  alert-dialog.tsx                     shadcn-generated
  collapsible.tsx                      shadcn-generated
  tooltip.tsx                          shadcn-generated
  switch.tsx                           shadcn-generated
  checkbox.tsx                         shadcn-generated
  separator.tsx                        shadcn-generated
  skeleton.tsx                         shadcn-generated
  pagination.tsx                       shadcn-generated
  sonner.tsx                           shadcn-generated (Toaster wrapper)

  # Compositions kept (all rebuilt on shadcn primitives)
  status-badge.tsx                     wraps <Badge> with status→variant + label maps
  data-table.tsx                       generic DataTable on @tanstack/react-table + shadcn <Table>
  page-header.tsx                      title + description + action layout
  empty-state.tsx                      lucide icon + heading + description
  status-timeline.tsx                  vertical timeline using <Separator> + <StatusBadge>
  field-group.tsx                      label + child + helpText/error shim for non-rhf use
  navbar.tsx                           shadcn <NavigationMenu> + <DropdownMenu>
  mobile-nav-menu.tsx                  shadcn <Sheet> + <NavigationMenu>
  notification-bell.tsx                shadcn <Popover> + <ScrollArea>
```

### Status badge

`status-badge.tsx` preserves the current status→color mapping. shadcn's `<Badge>` accepts `variant: default | secondary | destructive | outline`. The wrapper picks variant + className for the status; pulsing animation for `QUEUED`/`PROCESSING` is preserved via `className`. Label text is unchanged from `src/components/ui/badge.tsx`'s `labelMap`.

### Forms

Every form moves to `react-hook-form` + `zod`:

- A schema lives next to the component (e.g. `signUpSchema` in `src/components/auth/sign-up-form.tsx`).
- The schema mirrors the existing server-side zod validators (e.g. in `src/app/api/auth/register/route.ts`) so client/server stay in sync.
- Submission is the same `fetch(...)` call. Network success → sonner toast and the same redirect/`router.refresh()` behavior. Network failure → field-mapped errors via `setError` plus a `toast.error`.
- The big editable surface — `editable-line-items.tsx` — does **not** move to rhf. It keeps its controlled inputs + debounced PATCH model; only the markup primitives swap.

### Tables

Every list table moves to `@tanstack/react-table`. A generic `data-table.tsx` exposes `<DataTable columns rows ...>`:

- Column definitions own sort, filter, render.
- `SortableTable<T>` consumers translate to column defs that mostly mirror their old `Column<T>` shape.
- Filter rows above the table use shadcn `<Input>` and `<Select>`.

### Notification bell

Polling logic is preserved verbatim. Open/close state is owned by shadcn `<Popover>` (which handles click-outside). `<ScrollArea>` gives the list scroll. `<Badge variant="destructive">` renders the unread count overlay.

### Sonner usage rules

- **Use sonner for** transient feedback after a user action: form submit success/error, upload success/failure, copy-to-clipboard, save-success.
- **Do not use sonner for** persistent banners or page-level error boundaries — those keep `<Alert>`.
- The current pattern of "store error in `useState`, render `<Alert>`" stays for any banner that must remain visible until corrected (e.g. forbidden views).

## Visual Identity

Out-of-the-box shadcn with `baseColor: green` keeps the emerald accent feel without hand-rolling a custom palette. Components inherit shadcn defaults for spacing, radius, and typography, which will be visibly more consistent than the current hand-tuned utilities. The Novi logo, page titles, and copy stay.

## Risk Register

| Risk | Mitigation |
|---|---|
| Radix `<Select>` breaks Playwright `selectOption()` calls | Update e2e selectors in the same task that introduces shadcn `<Select>` (Phase 1 step 11). Add `selectShadcn(page, label, optionLabel)` helper in `tests/e2e/helpers.ts`. |
| Tailwind v4 + shadcn theme variables collide with hardcoded `slate-*`/`emerald-*` classes still in pages | Phase 4 sweep + manual smoke against all 5 seeded users. |
| Sonner double-shows next to existing inline `<Alert>` | Per-task: only convert transient `<Alert>` instances; persistent banners stay as `<Alert>`. |
| `editable-line-items.tsx` is high-risk to refactor (24k file, debounced inline edits) | Keep controlled-input + debounce verbatim. Only swap the `<input>` element for `<Input>` and the table for shadcn `<Table>`. No rhf, no behavioral change. |
| react-hook-form + zod adds form code volume | Schemas mirror existing server-side validators, kept colocated. Tests only assert on labels, headings, button names — these remain unchanged. |
| `team-active-toggle` becomes `<Switch>` and may drop a click handler in tests | Verified by grep: no e2e test interacts with that toggle. |
| Long-running migration may merge-conflict with parallel work | User chose to migrate in place on the current branch. Frequent small commits keep diffs reviewable. |

## Verification

| Layer | When |
|---|---|
| `npm run lint` | After every task |
| `npm run test:unit` | After every task |
| `npm run test:integration` | After every domain-group task in Phase 2 |
| `npm run test:e2e` | After Phase 1 Step 11 (Select), after each Phase 2 group, at every phase boundary |
| Manual smoke (`npm run dev`, all 5 seeded users) | At Phase 4 close |

## Out of Scope

- Status label remap (audit recommendation).
- AlertDialog around the existing inline "Delete this draft?" strip.
- Information-architecture changes (admin queues, dashboard restructuring).
- Dark mode rollout (theme tokens are wired; no UI to toggle).
- Native `<select>` fallback for e2e — tests are updated instead.
