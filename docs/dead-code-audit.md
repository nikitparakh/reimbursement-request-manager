# Dead / Stale Code Audit

_Generated: 2026-05-31 · Repo: `reimbursement-request-manager`_

This audit catalogs verified dead, stale, and orphaned code. Every "safe to delete"
item below was confirmed with adversarial ripgrep checks (no importers, no dynamic/string
refs, no barrel re-exports, not a framework-convention entrypoint). Items needing human
judgment and verified false-positives are listed separately for transparency.

---

## 1. Executive Summary

The codebase is in good shape. Almost all findings trace to two completed migrations —
the **shadcn UI rewrite** (2026-04-30) and the **Vercel → Cloudflare migration**
(2026-05-31) — which left behind orphaned primitives, dead deploy config, and stale
storage fallbacks. There are no dangerous findings: nothing safe-to-delete is reachable
at runtime.

| Category | Safe to delete | Needs decision | Notes |
|---|---:|---:|---|
| Unused component/UI files | 5 | — | shadcn rewrite leftovers |
| Unused exports (functions) | 4 | — | 1 full delete, 3 de-export only |
| Unused exports (types) | 7 | — | 1 full delete, 6 de-export only |
| Unused assets | 1 | — | `frogforce-shield.jpg` |
| Stale leftovers | 5 | 2 | scripts, fixtures, env file |
| Dead deploy/lint/ignore config | 4 | — | Vercel + Prisma + ESLint legacy |
| Debug logging | 4 | — | `[parse]` / `[autofill]` logs |
| Dead branches | 2 | — | http(s) storage scheme |
| Stale doc references | 1 | — | README live-demo link |
| Unused dep | — | 1 | `shadcn` CLI (pinned) |
| Borderline re-export surface | — | 1 | ~30 shadcn sub-exports |

**Overall risk: LOW.** All confirmed-dead items are unreachable or no-op. The largest
single win by weight is the `design-audit/` artifact directory (6.8 MB, 69 tracked
files), which is generated review output, not source.

---

## 2. Safe to Delete Now

High-confidence `confirmed-dead`. Ordered so you can action top-down. Note: items marked
**de-export only** keep the symbol but drop the `export` keyword — the type/function is
still used inside its own file.

### 2a. Unused files — delete whole file

| Path | What it is | Why dead |
|---|---|---|
| `src/components/reimbursements/collapsible-request-card.tsx` | React component `CollapsibleRequestCard` | Zero importers; only self-refs + non-code docs. Superseded by `request-progress` / `editable-request-header` during the shadcn rebuild. |
| `src/components/ui/checkbox.tsx` | shadcn `Checkbox` primitive | No importers; the custom policy-acceptance checkbox it was generated for was eliminated by the Clerk migration (`<SignUp>` provides its own). |
| `src/components/ui/dropdown-menu.tsx` | shadcn `DropdownMenu` (+15 re-exports) | Zero importers across all code. App uses navigation-menu / mobile-nav-menu / popover instead. (`@radix-ui/react-dropdown-menu` becomes prunable too.) |
| `src/components/ui/field-group.tsx` | shadcn `FieldGroup` | Orphaned 1:1 migration shim; consumers moved to `form.tsx`'s `FormField` (rhf). |
| `src/components/ui/tooltip.tsx` | shadcn `Tooltip` (+ Content/Provider/Trigger) | Generated but never consumed; no `TooltipProvider` mounted anywhere. (Note: imports the unified `radix-ui` package — verify before pruning the dep.) |

**Action:** delete these five files. They carry no runtime references.

### 2b. Unused exports — full function delete

| Path / symbol | Why dead | Action |
|---|---|---|
| `src/lib/access.ts#canReviewReimbursements` (fn, ~L209–217) | Standalone function has zero call sites. The `AccessContext.canReviewReimbursements` **boolean field** (L51/L160 + tests) is independent and assigned directly from `isAdmin \|\| isCoach` — **keep the field**. | Delete only the function. |
| `src/lib/access.ts#requireAccessContext` (fn, ~L293) | Two repo-wide hits: the def + a stale comment in `src/proxy.ts:15`. No callers. Enforcement is done by `requireUser()`/`requireRole()` (`src/lib/rbac.ts`) + direct `getAccessContext()`/`getCachedAccessContext()`. **Not** a dropped-enforcement regression. | Delete the function; also update the `proxy.ts:15` comment to drop the `requireAccessContext` mention (see §3). |

