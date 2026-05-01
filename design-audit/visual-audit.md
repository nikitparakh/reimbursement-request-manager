# Visual Design Audit

## Methodology

- **Browser:** Cursor `user-playwright` MCP (Chromium)
- **Base URL:** `http://localhost:3000`
- **Viewports:** Desktop 1440×900, Mobile 390×844
- **Accounts:** `user@team.org` (parent mentor), `coach@team.org` (coach), `admin@school.org` (super admin)
- **Captures:** 38 PNG screenshots, mostly `fullPage: true`. Interaction proofs are viewport crops.

## Findings (Severity)

### CRITICAL

- **Brand mismatch.** The Novi brand mark is bright **emerald green**; the application chrome is uniform **slate-on-white**. The two never reconcile — see `screenshots/auth/sign-in-desktop.png` and `screenshots/parent-mentor/dashboard-desktop.png`. Logo says "vibrant green community brand," the rest of the UI says "default shadcn template." There is **no** green accent anywhere outside `StatusBadge`, `next/image` for the logo, and the policy-accepted chip's lucide icon.
- **`/coach/inbox` is a redirect.** The route immediately bounces to `/coach/team-reimbursements` (`screenshots/coach/inbox-desktop.png`). There is no inbox UI for coaches — the navbar implies one exists. Confusing IA.
- **"Receipts & line items" empty card on every detail page.** Visible in `screenshots/admin/request-detail-desktop.png` and `screenshots/interactions/reject-no-comment.png`. The section header renders without any content — a visible empty card that looks like a styling bug. This is content the requesting user owns; it should be hidden for the admin view, or render an empty state.

### MAJOR

- **`/policy` font shift.** Body copy renders in a serif/transitional family (Charter-like) while the rest of the app is sans. Not a design choice — looks like an accidental font cascade. See `screenshots/parent-mentor/policy-desktop.png`. Combined with very low body-text contrast (muted blue-grey on white), the page is the worst-looking screen in the product.
- **`PageHeader` h1 is serif everywhere.** "Dashboard", "Profile", "Manage Teams", "Reimbursement Request Manager" all render as serif while the navbar, body copy, badges, buttons, and inputs are sans. The serif family looks like a fallback (Times-ish) — not a deliberate display face. Result: every page header reads as accidental, not editorial. (Most visible on `dashboard-desktop.png`, `profile-desktop.png`, `admin/inbox-desktop.png`.)
- **`EditableRequestHeader` has no editable affordance.** On a draft request detail (`screenshots/parent-mentor/request-draft-detail-desktop.png`), the title and description render as plain text with no border or background. A user has no visual cue that these fields are editable. The "Title" / "Description" labels above are muted but the input itself looks like static text.
- **Mobile draft detail is unusable.** `screenshots/parent-mentor/request-draft-detail-mobile.png` shows the line-items table truncating descriptions to "Alumi" / "NEO M". The Qty column is hidden, but values may still appear elsewhere. Three stacked stat cards (Requested total / Team / Created) burn vertical real estate before the user sees the editable content.
- **Admin Inbox is a wall of identical cards.** `screenshots/admin/inbox-desktop.png` shows 8 cards with the same shape, same title prefix, same buttons, same metadata layout. There is no visual chunking, no pagination affordance, no priority sort cue. It scans as repetitive form repetition rather than a triage queue.
- **Admin Inbox surfaces `Admin Approved` requests.** Seven of the eight cards show `Admin Approved` badges — they should not be in an *inbox*. Either the seed is misleading or the query filter is too permissive; either way the page does not match its label.
- **Reject button reads as muted, not destructive.** On the admin detail / inbox cards, "Reject" uses the shadcn `destructive` variant which renders as **pale pink-on-red text**, not a confident red fill (`screenshots/admin/inbox-desktop.png`, `screenshots/admin/request-detail-desktop.png`). Next to the dark navy "Approve" button it looks like the *secondary* action, even though it's the destructive one.
- **`/admin/users` row rhythm is broken.** `screenshots/admin/users-desktop.png`. Each user row's height varies wildly because the "Scoped Access" cell stacks N role chips + an Add control. Some rows are 30px, others 200px. The "None" placeholder appears 20+ times in two columns, which feels like noise.
- **Status-badge casing is inconsistent.** "Admin Approved" (Title Case) vs "COACH APPROVED" (ALL CAPS) vs "Submitted" (Title Case) all visible side-by-side in `screenshots/admin/inbox-desktop.png`. The code path is documented (`LABEL_OVERRIDES`) but the user-visible inconsistency is not.

