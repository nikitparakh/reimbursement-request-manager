# Reimbursement Request Manager

A multi-role reimbursement workflow app for school robotics teams. Parents/mentors submit receipt-backed reimbursement requests, coaches review and approve, and admins give final sign-off and mark payment.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, Turbopack)
- **Database:** SQLite via Prisma ORM
- **Auth:** NextAuth.js (credentials provider, bcrypt)
- **AI Parsing:** Google Gemini API for receipt/invoice extraction
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest (unit + integration), Playwright (E2E)

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
| `ADMIN` | Admin | Approve/reject coach-approved requests, mark paid, manage teams |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create and seed the database
npx prisma migrate dev
npm run prisma:seed

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`.

### Environment Variables

Copy `.env` and set:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path (default: `file:./dev.db`) |
| `AUTH_SECRET` | Random secret for NextAuth session signing |
| `APP_URL` | Base URL (default: `http://localhost:3000`) |
| `GOOGLE_AI_API_KEY` | Gemini API key for receipt parsing |
| `GOOGLE_AI_MODEL` | Gemini model name (default: `gemini-2.5-flash`) |
| `LOCAL_STORAGE_DIR` | Receipt file storage directory (default: `data/uploads`) |

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
│   │   └── admin/              # Admin inbox + team approvals
│   └── api/                    # Route handlers
│       ├── auth/               # Registration + NextAuth
│       ├── requests/           # CRUD, submit, parse, line-items, decisions
│       ├── receipts/           # File download
│       ├── onboarding/         # Team join
│       └── admin/              # User role management, team requests
├── components/
│   ├── reimbursements/         # Request forms, receipt uploader, line item editor
│   ├── onboarding/             # Team selector, registration form
│   ├── ui/                     # Shared UI primitives (Button, Card, Badge, etc.)
│   └── auth/                   # Sign-in/out components
└── lib/
    ├── parsing/                # AI receipt parsing + normalization
    ├── reimbursements/         # Workflow transitions, serialization
    ├── notifications/          # Email notification stubs
    └── audit/                  # Audit logging
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (zero warnings) |
| `npm test` | Run all tests (unit + integration) |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed the database |

## Key Features

- **AI Receipt Parsing** — Upload PDFs/images, Gemini extracts line items, totals, tax, merchant info
- **Editable Line Items** — Review and correct AI-extracted data before submission with inline editing and auto-save
- **Tax Exclusion** — Sales tax is detected and excluded from reimbursable totals
- **Multi-receipt Requests** — Attach multiple receipts per request with individual extraction
- **Approval Chain** — Two-stage approval (coach → admin) with audit trail
- **Collapsible Request Cards** — Browse request history with expandable detail views
- **Role-adaptive Navigation** — UI adapts based on user role
- **Team Management** — Self-service team join with admin-approved team registration

## License

MIT
