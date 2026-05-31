# Reimbursement Request Manager

A multi-tenant reimbursement workflow app for school robotics teams. Parents and mentors submit receipt-backed reimbursement requests, coaches handle team-level review, and scoped reimbursement admins or super admins complete approval and payment.

**Live demo:** [reimbursement-request-manager.vercel.app](https://reimbursement-request-manager.vercel.app)

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, Turbopack)
- **Hosting:** Cloudflare Workers via `@opennextjs/cloudflare` (local: `next dev`)
- **Database:** Cloudflare D1 (local: SQLite file) via Drizzle ORM
- **File Storage:** Cloudflare R2 (local: filesystem)
- **Background jobs:** Cloudflare Queues (receipt parsing consumer Worker)
- **Auth:** Clerk
- **AI Parsing:** Google Gemini API for receipt/invoice extraction
- **PDF Generation:** pdfkit + pdf-lib
- **Validation:** Zod v4
- **Styling:** Tailwind CSS v4 + PostCSS
- **Testing:** Vitest (unit + integration), Playwright (E2E)
- **Linting:** ESLint 9 (flat config)

## Workflow

```
Parent/Mentor           Coach / Reimbursement Admin      Reimbursement Admin
     |                               |                           |
  Create Draft ──► Upload            |                           |
  Receipts ──► AI Parse ──►          |                           |
  Review Line Items ──►              |                           |
  Submit ───────────────────────► Initial Review ───────────► Final Review
                                 Approve / Reject            Approve / Reject
                                                             or Mark Paid
```

**Statuses:** `DRAFT` → `SUBMITTED` → `COACH_APPROVED` / `COACH_REJECTED` → `ADMIN_APPROVED` / `ADMIN_REJECTED` → `PAID`

## Access Model

| Layer | Value | What it means | Capabilities |
|------|-------|---------------|--------------|
| Global role | `USER` | Standard signed-in account | Can onboard, hold team memberships, and submit requests through team membership |
| Global role | `SUPER_ADMIN` | Platform-wide administrator | Manage users, teams, registrations, reimbursements, and settings everywhere |
| Scoped admin role | `SCHOOL_ADMIN` | Reimbursement admin for one school (or a district-scoped school admin row) | Manage users, teams, registrations, and reimbursements inside the assigned school scope |
| Scoped admin role | `PROGRAM_ADMIN` | Reimbursement admin for one school + program pair | Manage teams, registrations, and reimbursements inside the assigned program scope |
| Team membership | `COACH` | Team-level reviewer and workspace manager | Review submitted requests, manage the team workspace, and see coach surfaces |
| Team membership | `PARENT_MENTOR` | Team member / requester | Create drafts, upload receipts, edit line items, submit requests, and view the team roster |

Canonical rules in the app:

- `User.role` is global-only and currently supports `USER` or `SUPER_ADMIN`.
- `UserScopeRole` is used for scoped admin assignments such as `SCHOOL_ADMIN` and `PROGRAM_ADMIN`.
- `TeamMembership` is the source of truth for roster roles such as `COACH` and `PARENT_MENTOR`.
- Scoped reimbursement admins may act at the initial review stage when needed, but those actions are labeled as admin actions in the workflow and notifications.

### Legacy Upgrade Note

Pre-refactor databases are migrated into a placeholder inactive `LEGACY` program and default legacy district/school records so existing teams, requests, and memberships remain valid until they are reclassified into active school/program assignments.

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- A **Clerk** application (free) — the app uses Clerk for all authentication
- Optional: a **Google Gemini** API key for AI receipt parsing

### Setup

```bash
cp .env.example .env            # fill in Clerk keys (see Environment Variables)
npm install                     # install dependencies
npm run db:generate             # generate Drizzle migrations (already committed)
npm run db:migrate:local        # apply migrations to the local (Miniflare) D1
npm run dev                     # start the dev server
```

