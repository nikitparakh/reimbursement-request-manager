# UI Redesign Design Document

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Full UI overhaul of VelTest robotics tournament expense webapp

## Decisions

- **Styling:** Tailwind CSS (utility-first, no component library)
- **Mood:** Clean & Professional (SaaS aesthetic — indigo accent, slate neutrals, white surfaces)
- **Navigation:** Role-adaptive top navbar
- **Approach:** Component-first — build reusable UI primitives, then restyle all pages

---

## 1. Design System Foundation

### Color Palette

| Token | Tailwind Class | Hex | Usage |
|-------|---------------|-----|-------|
| Primary | `indigo-600` | #4F46E5 | Main actions, active nav, links |
| Primary hover | `indigo-700` | #4338CA | Hover states |
| Secondary text | `slate-600` | #475569 | Secondary text, icons |
| Background | `white` | #FFFFFF | Page background (behind navbar) |
| Page background | `slate-50` | #F8FAFC | Main content area background |
| Surface | `white` | #FFFFFF | Card backgrounds |
| Border | `slate-200` | #E2E8F0 | Dividers, card borders, input borders |
| Text | `slate-900` | #0F172A | Headings |
| Text body | `slate-700` | #334155 | Body text |
| Text muted | `slate-500` | #64748B | Descriptions, labels, help text |
| Danger | `red-600` | #DC2626 | Reject, errors, destructive actions |
| Success | `emerald-600` | #059669 | Approved, paid |
| Warning | `amber-500` | #F59E0B | Pending, submitted |

### Typography

| Element | Tailwind Classes |
|---------|-----------------|
| Page title | `text-2xl font-bold text-slate-900` |
| Section heading | `text-lg font-semibold text-slate-900` |
| Body text | `text-sm text-slate-700` |
| Labels | `text-sm font-medium text-slate-700` |
| Help text | `text-xs text-slate-500` |

### Spacing

| Context | Value |
|---------|-------|
| Page container | `max-w-6xl mx-auto px-6 py-8` |
| Card padding | `p-6` |
| Section gaps | `space-y-6` |
| Form field gaps | `space-y-4` |

### Border & Shadow

- Card: `border border-slate-200 rounded-lg shadow-sm`
- Input focus: `focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`
- Navbar: `border-b border-slate-200 shadow-sm`

---

## 2. Shared UI Components

All components go in `src/components/ui/`.

### Button

Variants: `primary`, `secondary`, `danger`, `ghost`
Sizes: `sm`, `md`
States: default, hover, disabled, loading (spinner)

```
primary:   bg-indigo-600 text-white hover:bg-indigo-700
secondary: bg-white text-slate-700 border border-slate-300 hover:bg-slate-50
danger:    bg-red-600 text-white hover:bg-red-700
ghost:     text-slate-600 hover:text-slate-900 hover:bg-slate-100
```

### Card

White surface with border. Optional `header` (with title + action) and `footer` slots.

```
bg-white border border-slate-200 rounded-lg shadow-sm
```

### Badge

Status pills with semantic colors:

| Status | Style |
|--------|-------|
| DRAFT | `bg-slate-100 text-slate-700` |
| SUBMITTED | `bg-amber-100 text-amber-800` |
| MANAGER_APPROVED | `bg-emerald-100 text-emerald-800` |
| MANAGER_REJECTED | `bg-red-100 text-red-800` |
| ADMIN_APPROVED | `bg-emerald-100 text-emerald-800` |
| ADMIN_REJECTED | `bg-red-100 text-red-800` |
| PAID | `bg-indigo-100 text-indigo-800` |
| QUEUED | `bg-slate-100 text-slate-600` |
| PROCESSING | `bg-amber-100 text-amber-800` |
| DONE | `bg-emerald-100 text-emerald-800` |
| FAILED | `bg-red-100 text-red-800` |

Base: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`

### Input / Textarea / Select

Styled form controls:
```
w-full rounded-md border border-slate-300 px-3 py-2 text-sm
placeholder:text-slate-400
focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
```

### FormField

Wraps: label + input/textarea/select + optional help text + error message.

### Table

Styled table for line items:
```
Header: bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider
Rows:   border-b border-slate-100 text-sm text-slate-700
Hover:  hover:bg-slate-50
```

### NavBar

See Section 3.

### PageHeader

Title + subtitle + optional right-aligned action button.

### EmptyState

Centered icon + heading + description text for empty lists.

### StatusTimeline

Vertical timeline with colored dots, actor, action, timestamp, comment.

### FileUploadZone

Dashed border area with upload icon, "Drag & drop or click to upload" text.
```
border-2 border-dashed border-slate-300 rounded-lg p-8 text-center
hover:border-indigo-400 hover:bg-indigo-50/50 transition
```

### Alert

Banners for success/error/info messages:
```
success: bg-emerald-50 text-emerald-800 border border-emerald-200
error:   bg-red-50 text-red-800 border border-red-200
info:    bg-indigo-50 text-indigo-800 border border-indigo-200
```

---

## 3. Navigation Bar

### Structure

```
<nav>  <!-- sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm -->
  <div>  <!-- max-w-6xl mx-auto px-6 h-16 flex items-center justify-between -->
    <AppName />     <!-- font-bold text-indigo-600 text-lg -->
    <NavLinks />    <!-- flex gap-6, role-filtered -->
    <UserMenu />    <!-- user name + sign out -->
  </div>
