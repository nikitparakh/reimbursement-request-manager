# Cloudflare Migration Plan — Vercel + Turso + Vercel Blob + NextAuth → Cloudflare Workers + D1 + R2 + Clerk

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan phase-by-phase. Each phase ends in a shippable state — do not skip the `opennextjs-cloudflare preview` (workerd) verification gates.

**Goal:** Move the entire reimbursement app onto a fully Cloudflare-native, **Free-plan** stack: **Cloudflare Workers** (via `@opennextjs/cloudflare`) for hosting, **Cloudflare D1** for the database (via **Drizzle ORM**), **Cloudflare R2** for receipt storage, **Cloudflare Queues** for background receipt parsing, and **Clerk** (free tier) for authentication.

**The app is pre-launch.** There is **no production data and no real users to migrate** — Turso, Vercel Blob, and the existing NextAuth user table can be stood up fresh on Cloudflare and re-seeded. This removes the entire data-migration and user-import problem and most rollback risk.

**Locked decisions (from the user):**
1. **Auth → Clerk** (free tier, 50,000 MAU/app). Replaces NextAuth v4, bcryptjs, `@auth/prisma-adapter`.
2. **ORM → Drizzle** (replaces Prisma). Drizzle is tiny, has first-class D1 support, and removes the Prisma query-engine bundle entirely.
3. **DB → Cloudflare D1**, **Storage → R2**, **Background parsing → Cloudflare Queues** (now free as of Feb 2026).
4. **Workers Free plan.** Verified feasible against current limits (§3).
5. **proxy.ts:** delete the NextAuth proxy; Clerk's `clerkMiddleware()` runs in a minimal **Edge** `proxy.ts` (OpenNext-compatible) + real enforcement in route/layout guards.
6. **D1 transactions:** the 4 transaction sites convert to Drizzle `db.batch()` / compensating logic (§6).
7. **Deploy → GitHub Actions** (`opennextjs-cloudflare build` + `wrangler deploy`).

**Effort:** Large. The two biggest tasks are the **Prisma→Drizzle query rewrite** (every query across ~52 files) and the **NextAuth→Clerk** swap. Everything else is configuration. No data migration.

---

## 1. Why this is comfortably a Free-plan app

Current (2026) Cloudflare/Clerk free limits, and how this app fits:

