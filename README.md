# Reimbursement Request Manager

A multi-tenant reimbursement workflow app for school robotics teams. Parents and mentors submit receipt-backed reimbursement requests, coaches handle team-level review, and scoped reimbursement admins or super admins complete approval and payment.

**Live demo:** [reimbursement-request-manager.vercel.app](https://reimbursement-request-manager.vercel.app)

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, Turbopack)
- **Database:** SQLite (local) / Turso (production) via Prisma ORM
- **File Storage:** Local filesystem (local) / Vercel Blob (production)
- **Hosting:** Vercel
- **Auth:** NextAuth.js v4 (credentials provider, bcryptjs)
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

- Node.js 20+
- npm

### Quick Setup

Run the setup script — it handles environment config, dependencies, database, and seeding in one step:

```bash
./setup.sh
```

Then start the dev server:

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Manual Setup

If you prefer to run each step yourself:

```bash
cp .env.example .env           # create env file (edit AUTH_SECRET or regenerate it)
npm install                    # install dependencies
npx prisma generate            # generate Prisma client
npx prisma migrate dev         # create database and apply migrations
npm run prisma:seed            # seed with demo data
npm run dev                    # start the dev server
```

### Environment Variables

The setup script auto-generates `AUTH_SECRET`. To set other values, edit `.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite file path (relative to `prisma/`) |
| `AUTH_SECRET` | Yes | auto-generated | Random secret for NextAuth session signing |
| `APP_URL` | No | `http://localhost:3000` | Application base URL |
| `NEXTAUTH_URL` | No | — | NextAuth callback URL (falls back to `APP_URL`) |
| `GOOGLE_AI_API_KEY` | No | — | Gemini API key for AI receipt parsing |
| `GOOGLE_AI_MODEL` | No | `gemini-2.5-flash` | Gemini model name |
| `LOCAL_STORAGE_DIR` | No | `data/uploads` | Directory for uploaded receipt files |
| `TURSO_DATABASE_URL` | No | — | Turso database URL (enables cloud DB) |
| `TURSO_AUTH_TOKEN` | No | — | Turso auth token |
| `BLOB_READ_WRITE_TOKEN` | No | — | Vercel Blob token (enables cloud file storage) |

### Seed Accounts

The seed script loads a verified Novi-area catalog for `Novi Community School District` and creates five demo users you can sign in with immediately:

| Email | Password | Access |
|-------|----------|--------|
| `admin@school.org` | `Admin1234` | Super admin |
| `schooladmin@school.org` | `SchoolAdmin1234` | School admin across the seeded Novi schools |
| `programadmin@school.org` | `ProgramAdmin1234` | Program admin for seeded FLL schools |
| `coach@team.org` | `Coach1234` | Coach on `Frog Force 503` |
| `user@team.org` | `User1234` | Parent/Mentor on `Frog Force 503` |

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
│   ├── (auth)/                 # Public auth routes (sign-in, sign-up)
│   └── api/                    # Route handlers
│       ├── auth/               # Registration + NextAuth
│       ├── requests/           # CRUD, submit, reopen, parse, autofill, line-items,
│       │                       #   coach/admin decisions, receipts, PDF export
│       ├── receipts/           # File download
│       ├── onboarding/         # Team join
│       ├── teams/              # Team list + registration requests
│       ├── notifications/      # User notifications + mark-read
│       └── admin/              # Users (role management), teams, team-request decisions
├── components/
│   ├── reimbursements/         # Request forms, receipt uploader, line item editor
│   ├── onboarding/             # Team selector, registration form
│   ├── admin/                  # User/team management tables and forms
│   ├── ui/                     # Shared UI primitives (Button, Card, Badge, etc.)
│   └── auth/                   # Sign-in/out components
└── lib/
    ├── parsing/                # AI receipt parsing + normalization
    ├── reimbursements/         # Workflow transitions, status helpers, repository, caching
    ├── notifications/          # Notification events + sender
    ├── audit/                  # Audit logging
    ├── pdf/                    # PDF generation for reimbursement requests
    ├── jobs/                   # Background receipt processing
    ├── db.ts                   # Prisma client singleton (auto-selects SQLite or Turso)
    ├── env.ts                  # Zod-validated environment config
    ├── rbac.ts                 # Role-based access control helpers
    └── storage.ts              # File storage abstraction (local filesystem or Vercel Blob)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm start` | Start production server |
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm test` | Run all Vitest tests (unit + integration) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:unit` | Unit tests only (`tests/unit/`) |
| `npm run test:integration` | Integration tests only (`tests/integration/`) |
| `npm run test:e2e` | Playwright E2E tests (`tests/e2e/`) |
| `npm run prisma:generate` | Regenerate Prisma client after schema changes |
| `npm run prisma:migrate` | Create and apply database migrations |
| `npm run prisma:seed` | Seed the database with demo data |

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

The app is designed to run locally with zero cloud dependencies, but can be deployed to Vercel with Turso and Vercel Blob for free.

### Production Stack

| Concern | Local Dev | Production |
|---------|-----------|------------|
| Database | SQLite file | Turso (libSQL) |
| File storage | Local filesystem | Vercel Blob |
| Hosting | `next dev` | Vercel |

### Deploy to Vercel

1. **Create a Turso database:**
   ```bash
   turso db create reimbursement-manager
   turso db show reimbursement-manager --url
   turso db tokens create reimbursement-manager
   ```

2. **Push the schema to Turso:**
   ```bash
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | turso db shell reimbursement-manager
   ```

3. **Seed the database (optional):**
   ```bash
   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts
   ```

4. **Connect your GitHub repo to Vercel** and add a Blob store (Vercel Dashboard > Storage > Create Blob Store).

5. **Set environment variables** in Vercel project settings:
   - `DATABASE_URL` = `file:./dev.db`
   - `TURSO_DATABASE_URL` = your Turso URL
   - `TURSO_AUTH_TOKEN` = your Turso token
   - `AUTH_SECRET` = generate with `openssl rand -base64 32`
   - `APP_URL` / `NEXTAUTH_URL` = your Vercel deployment URL
   - `GOOGLE_AI_API_KEY` = your Gemini API key
   - `BLOB_READ_WRITE_TOKEN` is set automatically when linking the Blob store

6. **Deploy** — Vercel auto-deploys on push to `main`.

## License

MIT