### MINOR

- **Brand-vs-product palette divergence.** Where green *is* used (status `Admin Approved`, `Approved` team chips, the policy-accepted icon), it's a textbook Tailwind emerald — different hue from the Novi logo green. Two greens, neither matched.
- **Currency strings drift.** Tables show `$47.83`. The draft detail subtotals show `USD 145.00`. Same data type, two formats. (`screenshots/admin/inbox-desktop.png` vs `screenshots/parent-mentor/request-draft-detail-desktop.png`.)
- **Empty card on admin detail "Receipts & line items" section is visible blank space** (already noted as CRITICAL elsewhere) — included here because it manifests as a *minor* visual gap until you realize content should live there.
- **Parent-mentor dashboard has only 2 tiles in a 3-col grid at lg.** Big empty third column. (`screenshots/parent-mentor/dashboard-desktop.png`.) The grid should center 2 tiles or use `sm:grid-cols-2 lg:grid-cols-2` for parent-mentor's 2-link state.
- **`PDF` action looks like text not a button.** Top-right of detail pages — small grey "↓ PDF" with no button chrome. Easy to miss.
- **`Manage Teams` table is dominated by `--` placeholders and `0` columns.** (`screenshots/admin/teams-desktop.png`.) Coaches/Parents/Mentors/Requests columns are 0 across most rows; Short Code / GL Account are `--`. The page is technically populated but visually empty.
- **Stat tiles are flat.** Coach Team Overview's "Requests / Paid Out / Pending Review" cards (`screenshots/coach/team-overview-desktop.png`) are number + label only — no icons, no trend arrows, no contextual color. They feel like CSV cells.
- **Notification popover items have no structure or tap targets.** (`screenshots/interactions/notifications-popover.png`.) Each item is a button with title + relative time but no icon, no read/unread toggle, no "mark all read" action, no separator between days.
- **Sign-in lonely on the page.** `screenshots/auth/sign-in-desktop.png` — small card centered in vast empty space with no atmosphere (no background image, gradient, illustration, or Novi imagery beyond the logo). Reads as a stub.
- **Sales tax strikethrough is clever but feels broken.** `screenshots/parent-mentor/request-draft-detail-desktop.png` shows `USD 11.40` with a strikethrough next to "Sales Tax (not reimbursable)". The intent is clear but the strikethrough on a small numeric value reads as "this number is wrong."

### NIT

- **No microinteractions of note.** Hovers are mostly opacity changes. No tile lift, no card hover shadow, no nav indicator slide, no toast slide-and-bounce.
- **No background texture.** Every page is pure white. No grid, no noise, no gradient, no decorative imagery for empty states.
- **Avatars are absent.** User identity is shown only as raw email (`user@team.org`). An avatar with initials would humanize the navbar and tables.
- **Section dividers are thin slate borders only.** No spatial language (color band, decorative rule) marking sections.
- **The dev-tools "N" overlay button** is visible in many shots — environment artifact, not a real bug.

---

## Page-by-page notes

### `/sign-in`
![](screenshots/auth/sign-in-desktop.png)
![](screenshots/auth/sign-in-mobile.png)

Centered card with Novi logo, sans serif title that looks accidentally rendered as serif (system fallback), email/password inputs, dark navy CTA. Card sits on empty white space. Brand promise (logo) and execution (palette) don't match.