The app runs at [http://localhost:3000](http://localhost:3000). `next dev` provides
local D1/R2/Queue bindings via Miniflare (wired through `@opennextjs/cloudflare`).
To exercise the real `workerd` runtime locally, use `npm run preview` and put
secrets in `.dev.vars` instead of `.env`.

> **Auth:** sign-in/up is handled by Clerk's hosted UI components. Create an
> account through the app's sign-up page; the matching app `User` row is
> provisioned on first sign-in (linked to seeded rows by email — see below).

### Environment Variables

Local dev reads `.env` (or `.dev.vars` for `preview`). The deployed app gets its
database and storage from **Cloudflare bindings** and its secrets from
`wrangler secret` — see [Deployment](#deployment).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | — | Clerk publishable key (public, build-time) |
| `CLERK_SECRET_KEY` | Yes | — | Clerk secret key |
| `CLERK_JWT_KEY` | Prod | — | Clerk PEM public key (networkless JWT verify on Workers) |
| `GOOGLE_AI_API_KEY` | No | — | Gemini API key for AI receipt parsing |
| `GOOGLE_AI_MODEL` | No | `gemini-2.5-flash` | Gemini model name |
| `APP_URL` | No | `http://localhost:3000` | Application base URL |
| `LOCAL_STORAGE_DIR` | No | `data/uploads` | Local receipt storage (dev/test; prod uses R2) |
| `DATABASE_URL` | No | `file:./local.db` | Local SQLite for the seed script + tests only |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | No | — | Target a remote libSQL/Turso DB when running the seed script |

Clerk also reads optional routing vars (`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, etc.) —
defaults are provided in `.dev.vars`/`.env.example`.

### Seed Data

The seed script (`npm run db:seed`) loads a verified Novi-area catalog for
`Novi Community School District` and creates five demo accounts (roles + team
memberships). Authentication is via Clerk, so **passwords no longer live in the
app** — to sign in as a demo user, create a Clerk user with the matching email
and it links to the seeded row on first sign-in:

| Email | Access |
|-------|--------|
| `admin@school.org` | Super admin |
| `schooladmin@school.org` | School admin across the seeded Novi schools |
| `programadmin@school.org` | Program admin for seeded FLL schools |
| `coach@team.org` | Coach on `Frog Force 503` |
| `user@team.org` | Parent/Mentor on `Frog Force 503` |

Seeded public teams include:

- `Frog Force 503` at `Novi High School` (`FRC`)
- `Robo Rhinos` at `Novi Middle School` (`FTC`)
- `Frog Tech` at `Novi Meadows Elementary School` (`FLL Challenge`)
- `Galaxy Frogs`, `LEGO RYDERS`, and `Whale Titans` at `Parkview Elementary School` (`FLL`)

It also creates sample reimbursement requests in various statuses (draft, submitted, coach-approved) for `Frog Force 503`, with receipts and line items, plus a pending sample team registration request.

## Project Structure

```
src/
├── app/
│   ├── (app)/                  # Authenticated routes
│   │   ├── page.tsx            # Dashboard
│   │   ├── onboarding/         # Team join / registration
│   │   ├── team/               # Team member view
│   │   ├── user/requests/      # Create, view, manage requests
│   │   ├── coach/              # Coach inbox + team reimbursements
│   │   └── admin/              # Inbox, requests, users, teams, team-requests
│   ├── (auth)/                 # Clerk sign-in / sign-up pages
│   ├── api/                    # Route handlers
│   │   ├── requests/           # CRUD, submit, reopen, parse, autofill, line-items,
│   │   │                       #   coach/admin decisions, receipts, PDF export
│   │   ├── receipts/           # File download (auth-gated R2 proxy)
│   │   ├── onboarding/         # Team join
│   │   ├── teams/              # Team list + registration requests
│   │   ├── notifications/      # User notifications + mark-read
│   │   └── admin/              # Users (role management), teams, team-request decisions
│   ├── layout.tsx              # Root layout (ClerkProvider)
│   └── proxy.ts                # Edge middleware (Clerk clerkMiddleware)
├── db/
│   └── schema.ts               # Drizzle schema (tables, enums, relations, money type)
├── components/
│   ├── reimbursements/         # Request forms, receipt uploader, line item editor
│   ├── onboarding/             # Team selector, registration form
│   ├── admin/                  # User/team management tables and forms
│   ├── ui/                     # Shared UI primitives (Button, Card, Badge, etc.)
│   └── auth/                   # Clerk sign-out button
└── lib/
    ├── parsing/                # AI receipt parsing + normalization
    ├── reimbursements/         # Workflow transitions, status helpers, repository, caching
    ├── notifications/          # Notification events + sender
    ├── audit/                  # Audit logging
    ├── pdf/                    # PDF generation for reimbursement requests
    ├── jobs/                   # Receipt processing job (context-injectable)
    ├── db.ts                   # Per-request Drizzle D1 client factory + `db` proxy
    ├── queue.ts                # RECEIPT_QUEUE producer accessor
    ├── env.ts                  # Zod-validated plaintext config
    ├── rbac.ts                 # Role-based access control helpers
    └── storage.ts              # File storage abstraction (R2 binding / local FS fallback)

workers/
└── receipt-consumer/           # Cloudflare Queue consumer Worker (receipt parsing)

scripts/
├── seed.ts                     # Standalone Drizzle seed script (libSQL/Turso target)
└── seed-cleanup.ts             # Legacy scoped-role cleanup helper
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack, Miniflare bindings) |
| `npm run build` | Production build (`next build`) |
| `npm run preview` | Build with OpenNext and serve on the real `workerd` runtime |
| `npm run deploy` | Build with OpenNext and deploy the app Worker |
| `npm run deploy:consumer` | Deploy the receipt-parse Queue consumer Worker |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` from wrangler config |
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm test` | Run all Vitest tests (unit + integration) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:unit` | Unit tests only (`tests/unit/`) |
| `npm run test:integration` | Integration tests only (`tests/integration/`) |
| `npm run test:e2e` | Playwright E2E tests (`tests/e2e/`) |
| `npm run db:generate` | Generate Drizzle migrations from `src/db/schema.ts` |
| `npm run db:migrate:local` | Apply D1 migrations to the local Miniflare DB |
| `npm run db:migrate:remote` | Apply D1 migrations to the remote D1 database |
| `npm run db:seed` | Seed the database with demo data |

## Testing

Tests live under `tests/` with shared helpers and fixtures:

```
tests/
├── unit/           # Pure logic tests (parsing, workflow, RBAC, storage, etc.)
├── integration/    # API route tests with a real test database
├── e2e/            # Playwright browser tests (sign-up, user/coach/admin flows)
├── helpers/        # Shared setup, factories, and utilities
└── fixtures/       # Sample receipt files
```

Run the full suite:

```bash
npm test && npm run test:e2e
```

E2E tests require Playwright browsers — install them once with:

```bash
npx playwright install
```

## Key Features

- **AI Receipt Parsing** — Upload PDFs/images, Gemini extracts line items, totals, tax, merchant info
- **Editable Line Items** — Review and correct AI-extracted data before submission with inline editing and auto-save
- **Tax Exclusion** — Sales tax is detected and excluded from reimbursable totals
- **Multi-receipt Requests** — Attach multiple receipts per request with individual extraction
- **Approval Chain** — Two-stage approval (coach → admin) with full audit trail
- **PDF Export** — Generate downloadable PDF summaries of reimbursement requests
- **In-app Notifications** — Real-time notification feed for status changes and approvals
- **Collapsible Request Cards** — Browse request history with expandable detail views
- **Role-adaptive Navigation** — UI adapts based on user role
- **Team Management** — Self-service team join with admin-approved team registration
- **User Management** — Admin controls for role assignment and team membership

## Deployment

The app runs locally with zero cloud dependencies and deploys to **Cloudflare** (Workers + D1 + R2 + Queues) with **Clerk** auth — all on free tiers.

### Production Stack

| Concern | Local Dev | Production |
|---------|-----------|------------|
| Hosting | `next dev` | Cloudflare Workers (`@opennextjs/cloudflare`) |
| Database | SQLite file (Drizzle) | Cloudflare D1 (Drizzle) |
| File storage | Local filesystem | Cloudflare R2 |
| Receipt parsing | inline | Cloudflare Queues (consumer Worker) |
| Auth | Clerk (test instance) | Clerk (production instance) |

### Required keys & secrets

You need accounts/keys from three providers: **Clerk** (auth), **Google AI** (Gemini), and **Cloudflare** (hosting).

| Key | Purpose | Source | Set where |
|-----|---------|--------|-----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client (public) | Clerk → API Keys | `.dev.vars` locally · CI/build **variable** in prod |
| `CLERK_SECRET_KEY` | Clerk server | Clerk → API Keys | `.dev.vars` · `wrangler secret` (app Worker) |
| `CLERK_JWT_KEY` | Networkless JWT verify | Clerk → API Keys → PEM public key | `.dev.vars` · `wrangler secret` (app Worker) |
| `GOOGLE_AI_API_KEY` | Gemini receipt parsing | Google AI Studio | `.dev.vars` · `wrangler secret` (**both** Workers) |
| `CLOUDFLARE_API_TOKEN` | CI deploys | Cloudflare → API Tokens (Workers edit) | GitHub repo **secret** |
| `CLOUDFLARE_ACCOUNT_ID` | Target CF account | Cloudflare dashboard | GitHub repo **secret** |

Plus the **D1 `database_id`** from `wrangler d1 create` goes into `wrangler.jsonc` and `wrangler.consumer.jsonc`.

### One-time setup

1. **Create the Cloudflare resources** (Workers Free plan is sufficient):
   ```bash
   npx wrangler login
   npx wrangler d1 create reimbursement-manager      # paste database_id into wrangler.jsonc + wrangler.consumer.jsonc
   npx wrangler r2 bucket create receipts
   npx wrangler queues create receipt-parse
   npx wrangler queues create receipt-parse-dlq
   ```

2. **Create a Clerk application** (https://dashboard.clerk.com) and grab the publishable key, secret key, and PEM public key.

3. **Set Worker secrets** (app Worker + consumer Worker):
   ```bash
   npx wrangler secret put CLERK_SECRET_KEY
   npx wrangler secret put CLERK_JWT_KEY
   npx wrangler secret put GOOGLE_AI_API_KEY
   npx wrangler secret put GOOGLE_AI_API_KEY --config wrangler.consumer.jsonc
   ```
   Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as a build-time var (CI variable / build env).

4. **Apply migrations and seed:**
   ```bash
   npx wrangler d1 migrations apply reimbursement-manager --remote
   # optional: seed a libSQL/Turso copy, then import, or run the seed against a local D1
   ```

### Deploy

```bash
npm run deploy            # OpenNext build + deploy the app Worker (queue producer)
npm run deploy:consumer   # deploy the receipt-parse Queue consumer Worker
```

CI (`.github/workflows/ci.yml`) runs lint + tests on every PR and auto-deploys both Workers on push to `main` (requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets and the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` repo variable).

### Local Cloudflare runtime

`npm run preview` builds with OpenNext and serves the app on the real `workerd` runtime (catches Workers-only issues that `next dev` misses). Put Clerk/Gemini values in `.dev.vars`.

## License

MIT
