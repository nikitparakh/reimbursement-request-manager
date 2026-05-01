# Cross-Component Consistency Audit

## Inconsistencies found

### MAJOR (clear drift)

- **Error / access surfaces split into two tiers.** `src/app/error.tsx`, `not-found.tsx`, and `unauthorized.tsx` share the same centered Card with a `size-12` circle icon, `CardTitle text-xl`, and primary CTA. But `src/app/global-error.tsx` is unstyled HTML (`<h1>`, bare `<p>`, single `Button`) and `src/app/forbidden.tsx` is plain `<div>` + `<h1>` with no Card. Large structural gap for failure states.

- **Empty states are not unified.** Most list pages use `EmptyState`. Filtered table empties and the notification list use ad-hoc muted text instead:
  - `team-reimbursements-table.tsx` and `admin-reimbursements-table.tsx` ("No requests match your filters.")
  - `data-table.tsx` default ("No results.")
  - `notification-bell.tsx` ("No notifications yet" in a `<p>`)
  Different typography, padding, and bordered-dashed card vs plain centered text.

- **Currency formatting drift.** Tables use `${amount.toFixed(2)}`. Elsewhere `formatCurrency`/`formatMoney` prepend currency code (`USD 12.34` style) in `editable-line-items.tsx` and `extraction-review.tsx`. Line 596 of `editable-line-items.tsx` uses `${grandTotal.toFixed(2)}` with `$` prefix only on the grand total. Same product, multiple money presentations.

- **Date / time format drift.** Request list/detail uses `toLocaleDateString()` (locale-default, varies per user). `status-timeline.tsx` uses `toLocaleString()`. Three independent relative-time helpers exist (`line-item-comments.tsx` `timeAgo`, `notification-bell.tsx` `formatTime`, `extraction-review.tsx` helpers). Visible inconsistency between "5/1/2026" / "5m ago" / full datetime strings across the same product.

### MINOR (small inconsistencies)

- **PageHeader nesting mismatch.** `(auth)/sign-in/page.tsx` and sign-up nest `PageHeader` inside a bordered `CardHeader` with wrapper hacks (`[&_[data-slot=card-header]]:...`), while app routes use `PageHeader` flush in `space-y-6` layout. Same component, different chrome.

- **Section heading scale is heterogeneous.** Same role of "h2/h3 inside a page" gets different sizes:
  - `coach/team-reimbursements/page.tsx`: `<h2 className="text-sm font-semibold">`
  - `coach/team-overview/page.tsx`: `text-xl` for `h2`, `text-sm` for `h3`
  - `team/page.tsx`: `text-lg` for team name `h2`, **uppercase** `h3` labels
  - `admin/teams/page.tsx`: `CardTitle text-base`
  - `admin/team-requests/page.tsx`: `<h3 className="text-base">`

- **Form gap drift.** Most forms use `space-y-4`; `profile-form.tsx` uses `space-y-6`.

- **Loading / submit copy drift.** `request-form.tsx` swaps button label inline (`"Creating..."`) instead of using the shared `Button` `loading` prop. Submit copy varies: "Save profile", "Create Draft", "Try again", "Sign in", onboarding variants — partly domain-appropriate but no consistent shape.

- **Dialog title tone drift.** Mix of questions with `?` ("Delete this receipt?", "Delete this draft?") and statements ("Remove member", "Remove scoped access", "Create team"). Punctuation and tone are uneven.

- **Popover styling drift.** Notification popover: `PopoverContent p-0` with internal header strip and fixed `ScrollArea` height. Comment popover: `className="w-80 gap-3"` with default padding. Different density and header pattern.

- **Card-like blocks bypass the Card primitive.** `profile-form.tsx` and `sign-up-form.tsx` use `rounded-md border ... bg-muted/50` on `FormItem` for callouts — visually similar to `Card` but a different primitive.

### NIT (subjective)

- **Loading skeleton density varies.** All `loading.tsx` use `PageSkeleton` but with different `cardCount` / `lines`.

- **Icon size drift.** `size-6` on error/not-found/unauthorized hero icons; `receipt-uploader.tsx` uses `size-8` for upload affordance. Inline icons mostly `size-4`/`size-5`. Loader2 sizes vary (`size-3`, `size-3.5`, `size-4`, `size-5`) by context.

- **StatusBadge as general chip.** `PageHeader` badges pass free-form strings like `${pendingCount} pending review` and `${teams.length} teams`. They render in the same `Badge` shell as workflow statuses — works, but mixes count chips with enum statuses visually.

---

## Per-pattern analysis

### PageHeader

- **Using:** all real-content `(app)` and `(auth)` pages.
- **Not using (UI-less):** `coach/inbox/page.tsx`, `admin-sign-up/page.tsx` (both redirect stubs).
- **Issues:** Nested in auth `CardHeader` vs flush in app layout. No raw `<h1>` in `(app)` routes; only `forbidden.tsx` and `global-error.tsx` use plain `<h1>`.