</nav>
```

### Nav Links by Role

| Role | Links |
|------|-------|
| Not signed in | Sign In, Create Account |
| Student | My Requests, New Request |
| Manager | My Requests, New Request, Manager Inbox |
| Admin | Manager Inbox, Admin Inbox, Team Requests |

### Link Styling

```
Default:  text-sm font-medium text-slate-600 hover:text-indigo-600 transition
Active:   text-indigo-600 border-b-2 border-indigo-600
```

### Behavior

- Reads user session and role server-side
- Hidden on `/sign-in` and `/sign-up` pages (auth pages get a minimal layout)
- User menu shows email/name with a sign-out action

---

## 4. Page Designs

### 4.1 Home Page (`/`)

**Signed out:**
- Centered hero on `slate-50` background
- App name large, one-line tagline below
- Two buttons: "Sign In" (primary), "Create Account" (secondary)

**Signed in — Dashboard:**
- PageHeader: "Dashboard"
- Grid of summary Cards (role-dependent):
  - **Student cards:** "Draft Requests" (count), "Submitted Requests" (count), quick-action "New Request" button
  - **Manager card:** "Awaiting Your Review" (count) → links to Manager Inbox
  - **Admin cards:** "Pending Approvals" (count), "Team Registrations" (count)
- Each card has an icon, count number (large), label, and links to the relevant page

### 4.2 Sign In (`/sign-in`)

- Page background: `slate-50`
- Centered Card (`max-w-md mx-auto mt-16`)
- App logo/name at top of card
- FormField for email, FormField for password
- Primary Button: "Sign In" (full width)
- Link below: "New here? Create an account"
- Error: Alert component (error variant)
- NavBar hidden on this page

### 4.3 Sign Up (`/sign-up`)

- Same centered card layout as Sign In
- FormFields: Name, Email, Password
- Help text under password field for requirements
- Primary Button: "Create Account" (full width)
- Link below: "Already have an account? Sign in"
- NavBar hidden on this page

### 4.4 Onboarding (`/onboarding`)

- PageHeader: "Get Started" / "Select your team and role"
- **Card 1 — "Join a Team":**
  - Team dropdown (Select component), Role dropdown
  - Primary Button: "Save"
  - Alert for success/error
- **Card 2 — "Register a New Team":**
  - Outlined/lighter card style to indicate secondary
  - Section heading: "Team not listed?"
  - FormFields: Team name, Short code (optional), Notes
  - Secondary Button: "Submit Request"
  - Alert for success/error

### 4.5 New Request (`/student/requests/new`)

- PageHeader: "New Reimbursement Request"
- Single Card with form:
  - FormFields: Title, Description (textarea), Team (select)
  - Primary Button: "Create Draft"
- After creation: Success Alert with Button linking to the request detail page

### 4.6 Request Detail (`/student/requests/[requestId]`)

Most complex page. Structured sections:

**Header area:**
- PageHeader: Request title + Status Badge
- Stats row: Requested total ($), Team name, Date created — in a horizontal layout

**Receipts section:**
- Section heading: "Receipts"
- FileUploadZone for uploading new receipts
- List of receipt Cards:
  - Header: Filename + ParseStatus Badge
  - Body: Merchant, total, confidence, document type
  - Expandable line items Table (Description, Qty, Unit Price, Line Total, Category)
  - Flags shown as warning Alerts

**Actions section (DRAFT status only):**
- Button row: "Auto-fill Totals" (secondary), "Submit to Manager" (primary)

**Timeline section:**
- Section heading: "Approval History"
- StatusTimeline component showing all ApprovalActions

### 4.7 Manager Inbox (`/manager/inbox`)

- PageHeader: "Manager Inbox" + count Badge
- EmptyState when no requests
- List of request Cards:
  - Card header: Request title + team Badge + requestor email
  - Card body: Requested total (prominent), receipt count summary
  - Expandable receipt details (ExtractionReview data in collapsible section)
  - Card footer: Comment textarea + "Approve" (success Button) + "Reject" (danger Button)

### 4.8 Admin Inbox (`/admin/inbox`)

- Same layout pattern as Manager Inbox
- PageHeader: "Admin Inbox" + count Badge
- Additional "Mark as Paid" primary Button option
- Status Badge visible on each card (MANAGER_APPROVED / ADMIN_APPROVED)

### 4.9 Admin Team Requests (`/admin/team-requests`)

- PageHeader: "Team Registrations" + count Badge
- EmptyState when empty
- Card list:
  - Team name (bold heading), requested by email, notes text
  - Comment textarea + "Approve" (success) + "Reject" (danger) buttons

---

## 5. Root Layout Changes

### Current
```
<html><body>{children}</body></html>
```

### New Structure
```
<html>
  <body class="bg-slate-50 min-h-screen">
    <NavBar />                    <!-- conditionally shown -->
    <main class="max-w-6xl mx-auto px-6 py-8">
      {children}
    </main>
  </body>
</html>
```

Auth pages (`/sign-in`, `/sign-up`) use a separate layout group without the NavBar.

---

## 6. File Structure for New Components

```
src/components/ui/
  button.tsx
  card.tsx
  badge.tsx
  input.tsx
  textarea.tsx
  select.tsx
  form-field.tsx
  table.tsx
  alert.tsx
  page-header.tsx
  empty-state.tsx
  status-timeline.tsx
  file-upload-zone.tsx
  navbar.tsx
  user-menu.tsx
```

---

## 7. Migration Notes

- Install Tailwind CSS and configure for Next.js
- Replace `globals.css` with Tailwind directives + minimal custom styles
- Build all UI components first before touching pages
- Restyle pages one at a time, using the new components
- Keep all existing server actions, data fetching, and business logic unchanged
- Only modify JSX/markup and styling — no functional changes
