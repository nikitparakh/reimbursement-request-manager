# Reimbursement Request Manager

A multi-role reimbursement workflow app for school robotics teams. Parents/mentors submit receipt-backed reimbursement requests, coaches review and approve, and admins give final sign-off and mark payment.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, Turbopack)
- **Database:** SQLite via Prisma ORM
- **Auth:** NextAuth.js v4 (credentials provider, bcryptjs)
- **AI Parsing:** Google Gemini API for receipt/invoice extraction
- **PDF Generation:** pdfkit + pdf-lib
- **Validation:** Zod v4
- **Styling:** Tailwind CSS v4 + PostCSS
- **Testing:** Vitest (unit + integration), Playwright (E2E)
- **Linting:** ESLint 9 (flat config)

## Workflow

```
Parent/Mentor                 Coach                  Admin
     |                          |                      |
  Create Draft ──► Upload       |                      |
  Receipts ──► AI Parse ──►     |                      |
  Review Line Items ──►         |                      |
  Submit ──────────────► Review & Approve ──────►      |
                         or Reject ◄─────────── Review & Approve
                                                 or Reject
                                                 or Mark Paid
```

**Statuses:** `DRAFT` → `SUBMITTED` → `COACH_APPROVED` / `COACH_REJECTED` → `ADMIN_APPROVED` / `ADMIN_REJECTED` → `PAID`

## Roles

| Role | Label | Capabilities |
|------|-------|-------------|
| `STUDENT` | Parent/Mentor | Create requests, upload receipts, edit line items, submit |
| `COACH` | Coach | All parent/mentor abilities + review/approve/reject submitted requests |
| `ADMIN` | Admin | Approve/reject coach-approved requests, mark paid, manage teams and users |

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

### Seed Accounts

The seed script creates a team ("Demo Team 503") with three users you can sign in with immediately:

| Email | Password | Role |
|-------|----------|------|
| `admin@school.org` | `Admin1234` | Admin |
| `coach@team.org` | `Coach1234` | Coach |
| `user@team.org` | `User1234` | Parent/Mentor |

It also creates sample reimbursement requests in various statuses (draft, submitted, coach-approved) with receipts and line items, plus a pending team registration request.

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
│   ├── (auth)/                 # Public auth routes (sign-in, sign-up, admin-sign-up)
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
    ├── db.ts                   # Prisma client singleton
    ├── env.ts                  # Zod-validated environment config
    ├── rbac.ts                 # Role-based access control helpers
    └── storage.ts              # Local file storage abstraction
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
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

## License

MIT