### `/sign-up`
![](screenshots/auth/sign-up-desktop.png)
![](screenshots/auth/sign-up-mobile.png)

Same card pattern as sign-in plus a policy-acceptance checkbox area in muted-bg block. Reasonable but uninspired.

### `/` (parent mentor dashboard)
![](screenshots/parent-mentor/dashboard-desktop.png)
![](screenshots/parent-mentor/dashboard-mobile.png)

Serif "Dashboard" h1 + muted welcome line + 2 link cards. 80% of viewport is empty white below. Mobile renders cleanly.

### `/profile`
![](screenshots/parent-mentor/profile-desktop.png)
![](screenshots/parent-mentor/profile-mobile.png)

Cleanest authed page in the app. Clear card → form layout, two-column on desktop, stacked on mobile. Policy-accepted chip is a nice touch. Save button is dark navy.

### `/team`
![](screenshots/parent-mentor/team-desktop.png)
![](screenshots/parent-mentor/team-mobile.png)

Functional. Uppercase tracked sub-labels (UPPERCASE for "School", "Program") feel different from other pages where headings are mixed-case.

### `/policy`
![](screenshots/parent-mentor/policy-desktop.png)

The worst-looking page. Body text appears in a serif fallback (no `font-sans`). Body copy is too pale (muted-foreground). Three cards with light borders — fine structurally, terrible typographically.

### `/user/requests`
![](screenshots/parent-mentor/user-requests-desktop.png)
![](screenshots/parent-mentor/user-requests-mobile.png)

Solid table page. Status pills in 4 colors. Filter row at top is dense. Mobile keeps the table scrollable.

### `/user/requests/new`
![](screenshots/parent-mentor/request-new-desktop.png)
![](screenshots/parent-mentor/request-new-mobile.png)

Linear form card with title/description fields. Fine, generic.

### `/user/requests/<draft>` (Robot Parts - Week 3)
![](screenshots/parent-mentor/request-draft-detail-desktop.png)
![](screenshots/parent-mentor/request-draft-detail-mobile.png)

The richest screen. Editable title/description with no border (looks like static text). Three stat cards. Receipt uploader (dashed-border zone). Line items table with delete buttons. Subtotal/sales-tax/total. "Submit to Coach" + "Delete Draft". Mobile is cramped — line items table truncates aggressively.

### `/user/requests/<submitted>` (Field Trip Supplies)
![](screenshots/parent-mentor/request-submitted-detail-desktop.png)

Read-only mode of the same page. Looks more controlled than the editable variant precisely *because* there's no editable-but-hidden affordance.

### `/coach/inbox`
![](screenshots/coach/inbox-desktop.png)
![](screenshots/coach/inbox-mobile.png)

Identical to `/coach/team-reimbursements` due to the redirect. **CRITICAL** — the navbar entry promises a different surface and there isn't one.

### `/coach/team-overview`
![](screenshots/coach/team-overview-desktop.png)

Three flat stat cards then table of requests + table of members. Functional but corporate / sterile.

### `/coach/team-reimbursements`
![](screenshots/coach/team-reimbursements-desktop.png)

Same shape as `/admin/requests` filter+table. Pending-review chip in the header.

### `/admin/inbox`
![](screenshots/admin/inbox-desktop.png)
![](screenshots/admin/inbox-mobile.png)

8 nearly identical cards stacked vertically. Each has title link, badge, metadata, comment field, action button(s). At desktop it scans as form-monotony, not a queue. The seeded data showing 7× "Admin Approved" in an inbox is the bigger issue — these shouldn't be here.

### `/admin/requests`
![](screenshots/admin/requests-desktop.png)
![](screenshots/admin/requests-mobile.png)

Heavy filter bar (Search, Status, District, Team, From, To) above a sortable table. Solid but the filter chrome is dense.

### `/admin/requests/<id>`
![](screenshots/admin/request-detail-desktop.png)