### 2c. Unused exports — de-export only (keep symbol)

Each is referenced **only inside its own file**; the `export` keyword is dead but the
symbol is load-bearing internally. Change `export type X`/`export function X` →
`type X`/`function X`. Zero runtime impact, low cleanup value.

| Path / symbol | Internal use that must stay |
|---|---|
| `src/lib/reimbursements/request-access.ts#RequestAccess` (type, L6) | `satisfies RequestAccess` at L122 |
| `src/lib/reimbursements/serialize-receipts.ts#SerializedExtraction` (type, L21) | referenced by `SerializedReceipt` (L35) |
| `src/lib/storage.ts#StoredObject` (type, L4) | return type of `uploadReceiptFile` (L60) |
| `src/lib/navigation.ts#NavLink` (type, L7) | used at L38 (`Map<string, NavLink>`) and L43 (`Pick<NavLink,...>`) |
| `src/lib/admin-users-ui.ts#RoleFilterOption` (type, L1) | return annotation of `getRoleFilterOptions` (L6) |
| `src/lib/parsing/provider.ts#ParseProviderInput` (type, L5) | param type of `parseReceiptWithProvider` (L85) |
| `src/lib/user-scope-role.ts#UserScopeBoundaryInput` (type) | param type of 3 in-file functions |
| `src/lib/user-scope-role.ts#hasUserScopeBoundary` (fn, L8) | called by `assertUserScopeBoundary` (L15) |
| `src/lib/access.ts#TeamMembershipAssignment` (type, L28) | used in 4 places inside `access.ts` |
| `src/lib/access.ts#hasScopedRole` (fn, L164) | called by `canManageUsers` (L187), `canManageTeams` (L195) |
| `src/lib/notifications/admin-review-recipients.ts#buildAdminReviewRecipientWhere` (fn, L11) | called by `getAdminReviewRecipientEmails` (L55) |

### 2d. Unused exports — full type delete

| Path / symbol | Why dead | Action |
|---|---|---|
| `src/lib/reimbursements/pending.ts#PendingReviewFilter` (type, L6) | Pure type alias, never used as annotation anywhere. Sibling exports `PENDING_REVIEW_FILTER` and `getPendingReviewStatuses` are live and must stay. | Delete the type alias line. |

### 2e. Stale leftovers (scripts, fixtures, scratch docs)

| Path | What it is | Action |
|---|---|---|
| `setup.sh` | Bootstrap script for the **old** stack. Runs `npx prisma generate`/`migrate dev`/`prisma:seed` (none exist) and injects a NextAuth `AUTH_SECRET` (dead under Clerk). Never invoked by CI or README. | Delete (or rewrite for the Cloudflare stack: `npm install` + `db:migrate:local` + `db:seed` + `.dev.vars`). |
| `tests/fixtures/receipts/` (`sample-invoice.txt`, `sample-w9.txt`) | Zero code references. The e2e suite generates its own `test-receipt.pdf` under `tests/e2e/fixtures` at runtime. | Delete the dir; update README test-tree (L215). |
| `design-audit/` (69 files, 6.8 MB) | One-off generated design-review artifact (REPORT.md + screenshots). Nothing imports/links/builds from it. | Remove from repo or archive externally. No code risk. |
| `new-plan.md` (repo root) | Free-form multi-tenancy brainstorm scratch note. Zero references. | Move to `docs/plans/2026-05-31-multi-tenancy-brainstorm.md` or remove. |
| `tests/unit/storage.test.ts:11` (`delete process.env.BLOB_READ_WRITE_TOKEN`) | No-op holdover from Vercel Blob storage. Storage now selects R2 vs `file://` via the `RECEIPTS_BUCKET` binding. **Only this one line is dead** — the test file is live. | Delete the single line. |

### 2f. Dead deploy / lint / ignore config