### EmptyState

- **Using:** `user/requests`, `admin/requests`, `admin/inbox`, `admin/teams`, `admin/teams/[teamId]`, `admin/team-requests`, `coach/team-overview`, `coach/team-reimbursements`, `team`.
- **Not using:** Filtered-empty rows in reimbursement tables, generic `data-table` empty row, `notification-bell` empty list.

### Cards

- **Composition:** Most pages use full shadcn `Card` family. `page-header.tsx` uses transparent borderless `Card` `size="sm"` for spacing tokens (intentional).
- **Padding:** Base `card.tsx` uses `px-4` and `py-4`; many call sites add `pt-0`, `py-4`, `space-y-*` on `CardContent`. `empty-state.tsx` uses `py-10`. `collapsible-request-card.tsx` uses `p-6 pt-0` on expanded content (heavier than default).
- **Ad-hoc card-like blocks:** `profile-form.tsx`, `sign-up-form.tsx` use `rounded-md border ... bg-muted/50` for callouts.

### Button hierarchy

- **Primary CTAs:** Frequently on `PageHeader` `action`. Logged-out home centers a primary/secondary pair. Not all pages have a header action.
- **Variants:** `default` for primary, `outline`/`ghost` for secondary, `destructive` for delete — generally sensible. `error.tsx` primary is `Try again` default + `Go home` outline; `not-found.tsx` single `Go home` default.

### Badges

- **Components:** Domain status uses `StatusBadge` wrapping `Badge`. Unread count uses raw `Badge` in `notification-bell.tsx`. Comment count uses a custom `<span>` pill, not `Badge`.
- **Casing:** `LABEL_OVERRIDES` forces ALL CAPS for some role strings; `formatLabel` snake-case→Title Case for the rest. So "COACH APPROVED" vs "Draft" is by design (overrides for legacy display, others normalized). Documented in code (`status-badge.tsx:158-166`).
- **Team active state:** `APPROVED` / `REJECTED` shows as "Approved" / "Rejected" — different vocabulary from reimbursement "ADMIN_APPROVED".

### Form structure

- **Gap:** `space-y-4` common; `profile-form.tsx` `space-y-6`.
- **Submit:** `loading={...}` on `Button` vs manual label change in `request-form.tsx`.
- **Width:** Auth `w-full` submit; profile default width (left-aligned).

### Table sort headers

- **Shared:** `SortableColumnHeader` used in all 7 tables. Good consistency.

### Loading skeletons

- **All:** `PageSkeleton` from `card-skeleton`. Consistent component, varying props.

### Error / unauthorized / not-found

- **Shared core:** Three pages use the same max-width `Card` + icon + `CardTitle` + `CardFooter` pattern.
- **CTA copy drift:** "Go home" vs "Try again" + "Go home" vs dynamic `actionLabel` ("Back to dashboard" / "Sign in") in `unauthorized.tsx`.
- **Outliers:** `global-error.tsx` and `forbidden.tsx` (no shared chrome).

### Date / number formatting

- **Dates:** `toLocaleDateString()` widespread; timeline `toLocaleString()`; relative time duplicated 3 places.
- **Money:** `$` + `toFixed(2)` in tables vs `currency + value` strings vs mixed grand total.

### Icon sizing

- **Inline / UI:** Mostly `size-4`/`size-5`. Hero/error icons `size-6`; upload empty state `size-8`. No strict scale doc.

### Link styling

- **Nav / menus:** `NavigationMenuLink` + `navigationMenuTriggerStyle()`.
- **Content:** Sign-in footer link uses `Button variant="link"`. Some `Link + text-primary underline` behavior. Dashboard tiles wrap entire card as a link (no inline text-link styling).

### Notification bell vs other popovers

- **Two usages:** Notification popover (end-aligned, `p-0`, scroll area) vs comment popover (start-aligned, form, `w-80 gap-3`). Intentionally different but could share width/spacing tokens.

### Dialog / AlertDialog titles

- **Mix of questions and statements** (see `receipt-uploader.tsx`, `request-actions.tsx`, `remove-member-button.tsx`, `user-scope-manager.tsx`, `create-team-form.tsx`).

### Section header patterns

- **h2/h3 sizes/weights:** Heterogeneous. `team/page.tsx` uses uppercase tracking section labels unlike other pages.

---

## TL;DR

1. **Unify failure / access UI**: bring `global-error.tsx` and `forbidden.tsx` up to the same `Card` + icon + CTA pattern as `error.tsx` / `not-found.tsx` / `unauthorized.tsx` (and align CTA labels to one vocabulary).

2. **Unify empty / filtered-empty states**: extend `EmptyState` for table-filter and notification cases, or standardize copy + `text-muted-foreground` + padding so empty tables and popovers feel like the same family.

3. **Centralize formatting**: one small module for locale date, relative time, and currency so amounts and dates read consistently everywhere.