Three flat stat cards. Empty "Receipts & line items" card (CRITICAL bug). Admin actions card with Approve/Reject (Reject reads as secondary). Approval timeline.

### `/admin/teams`
![](screenshots/admin/teams-desktop.png)

Pending registrations card + 24-row teams table dominated by `--` and `0`. "Approved" status badge on every row is redundant under a section labeled "Active teams".

### `/admin/teams/<id>`
![](screenshots/admin/team-detail-desktop.png)

Team detail with deactivate switch + KPIs + tables. Consistent with team overview.

### `/admin/team-requests`
![](screenshots/admin/team-requests-desktop.png)

Card-based adjudication mirroring inbox cards. Same monotony problem when count is high.

### `/admin/users`
![](screenshots/admin/users-desktop.png)

Power surface. Variable row heights destroy rhythm. Stacked role chips with inline "Add" button create chaos.

---

## Interaction evidence

| Interaction | File |
|---|---|
| Sort active state | `screenshots/interactions/sort-active.png` |
| Notifications popover | `screenshots/interactions/notifications-popover.png` |
| Reject without comment validation | `screenshots/interactions/reject-no-comment.png` |
| Remove member dialog | `screenshots/interactions/remove-member-dialog.png` |
| Create team form validation | `screenshots/interactions/create-team-validation.png` |
| Editable header focus | `screenshots/interactions/editable-header-focus.png` |
| Mobile nav sheet | `screenshots/interactions/mobile-sheet.png` |

The `reject-no-comment` proof is solid: textarea border + label both turn red, "Rejection requires a comment." appears below. Sonner toasts work. Sheet works. AlertDialog works. **Functionally everything's correct — what's missing is character.**

---

## Cross-cutting observations

### Typography
- Body: `font-sans` (system stack, looks like Geist via cascade — but no font is loaded by `next/font`, so the user is seeing the system default).
- Headings: render in a serif fallback because `--font-heading` is set but no display font is loaded. **This is an accident, not a design.**
- `/policy` body falls into a different cascade entirely. **Bug.**
- No type scale beyond `text-xs` → `text-2xl`. No display sizes. PageHeader h1 caps at 24px on desktop.

### Color
- Slate duotone for chrome: `bg-background`, `bg-card`, `bg-muted/20`, `text-foreground`, `text-muted-foreground`, `border-border`.
- Brand green (Novi logo) is *never* used anywhere in interactive elements.
- Status palette (amber / emerald / red / blue / purple / cyan) is the only chroma in the app — and lives only in `StatusBadge`.
- `chart-*` tokens defined in CSS but unused.
- Result: **the product reads as the shadcn slate template, not the Novi brand.**

### Spacing
- `space-y-6` on every page wrapper. Predictable, safe, indistinct.
- Card padding consistent.
- No deliberate density variation — every section gets the same air.

### Motion
- Library defaults only (`animate-in`, `transition-colors`, `animate-spin`).
- One bespoke chevron rotate in `CollapsibleRequestCard`.
- No tile hover, no list item hover, no toast slide-and-bounce, no skeleton shimmer.

### Distinctiveness
- Verdict: **A clean shadcn template implementation with a green logo strapped on top.** Nothing about the visual language signals "Novi Community School District robotics reimbursements." Swap the logo for `acme-corp.png` and the screenshots could be any B2B SaaS.

---

## TL;DR

1. **The brand promise (vibrant green Novi mark) is broken everywhere else in the UI** — neutral slate template with no accent color, no warmth, no character.
2. **The `PageHeader` h1 and `/policy` body are accidentally rendering in serif** because no `next/font` is loaded — fix the font pipeline first.
3. **`/coach/inbox` is a fake page** (redirects to reimbursements) and **the empty "Receipts & line items" card on admin detail is a visible bug**.
4. **Editable affordances are invisible** on the draft detail title/description (looks like static text).
5. **Mobile draft detail truncates line items** to 5 characters; the table needs to collapse to a card list on small screens.