| Path | What it is | Action |
|---|---|---|
| `vercel.json` | Vercel platform config. App fully migrated to Cloudflare (`opennextjs-cloudflare` + `wrangler`). Migration doc explicitly mandates its deletion. | Delete. |
| `.vercel/` | Local-only Vercel link dir (gitignored, untracked). Never read by the Cloudflare pipeline. | Remove locally (cannot affect git/CI). |
| `.eslintrc.json` | Legacy pre-flat-config. ESLint 9 reads the active `eslint.config.mjs` and ignores this file. | Delete. |
| `.gitignore` line `/generated/prisma` | Ignores the Prisma codegen dir. Prisma fully removed (Drizzle now; outputs to `./drizzle`). Matches nothing. | Remove the line. |

### 2g. Debug logging

All execute on the happy path, contribute no value, and (in two cases) leak receipt
contents into Worker logs. None asserted by any test.

| Path | Log |
|---|---|
| `src/lib/jobs/process-receipt.ts:80` | `[parse][persist] Preparing extraction write` — dumps full `extractionData` incl. `rawJson` on **every** parse. **Highest priority** (leaks receipt contents). |
| `src/lib/jobs/process-receipt.ts:131` | `[parse][persist] Extraction write complete` |
| `src/lib/jobs/process-receipt.ts:178` | `[parse][total] Request total recomputed` |
| `src/app/api/requests/[requestId]/autofill/route.ts:51` | `[autofill] Aggregated request total...` — runs a map+reduce over line items purely to build the log payload. |

**Action:** remove these, or gate behind a debug flag. Strip the full-payload dump at
minimum.

### 2h. Dead branches

| Path | What it is | Action |
|---|---|---|
| `src/lib/storage.ts:103–110` | `http(s)` scheme branch in `readStoredObject`. The only `storageUrl` producer (`uploadReceiptFile`) emits only `r2://` or `file://`; the http(s) producer was Vercel Blob (removed). Unreachable; pre-launch so no legacy rows. | Remove; non-r2/non-file then correctly hits the "Unsupported storage URL scheme" throw. |
| `src/lib/storage.ts:144–147` | Symmetric `http(s)` branch in `deleteStoredObject` (a no-op `return;`). | Remove. Keep `r2://` and `file://`. |

### 2i. Unused assets & stale doc links

| Path | What it is | Action |
|---|---|---|
| `public/frogforce-shield.jpg` (73 KB) | Orphaned static image. Zero references (the live logo is `public/novi-logo.png`; the "shield" code hits are lucide icons). | Delete. |
| `README.md:5` (`Live demo: ...vercel.app`) | Stale Vercel deployment pointer; the rest of the README documents the Cloudflare stack. | Update to the Workers URL or remove. |

---

## 3. Needs a Decision

| Item | Trade-off | Recommendation |
|---|---|---|
| `package.json` devDep **`shadcn`** | Genuinely absent from every automated workflow, but `components.json` is configured for ongoing `npx shadcn add <component>`. Pinned in devDeps so `npx shadcn` resolves the local v4.6.0 for reproducible scaffolding. | Keep pinned if component generation is ongoing; otherwise drop and use `npx shadcn@latest` on demand. Confirm contributor workflow first. |
| `src/components/ui/*` — **~30 shadcn sub-exports** (`AlertDialogPortal`, `DialogClose`, `SelectGroup`, `buttonVariants`, `useFormField`, `CollapsibleTrigger`, etc.) | All parent files are used; these specific members are unreferenced. But `components.json` is present (active regenerate-from-shadcn workflow). Removing piecemeal diverges from upstream and breaks `shadcn add`/regenerate for near-zero LOC win. | **Leave as-is.** Intentional library-completeness surface. |
| `src/proxy.ts:15` — comment referencing `requireRole` / `requireAccessContext` | `proxy.ts` is the live App Router middleware entrypoint (keep). The comment overstates: `requireAccessContext` is not an active enforcement path (nothing calls it). Resolving = either re-wire it or correct the comment. | Reconcile the comment when you delete `requireAccessContext` (§2b). Human migration-verification call. |
| `.env` (`AUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL=file:./dev.db`) | The **file is live** (loaded by seed/tests; holds a real `GOOGLE_AI_API_KEY`). Only the three vars are stale: `AUTH_SECRET`/`NEXTAUTH_URL` have zero references (Clerk replaced NextAuth); `DATABASE_URL` value should be `file:./local.db` per `.env.example`; Clerk vars are missing. Gitignored/local-only. | **Do NOT delete the file.** Clean in place: drop the two dead vars, fix `DATABASE_URL`, add Clerk vars. |