| Limit (Free) | Value | This app |
|---|---|---|
| Workers requests | 100k/day | Fine pre-launch / early |
| Workers **CPU per request** | **10 ms** (compute only; awaiting I/O is unlimited wall-clock) | Gemini `fetch` awaits don't count; only base64 + PDF gen consume CPU (§5.5) |
| Worker bundle size | moving to **64 MiB uncompressed**, all plans ([workers-sdk#14001](https://github.com/cloudflare/workers-sdk/pull/14001)) | Drizzle + pd-lib + Clerk + Next: no longer a concern |
| Subrequests / outbound conns | 50/request, 6 simultaneous | Bound Gemini fan-out ≤6 |
| D1 storage / per-DB | 5 GB total / 500 MB per DB, 10 DBs | One small relational DB |
| D1 rows read / written | 5M / 100k per day | Comfortable |
| D1 queries per invocation | **50** (Free) | Watch N+1 hot paths (§5.2) |
| Queues | **free** — 10k ops/day, 24 h retention ([changelog](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)) | Receipt parse fan-out |
| R2 | 10 GB storage, generous monthly ops, **zero egress** | Receipts |
| Clerk MAU | **50,000/app**, custom domain, 3 seats | Plenty; caveat: fixed 7-day session lifetime on Free |

**Hard Free constraints to design around:** the **10 ms CPU/request** cap (compute, not I/O), **50 subrequests/request**, **50 D1 queries/invocation**, **100 D1 bound-params/query**, and Clerk's **fixed 7-day session**. None are blockers for this workload.

Reference stack proving the combination: [lilpacy/cloudflare-next-boilerplate](https://github.com/lilpacy/cloudflare-next-boilerplate) (Next + D1 + R2 + Clerk + OpenNext, Drizzle).

---

## 2. Architectural Changes (read this first)

### 2.1 Prisma → Drizzle (largest task)
Every Prisma call (`db.user.findUnique`, `.create`, `.update`, `$transaction`, `include`, `Prisma.Decimal`, …) across the ~52 `import { db }` consumers becomes Drizzle syntax. Plan:
- **Schema:** translate `prisma/schema.prisma` into a Drizzle TS schema (`src/db/schema.ts`) using `sqliteTable`. Map types deliberately:
  - Prisma **enums** → `text('col', { enum: [...] })`.
  - Prisma **`Decimal`** money (`requestedTotal`, line-item amounts) → **integer cents** (recommended) or text-backed decimal. SQLite/Drizzle has no Decimal; pick one representation and update all arithmetic/formatting (`src/lib/format.ts`, parsing aggregates). **This is the one schema change that ripples into business logic.**
  - Prisma **`Json`** → `text('col', { mode: 'json' })`.
  - Prisma **`DateTime`** → `integer('col', { mode: 'timestamp' })`.
- **Relations:** define Drizzle `relations()` so existing `include`-style reads become `db.query.x.findMany({ with: { … } })`.
- **Client:** `src/lib/db.ts` becomes a per-request factory (see §2.2).
- **Migrations:** `drizzle-kit generate` emits SQL into `drizzle/`; apply through `wrangler d1 migrations apply` (single source of truth = D1's `d1_migrations`). Use `drizzle-kit push` for fast local iteration only.

### 2.2 Global singleton → per-request binding
`src/lib/db.ts` currently caches a process-wide client on `globalThis`. On Workers, `env.DB` only exists inside a request:
```ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDb(env: { DB: D1Database }) {
  return drizzle(env.DB, { schema });
}
export function getDbFromContext() {
  return getDb(getCloudflareContext().env);
}
```
Every consumer switches to a request-scoped `const db = getDbFromContext()`. CI grep fails on any top-level `import { db }`. The same pattern applies to `src/lib/storage.ts` (`getCloudflareContext().env.RECEIPTS_BUCKET` per request, not a module-load token).

### 2.3 NextAuth + bcryptjs → Clerk
Remove NextAuth v4, `bcryptjs`, `@auth/prisma-adapter`, `src/auth.ts`, `src/lib/auth-cookies.ts`, `api/auth/register`, and the custom sign-in/up forms. Clerk owns identity, hashing (off-Worker), sessions, and sign-in/up UI. Free-plan CPU is no longer a concern (no bcrypt on the Worker; Clerk verifies sessions networklessly via `CLERK_JWT_KEY`).

### 2.4 Identity ↔ app-data bridge
RBAC stays in the app DB (`User.role`/`GlobalRole`, `UserScopeRole`, `TeamMembership`). Add `clerkUserId` (unique) to the `User` table as the join key. Provision the app `User` row by **lazy upsert** on first authenticated request (keyed by `clerkUserId`), and rewire `src/lib/rbac.ts` / `src/lib/access.ts` and every old `session.user` reader to: `const { userId } = await auth()` → look up app `User`. (Webhook provisioning is an option but lazy upsert needs no public endpoint.)

### 2.5 proxy.ts: Node middleware → Clerk Edge middleware
OpenNext rejects Next 16 **Node** middleware (the NextAuth proxy). Clerk's `clerkMiddleware()` runs on the **Edge** runtime and is confirmed working under `@opennextjs/cloudflare` 1.19 + Next 16. So: delete the NextAuth `proxy.ts`; add a minimal Edge `proxy.ts` exporting `clerkMiddleware()` + `config.matcher`; do the real gating in route/layout guards via `auth()`. **Do not** enable Clerk `frontendApiProxy` with a relative URL — it causes a silent SSR 500 on workerd ([clerk/javascript#8304](https://github.com/clerk/javascript/issues/8304)).

### 2.6 OpenNext build replaces the Vercel build
`opennextjs-cloudflare build` wraps `next build` into `.open-next/worker.js` on workerd. **`next dev` runs on Node and won't catch workerd-only failures** — every gate runs `opennextjs-cloudflare preview`.

---

## 3. Prerequisites

1. **Cloudflare Free account.** No Paid plan needed. (Escape hatch if a CPU-heavy PDF ever exceeds 10 ms: the $5 Standard plan raises CPU to 30 s — not expected to be needed.)
2. **Clerk app (free):** capture `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and the **PEM public key** → `CLERK_JWT_KEY`.
3. **Tooling:** `npm i @clerk/nextjs drizzle-orm`; `npm i -D @opennextjs/cloudflare wrangler drizzle-kit`. Remove `prisma`, `@prisma/client`, `@prisma/adapter-libsql`, `next-auth`, `@auth/prisma-adapter`, `bcryptjs`, `@vercel/blob`.
4. `npx wrangler login`.
5. `npx wrangler d1 create reimbursement-manager` → record `database_id`.
6. `npx wrangler r2 bucket create receipts` (private — no public access).
7. `npx wrangler queues create receipt-parse`.
8. Production domain in Cloudflare; lower DNS TTL before cutover.
9. GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

---

## 4. Phased Migration Plan

Sequenced so the app stays shippable. Each phase has a workerd gate. **No data migration in any phase** — D1/R2 start empty and get seeded.

### Phase 0 — OpenNext scaffolding + Clerk auth swap
- **Create** `/wrangler.jsonc`: `main`, `name: "reimbursement-request-manager"`, `compatibility_date`, `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`, `assets` binding.
- **Create** `/open-next.config.ts`; **modify** `/next.config.ts` (add `initOpenNextCloudflareForDev()`, drop pdfkit from `serverExternalPackages` if removed in Phase 3).
- **Modify** `/package.json` (preview/deploy/cf-typegen scripts; dep changes), `/.gitignore` (`.open-next/`, `.dev.vars`); **create** `/.dev.vars` (Clerk dev keys).
- **Adopt Clerk:** `<ClerkProvider>` in `/src/app/layout.tsx`; delete NextAuth `proxy.ts` → Edge `clerkMiddleware()` proxy; replace `(auth)/sign-in` + `sign-up` with Clerk components; **delete** `/src/components/auth/*`, `/src/app/api/auth/register/route.ts`, `/src/auth.ts`, `/src/lib/auth-cookies.ts`; remove `next-auth`/`@auth/prisma-adapter`/`bcryptjs`.
- **Identity bridge:** add `clerkUserId` to the (still-Prisma, for now) schema; add `getCurrentAppUser()`; rewire `rbac.ts`/`access.ts`; grep + convert every `getServerSession`/`session.user`.

**Gate:** `npm run preview` serves on workerd; Clerk sign-in/up works; a protected route resolves the app `User` and enforces role — still against existing Turso/Blob.

### Phase 1 — Prisma → Drizzle on D1
- **Create** `/src/db/schema.ts` + `/drizzle.config.ts`; translate the schema (§2.1), deciding the money representation.
- **Modify** `/wrangler.jsonc`: `[[d1_databases]]` binding `DB` (+ `preview_database_id`).
- **Rewrite** `/src/lib/db.ts` to the Drizzle per-request factory.
- **Rewrite all queries** in the ~52 consumers from Prisma → Drizzle. Largest task; do it file-by-file behind the CI grep.
- **Migrations:** `drizzle-kit generate` → `wrangler d1 migrations apply --local` / `--remote`.
- **Port the seed** `/prisma/seed.ts` → Drizzle inserts; **chunk bulk inserts** to ≤ floor(100/columns) rows (D1 100-param cap). Seed users get `clerkUserId`s from Clerk dev/test users.
- **Convert the 4 transaction sites** to `db.batch()` (§6).
- **Delete** `prisma/`, `/scripts/turso-*`, Prisma deps.

**Gate:** `wrangler dev` (Miniflare local D1) passes the integration suite; remote D1 smoke-tested.

### Phase 2 — Storage → R2
- **Modify** `/wrangler.jsonc`: `r2_buckets` binding `RECEIPTS_BUCKET`; `wrangler types`.
- **Rewrite** `/src/lib/storage.ts`: R2 binding `put/get/delete` via `getCloudflareContext().env.RECEIPTS_BUCKET`; UUID keys; `storageUrl = r2://<key>`; **delete by KEY**. (Pre-launch: no Blob back-compat branch needed — drop the `http(s)` Blob path; keep `file://` only if useful for local dev.)
- **Modify** `/src/lib/env.ts`: remove `BLOB_READ_WRITE_TOKEN`; remove `@vercel/blob`.

`/src/app/api/receipts/[receiptId]/download/route.ts` keeps its auth-gated proxy; bucket stays private.

**Gate:** Upload PDF/JPEG/PNG, confirm download Content-Type round-trips, confirm combined-PDF route embeds R2 receipts.

### Phase 3 — PDF + Queue-based parsing
- **PDF — `/src/lib/pdf/generate-request-pdf.ts`:** prefer **pdf-lib `StandardFonts`** and **drop pdfkit** (smaller, avoids `.afm`/fontkit workerd risk). Keep PDF inline in the GET route; watch the 10 ms CPU cap on multi-page docs.
- **Queues — `/wrangler.jsonc`:** add `queues.producers` + `queues.consumers` binding `RECEIPT_QUEUE`.
- **Producer — `/src/app/api/requests/[requestId]/parse/route.ts`:** replace inline `Promise.allSettled(processReceipt)` with `env.RECEIPT_QUEUE.sendBatch([...])` returning 202; enqueue only `{ receiptFileId, requestId }` (never bytes — 128 KB message cap). Frontend already polls `parseStatus`.
- **Consumer — `/src/queue/receipt-consumer.ts`:** `queue()` handler runs `processReceipt` with bounded concurrency (≤6 outbound), then `recomputeRequestTotal` once per requestId. `process-receipt.ts` logic unchanged. (Free Queues: 10k ops/day, 24 h retention — ample.)

**Gate:** On `preview`, enqueue a multi-receipt parse, confirm the consumer processes and totals recompute; confirm worst-case PDF stays under 128 MB memory.

### Phase 4 — CI / Secrets / Cutover
- **Modify** `/package.json`: `build` → `next build`; `drizzle-kit generate` + client steps as needed.
- **Delete** `/vercel.json`.
- **Create** `/.github/workflows/ci.yml`: PRs run lint + vitest + playwright; `main` runs `npx opennextjs-cloudflare build` → `npx wrangler deploy`.
- **Secrets:** `wrangler secret put CLERK_SECRET_KEY CLERK_JWT_KEY GOOGLE_AI_API_KEY`. Vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `APP_URL`, `GOOGLE_AI_MODEL`.
- **Seed prod D1** (`wrangler d1 ... --remote` or the ported seed). **Custom domain** on the Worker; set Clerk production instance domains/keys.
- **Cutover:** deploy, smoke-test on `workers.dev`, flip DNS. (Pre-launch — no traffic to coordinate.)
- **Modify** `/README.md` + `/.env.example` (remove Turso/Blob/NextAuth; add Clerk + D1/R2/Queue bindings).

**Gate:** Full smoke test on the custom domain.

---

## 5. Per-Layer Detail

### 5.1 Hosting (Vercel → Workers via @opennextjs/cloudflare)
**Steps:** §4 Phase 0. **Key files:** `/wrangler.jsonc`, `/open-next.config.ts`, `/next.config.ts`, `/package.json`, `/vercel.json` (delete). **Risks:** green `next dev` → 500 on workerd (medium → gate on `preview`); `experimental.authInterrupts` gaps (low). Bundle size is no longer a concern (64 MiB uncompressed + Drizzle).

### 5.2 Database (Prisma/Turso → Drizzle/D1)
**Steps:** §4 Phase 1. **Key files:** `/src/db/schema.ts` (new), `/drizzle.config.ts` (new), `/src/lib/db.ts` (rewrite), ~52 query consumers, `/prisma/*` (delete), seed, `/wrangler.jsonc`. **Risks (high):** Prisma→Drizzle **query-rewrite completeness** (every query changes; lean on types + integration tests); **money representation** change (Decimal → integer cents) touching business logic; **D1 no transactions** → `db.batch()` (4 sites, §6); **100 bound-param cap** on bulk inserts; **50 queries/invocation** on Free (audit N+1 hot paths — `include`-heavy reads).

### 5.3 Storage (Vercel Blob → R2)
**Steps:** §4 Phase 2. **Key files:** `/src/lib/storage.ts` (rewrite), `/src/lib/env.ts`, `/wrangler.jsonc`, plus the receipt routes and `process-receipt.ts`/`pdf/route.ts` consumers. **Risks (high):** R2 binding only on Workers; delete-by-key semantics; keep the bucket private. (No Blob back-compat needed — pre-launch.)

### 5.4 Authentication (NextAuth → Clerk)
**Steps:** §4 Phase 0 + §2.3–2.5. **Key files:** `/src/app/layout.tsx`, `/src/proxy.ts` (replace), `(auth)/sign-in|sign-up`, `/src/components/auth/*` + `api/auth/register` + `src/auth.ts` + `src/lib/auth-cookies.ts` (delete), `/src/lib/rbac.ts`, `/src/lib/access.ts`, schema (`clerkUserId`), every `session.user` reader. **Risks (high):** identity-bridge completeness (broad blast radius). **Medium:** Clerk `frontendApiProxy` relative-URL SSR 500 (avoid it); lazy-provision race (idempotent upsert); 7-day fixed session on Free (confirm acceptable).

### 5.5 Heavy Node / PDF / AI (Queues)
**Steps:** §4 Phase 3. **Risks:** **10 ms Free CPU cap** on PDF gen + base64 (compute only — Gemini awaits are free wall-clock); ≤6 outbound + 50 subrequests caps (bound consumer concurrency); 128 MB memory on big PDF merges; pdfkit `.afm` loading if retained (prefer pd-lib). Escape hatch for any CPU overrun: $5 Standard plan (30 s CPU).

### 5.6 Build / CI / Env / Testing
**Steps:** §4 Phase 4. GitHub Actions builds + `wrangler deploy`. **Risks:** bindings not on `process.env` (high — use `getCloudflareContext().env`); Vitest assumes file SQLite (medium — keep file SQLite via Drizzle, add a Miniflare-D1 smoke suite); Clerk in E2E needs test tokens (medium — `@clerk/testing`).

---

## 6. The 4 transaction sites (D1 has no interactive transactions)

D1 doesn't support interactive transactions; the Drizzle D1 driver offers **`db.batch([...])`** (atomic, but no read-then-write-on-read inside the batch). Convert:

| Site | Pattern | Conversion |
|---|---|---|
| `src/app/api/admin/teams/[teamId]/members/[membershipId]/route.ts:58` | array-form `$transaction([...])` | direct → `db.batch([...])` |
| `src/lib/reimbursements/workflow.ts:21` | interactive: read request → compute total → update + audit-log | read first, compute, then `db.batch([update, auditInsert])`; add idempotency on re-run |
| `src/lib/jobs/process-receipt.ts:69` | interactive: write line items + receipt status | `db.batch([...inserts, statusUpdate])` |
| `src/app/api/onboarding/complete/route.ts:74` | interactive: create membership, return it | sequence reads, then `db.batch([...])`; re-read for the return value |

Add integration tests asserting partial-failure leaves no half-state.

---

## 7. Env Var / Secrets & Bindings Mapping

| Variable / resource | Today | Cloudflare disposition |
|---|---|---|
| `CLERK_SECRET_KEY` | — | **Secret** |
| `CLERK_JWT_KEY` (PEM) | — | **Secret** (networkless verify) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | — | **Var** (public) |
| `GOOGLE_AI_API_KEY` | Vercel env | **Secret** |
| `GOOGLE_AI_MODEL` | Vercel env | **Var** |
| `APP_URL` | Vercel env | **Var** (final https domain) |
| `AUTH_SECRET` / `NEXTAUTH_URL` | Vercel env | **Dropped** (Clerk) |
| `DATABASE_URL` / `TURSO_*` | Vercel env | **Dropped** (D1 binding; drizzle-kit uses account/DB id + token) |
| `BLOB_READ_WRITE_TOKEN` | Vercel | **Dropped** (R2 binding) |
| `LOCAL_STORAGE_DIR` | local only | **Dropped in prod** |
| D1 / R2 / Queue / Assets | — | **Bindings** `DB`, `RECEIPTS_BUCKET`, `RECEIPT_QUEUE`, `ASSETS` |

---

## 8. Testing Strategy

- **Unit:** unaffected logic runs as-is; remove bcrypt/NextAuth tests; add tests for `getCurrentAppUser()`, the money-representation helpers, and the 4 `db.batch()` rewrites.
- **Integration:** keep file SQLite via Drizzle (`drizzle-kit push` to a test DB) for speed; add a small **Miniflare-D1** smoke suite (`@cloudflare/vitest-pool-workers`) for D1-specific behavior (batch atomicity, param caps, 50-query cap). Replace NextAuth session stubs with `clerkUserId`-keyed `User` fixtures.
- **E2E:** Playwright against `opennextjs-cloudflare preview`; authenticate via `@clerk/testing` + a seeded test user.
- **CI:** lint + vitest + playwright on PRs; deploy on `main`.

---

## 9. Open Questions / Decisions Needed

Resolved (locked): Clerk (free), Drizzle, D1, R2, Queues, Free plan, GitHub Actions, lazy user provisioning, audit-4-tx, no data migration.

Still open:
1. **Money representation in Drizzle:** integer cents (recommended, exact) vs text-backed decimal? Affects `format.ts` and parsing aggregates.
2. **PDF library:** confirm **pd-lib only** (drop pdfkit) is acceptable for current PDF output.
3. **Clerk 7-day fixed session** (Free) acceptable, or is custom session duration (Pro, $25/mo) worth it later?
4. **Multi-tenancy:** keep all school/program/team scoping in the app DB (recommended), or adopt Clerk **Organizations** for any of it?
5. **Local dev DB:** Drizzle file SQLite (simpler) vs Miniflare local D1 (prod-parity).

---

## 10. Rollback / Risk Posture

Pre-launch, so rollback is low-stakes:
- Work lands on a branch; the Vercel/Turso/Blob/NextAuth/Prisma code stays in git history until the Cloudflare stack is green. Reverting the merge restores the Vercel-deployable state.
- No production data or users exist, so there is **nothing to lose or reverse** on cutover — DNS simply points at the Worker once `preview` and a deployed smoke test pass.
- Keep Turso/Blob/Vercel resources until the first clean Cloudflare deploy, then delete.
- Phases are independent: a failure in (say) Queues can fall back to inline parsing without unwinding D1/R2/Clerk.