---

## 4. Checked but Keep (verified false positives)

These were flagged by tooling but confirmed actually-used — listed so the audit is transparent.

- **`tests/e2e/full-lifecycle.spec.ts:1` `dotenv`** — live `import "dotenv/config"`; resolves transitively via `@opennextjs/cloudflare`. (Missing-declaration gap, not dead.)
- **`open-next.config.ts` default export** — CLI-by-name build config loaded by `opennextjs-cloudflare`.
- **`workers/receipt-consumer/index.ts` default export** — the wrangler `main` queue-consumer entrypoint (`wrangler.consumer.jsonc`).
- **`tailwindcss` / `@tailwindcss/postcss` / `postcss` / `tw-animate-css`** — referenced via `postcss.config.mjs` and CSS `@import` in `globals.css` (invisible to JS-based depcheck).
- **`shadcn` (as code generator)** — build-time CLI; `components.json` + populated `src/components/ui/` prove it's the active maintenance tooling. (See §3 for the dep-pinning decision.)
- **`src/db/schema.ts` `PROGRAM_CODES.LEGACY`** — live enum member (column constraint, `ProgramCode` type, factory switch, README migration target).
- **`src/lib/storage.ts` `file://` branches + error logging** — reachable dev/test fallbacks; legitimate error throws and observability logs.
- **`.gitignore` `data/`** — still live: `uploadReceiptFile` writes to `LOCAL_STORAGE_DIR` (default `data/uploads`) when no R2 binding is present (`next dev`, all unit tests).

---

## 5. Suggested Cleanup Batches

Grouped into logical commits. Re-run the noted test suites after each.

**Batch 1 — Remove dead Vercel/Prisma/ESLint migration cruft** _(no tests needed; config + untracked)_
- Delete `vercel.json`, `.vercel/`, `.eslintrc.json`
- Remove `/generated/prisma` from `.gitignore`
- Update `README.md:5` live-demo link
- Delete `setup.sh` (or rewrite for Cloudflare)

**Batch 2 — Drop unused shadcn UI primitives** _(run `npm run lint`, `next build`)_
- Delete `checkbox.tsx`, `dropdown-menu.tsx`, `field-group.tsx`, `tooltip.tsx`, `collapsible-request-card.tsx`
- Optionally prune `@radix-ui/react-dropdown-menu` from `package.json` (verify `tooltip`'s `radix-ui` dep first)

**Batch 3 — Remove leftover debug logging** _(run unit tests for `process-receipt` + autofill route)_
- Strip the three `[parse]` logs (`process-receipt.ts:80,131,178`) and the `[autofill]` log (`autofill/route.ts:51`)

**Batch 4 — Remove dead storage fallback branches** _(run `tests/unit/storage.test.ts`, `tests/integration/receipts.test.ts`)_
- Delete the `http(s)` branches in `readStoredObject` (L103–110) and `deleteStoredObject` (L144–147)
- Delete the no-op `delete process.env.BLOB_READ_WRITE_TOKEN` line in `storage.test.ts:11`

**Batch 5 — Remove dead access/lib exports** _(run `tests/unit/access.test.ts`, `tsc --noEmit`)_
- Delete `canReviewReimbursements()` and `requireAccessContext()` from `access.ts` (keep the `canReviewReimbursements` boolean field)
- Update the `src/proxy.ts:15` comment
- Delete the `PendingReviewFilter` type alias
- De-export the 11 internal-only symbols in §2c (mechanical `export` removals)

**Batch 6 — Remove stale assets & scratch docs** _(no tests needed)_
- Delete `public/frogforce-shield.jpg`, `tests/fixtures/receipts/` (update README:215)
- Remove/archive `design-audit/`; relocate `new-plan.md` to `docs/plans/`

**Out of batches (manual decisions):** clean `.env` vars in place; decide on the `shadcn` devDep; leave the ~30 shadcn sub-exports untouched.
