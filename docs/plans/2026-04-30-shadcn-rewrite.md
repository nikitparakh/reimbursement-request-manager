# shadcn UI Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace every UI primitive in `src/components/ui/` with shadcn/ui equivalents, rebuild every domain component on top, and migrate every page — without changing any application functionality.

**Architecture:** Bottom-up. Install shadcn (Tailwind v4, base color `green`, CSS variables, radius `0.5rem`). Generate primitives one at a time; each task migrates every consumer of that primitive in the same commit, deletes the old file, runs lint + unit tests, then commits. Domain components rebuild as compositions of new primitives using `react-hook-form` + `zod` for forms, `@tanstack/react-table` for tables, and `sonner` for transient toasts. `lucide-react` replaces inline SVG icons.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS v4, shadcn/ui (latest), Radix UI primitives, react-hook-form + @hookform/resolvers, zod (existing), @tanstack/react-table, sonner, lucide-react.

**Reference design:** `docs/plans/2026-04-30-shadcn-rewrite-design.md`.

**General per-task verification (run from repo root unless noted):**

```bash
npm run lint && npm run test:unit
```

**E2E verification (run only when listed):**

```bash
npm run test:e2e
```

E2E requires `npx playwright install` once.

---

## PHASE 0 — Foundations

### Task 0.1: Install shadcn dependencies and initialize CLI

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Modify: `src/app/globals.css`
- Modify: `package.json`, `package-lock.json`

**Step 1: Install peer deps that shadcn needs (init asks for these too, but pre-install avoids prompts)**

```bash
npm install class-variance-authority clsx tailwind-merge tw-animate-css lucide-react
```

Expected: dependencies added without errors. Node 20+, npm 10+.

**Step 2: Run shadcn init**

```bash
npx shadcn@latest init
```

Answer prompts:
- Style: `new-york` (closer to current visual density) — fall back to `default` if `new-york` is no longer offered.
- Base color: `green`
- CSS variables: `yes`
- Use `--legacy-peer-deps`: pick the option offered by the CLI for React 19 (`--legacy-peer-deps` or `--force`).

Expected: CLI creates `components.json`, `src/lib/utils.ts`, and rewrites `src/app/globals.css` with `@theme inline { ... }`, OKLCH tokens, and a dark variant.

**Step 3: Verify `components.json` matches expectations**

Open `components.json`. Confirm:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "green",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

If any value differs, edit it to match. `radius` is set inside `globals.css` via `--radius: 0.625rem` by default — change it to `0.5rem`.

**Step 4: Verify globals.css contains the shadcn theme block**

Open `src/app/globals.css`. It must contain:
- `@import "tailwindcss";`
- `@import "tw-animate-css";`
- A `@custom-variant dark (&:is(.dark *));` line.
- A `:root { ... }` block with OKLCH `--background`, `--foreground`, `--primary`, etc.
- A `.dark { ... }` block.
- A `@theme inline { ... }` mapping `--color-background: var(--background);` etc.
- A `@layer base { * { @apply border-border outline-ring/50; } body { @apply bg-background text-foreground; } }` block.

If any are missing (older CLI shipped a smaller block), copy from https://ui.shadcn.com/docs/installation/next.

**Step 5: Verify the build still works**

```bash
npm run build
```

Expected: build succeeds. Pages will look different (theme tokens active, but our hardcoded `bg-emerald-*` / `text-slate-*` classes still render — old + new coexist temporarily).

**Step 6: Run lint to confirm no breakage**

```bash
npm run lint
```

Expected: zero warnings (project enforces `--max-warnings=0`).

**Step 7: Commit**

```bash
git add components.json src/lib/utils.ts src/app/globals.css package.json package-lock.json
git commit -m "chore(ui): initialize shadcn/ui with green base color and CSS variables"
```

---

### Task 0.2: Add Sonner toaster to root layout

**Files:**
- Modify: `src/app/layout.tsx`
- Add via shadcn CLI: `src/components/ui/sonner.tsx`

**Step 1: Generate the sonner component**

```bash
npx shadcn@latest add sonner
```

Expected: creates `src/components/ui/sonner.tsx`, installs `sonner` and (transitively) `next-themes`.

**Step 2: Mount the Toaster in the root layout**

Edit `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reimbursement Request Manager",
  description: "Reimbursement request workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen font-sans text-foreground antialiased">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
```

Note: `bg-slate-50` → `bg-background`, `text-slate-900` → `text-foreground`. These now resolve through the shadcn theme tokens.

**Step 3: Verify**

```bash
npm run build && npm run lint && npm run test:unit
```

Expected: all green.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/ui/sonner.tsx package.json package-lock.json
git commit -m "feat(ui): mount Sonner toaster in root layout"
```

---

### Task 0.3: Add `selectShadcn` test helper (no consumers yet)

**Files:**
- Modify: `tests/e2e/helpers.ts`

**Step 1: Add the helper**

Append to `tests/e2e/helpers.ts`:

```ts
export async function selectShadcn(
  page: Page,
  triggerName: string | RegExp,
  optionLabel: string | RegExp
) {
  await page.getByRole("combobox", { name: triggerName }).click();
  await page.getByRole("option", { name: optionLabel }).click();
}
```

**Step 2: Verify it doesn't break existing imports**

```bash
npm run lint && npm run test:unit
```

**Step 3: Commit**

```bash
git add tests/e2e/helpers.ts
git commit -m "test(e2e): add selectShadcn helper for Radix Select interactions"
```

---

## PHASE 1 — Primitives

Each Phase 1 task follows the pattern: generate → list consumers → migrate consumers → delete old primitive → lint + unit → commit.

### Task 1.1: Migrate Button

**Files:**
- Add via CLI: `src/components/ui/button.tsx` (overwrites old)
- Modify: every file that imports `from "@/components/ui/button"`
- Touch: `src/components/auth/sign-out-button.tsx`, `src/components/admin/user-scope-manager.tsx`, `src/components/onboarding/team-selector.tsx`, `src/components/reimbursements/request-actions.tsx`, `src/app/(app)/page.tsx`, etc.

**Step 1: Find all consumers**

```bash
rg -l "from \"@/components/ui/button\"" src
```

Record the list. Expected 20+ files.

**Step 2: Back up the old Button**

```bash
git mv src/components/ui/button.tsx src/components/ui/_old-button.tsx.bak
```

(Temporary rename so the shadcn add doesn't silently overwrite it before we map APIs.)

**Step 3: Generate shadcn Button**

```bash
npx shadcn@latest add button
```

Expected: writes new `src/components/ui/button.tsx` with `default | destructive | outline | secondary | ghost | link` variants, `default | sm | lg | icon` sizes, no `loading` prop.

**Step 4: Add `loading` support to the generated button**

Edit `src/components/ui/button.tsx`. Add an optional `loading?: boolean` prop. When `loading`, prepend `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` to children and apply `disabled`. Import `Loader2` from `lucide-react`.

Pattern:

```tsx
import { Loader2 } from "lucide-react";

// inside Button props type:
loading?: boolean;

// inside the rendered component:
<Comp
  data-slot="button"
  className={cn(buttonVariants({ variant, size, className }))}
  disabled={disabled || loading}
  ref={ref}
  {...props}
>
  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
  {children}
</Comp>
```

**Step 5: Migrate all consumers**

Variant mapping (apply via search-and-replace per file, NOT global replace):

| Old `variant` | New `variant` |
|---|---|
| `primary` (default) | `default` |
| `secondary` | `outline` |
| `danger` | `destructive` |
| `ghost` | `ghost` |
| `success` | `default` (theme is green) |

Size mapping: `sm` → `sm`, `md` → `default` (omit prop).

For each file in Step 1's list:
1. Open the file.
2. Replace `variant="primary"` with no variant prop (or `variant="default"`).
3. Replace `variant="secondary"` with `variant="outline"`.
4. Replace `variant="danger"` with `variant="destructive"`.
5. Replace `variant="success"` with no variant prop.
6. Replace `size="md"` with no size prop.
7. Verify imports still resolve.

Special cases:
- `src/components/auth/sign-out-button.tsx`: stays `<Button variant="ghost" size="sm">`.
- `src/components/onboarding/team-selector.tsx`: `<Button onClick={submit}>` stays as default variant.
- `src/components/admin/user-scope-manager.tsx`: `<Button size="sm" variant="ghost">`.
- `src/components/reimbursements/request-actions.tsx`: contains both primary and danger variants — both translate per table.

**Step 6: Delete the backup**

```bash
git rm src/components/ui/_old-button.tsx.bak
```

**Step 7: Verify**

```bash
npm run lint && npm run test:unit
```

Expected: green. If lint fails on `Button` prop type errors, narrow the new prop type to accept the old `loading` boolean.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor(ui): replace custom Button with shadcn Button + loading prop"
```

---

### Task 1.2: Migrate Input

**Files:**
- Add via CLI: `src/components/ui/input.tsx` (overwrites)
- Modify: every consumer of `from "@/components/ui/input"`

**Step 1: Find consumers**

```bash
rg -l "from \"@/components/ui/input\"" src
```

**Step 2: Back up + generate**

```bash
git mv src/components/ui/input.tsx src/components/ui/_old-input.tsx.bak
npx shadcn@latest add input
```

**Step 3: Migrate consumers**

For each consumer:
- Drop the `error` prop (shadcn `<Input>` does not have it).
- Where the old `error` prop drove a red border, the new pattern is to render an inline `<p className="text-destructive text-xs mt-1">{error}</p>` below the input, OR — once `<Form>` is wired (Task 1.5) — use `<FormMessage />`.
- For Phase 1, just remove the `error` prop and any conditional border styling. Visual error state will be reinstated in Phase 2 when forms are rebuilt with rhf.

**Step 4: Delete backup, verify, commit**

```bash
git rm src/components/ui/_old-input.tsx.bak
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): replace custom Input with shadcn Input"
```

---

### Task 1.3: Migrate Textarea

**Files:**
- Add via CLI: `src/components/ui/textarea.tsx` (overwrites)
- Modify: consumers (small set: `request-form.tsx`, `team-registration-form.tsx`, `approval-decision.tsx`, `editable-request-header.tsx`, `team-request-decision.tsx`, `line-item-comments.tsx`)

**Step 1: Generate**

```bash
git mv src/components/ui/textarea.tsx src/components/ui/_old-textarea.tsx.bak
npx shadcn@latest add textarea
```

**Step 2: Find consumers, drop `error` prop**

```bash
rg -l "from \"@/components/ui/textarea\"" src
```

For each: drop `error` prop. Same rationale as Input.

**Step 3: Verify, commit**

```bash
git rm src/components/ui/_old-textarea.tsx.bak
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): replace custom Textarea with shadcn Textarea"
```

---

### Task 1.4: Add Label primitive (no consumers yet)

**Files:**
- Add via CLI: `src/components/ui/label.tsx`

**Step 1: Generate**

```bash
npx shadcn@latest add label
```

**Step 2: Verify**

```bash
npm run lint && npm run test:unit
```

**Step 3: Commit**

```bash
git add src/components/ui/label.tsx package.json package-lock.json
git commit -m "feat(ui): add shadcn Label primitive"
```

---

### Task 1.5: Add Form primitive + FieldGroup shim, migrate FormField consumers

**Files:**
- Add via CLI: `src/components/ui/form.tsx`
- Create: `src/components/ui/field-group.tsx`
- Modify: every consumer of `from "@/components/ui/form-field"`
- Delete: `src/components/ui/form-field.tsx`

**Step 1: Generate `<Form>`**

```bash
npx shadcn@latest add form
```

This installs `react-hook-form` and `@hookform/resolvers`.

**Step 2: Create `FieldGroup` shim**

Create `src/components/ui/field-group.tsx`:

```tsx
import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";

type FieldGroupProps = {
  label: string;
  htmlFor?: string;
  helpText?: string;
  error?: string;
  children: ReactNode;
};

export function FieldGroup({ label, htmlFor, helpText, error, children }: FieldGroupProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {helpText && !error ? (
        <p className="text-muted-foreground text-xs">{helpText}</p>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
```

**Step 3: Find FormField consumers**

```bash
rg -l "from \"@/components/ui/form-field\"" src
```

**Step 4: Migrate each consumer**

For each file, replace `import { FormField } from "@/components/ui/form-field";` with `import { FieldGroup } from "@/components/ui/field-group";` and rename the JSX element accordingly.

Consumers will later be rebuilt into `<Form>` + `<FormField>` (rhf) when their parent components migrate in Phase 2. For now, `FieldGroup` is a 1:1 stand-in.

**Step 5: Delete `form-field.tsx`**

```bash
git rm src/components/ui/form-field.tsx
```

**Step 6: Verify, commit**

```bash
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): add shadcn Form + FieldGroup shim, retire custom FormField"
```

---

### Task 1.6: Migrate Card

**Files:**
- Add via CLI: `src/components/ui/card.tsx` (overwrites)
- Modify: every consumer of `from "@/components/ui/card"`

**Step 1: Find consumers**

```bash
rg -l "from \"@/components/ui/card\"" src
```

(Approx. 25 files.)

**Step 2: Generate**

```bash
git mv src/components/ui/card.tsx src/components/ui/_old-card.tsx.bak
npx shadcn@latest add card
```

The new shadcn `<Card>` exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`. Old exports were `Card`, `CardHeader`, `CardContent`, `CardFooter`. Re-exports are backwards-compatible.

**Step 3: Spot-check each consumer renders correctly**

For each consumer file, no code changes are required — imports stay the same. shadcn's defaults add slightly more padding (`p-6` vs old `p-4 sm:p-6`) and use `rounded-xl` (vs old `rounded-lg`). This is acceptable per design.

If any file passes a custom `className` that conflicted with the old `p-4 sm:p-6` padding (e.g. forces `py-4`), keep the override.

**Step 4: Delete backup, verify, commit**

```bash
git rm src/components/ui/_old-card.tsx.bak
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): replace custom Card with shadcn Card"
```

---

### Task 1.7: Migrate Alert (extend with success + warning variants)

**Files:**
- Add via CLI: `src/components/ui/alert.tsx` (overwrites)
- Modify: every consumer of `from "@/components/ui/alert"`

**Step 1: Find consumers**

```bash
rg -l "from \"@/components/ui/alert\"" src
```

**Step 2: Generate**

```bash
git mv src/components/ui/alert.tsx src/components/ui/_old-alert.tsx.bak
npx shadcn@latest add alert
```

**Step 3: Extend the variants**

Edit `src/components/ui/alert.tsx`. Find the `cva(...)` call. Add `success` and `warning` to the `variants.variant` object. Suggested classes (using theme tokens — adjust to match shadcn alert's existing class structure):

```ts
success:
  "text-emerald-700 bg-emerald-50 border-emerald-200 [&>svg]:text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
warning:
  "text-amber-700 bg-amber-50 border-amber-200 [&>svg]:text-amber-600 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
```

Then update the `VariantProps` type accordingly — should be automatic via `cva`'s type inference.

**Step 4: Migrate consumers — variant mapping**

| Old | New |
|---|---|
| `variant="success"` | `variant="success"` (just added) |
| `variant="error"` | `variant="destructive"` |
| `variant="info"` | `variant="default"` |
| `variant="warning"` | `variant="warning"` (just added) |

For each consumer, replace `variant="error"` with `variant="destructive"` and `variant="info"` with `variant="default"`. The other two stay.

shadcn's `<Alert>` renders children inside an `<AlertTitle>`/`<AlertDescription>` slot pattern — but it accepts plain children for simple cases. Existing single-string-message usage continues to work.

**Step 5: Delete backup, verify, commit**

```bash
git rm src/components/ui/_old-alert.tsx.bak
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): replace custom Alert with shadcn Alert + success/warning variants"
```

---

### Task 1.8: Migrate Badge + create StatusBadge wrapper

**Files:**
- Add via CLI: `src/components/ui/badge.tsx` (overwrites)
- Create: `src/components/ui/status-badge.tsx`
- Modify: every consumer of the old `<Badge status=…/>` API

**Step 1: Find consumers of old Badge**

```bash
rg -l "from \"@/components/ui/badge\"" src
```

**Step 2: Read the old `badge.tsx` mappings** to preserve them in the new wrapper.

**Step 3: Generate shadcn Badge**

```bash
git mv src/components/ui/badge.tsx src/components/ui/_old-badge.tsx.bak
npx shadcn@latest add badge
```

shadcn's `<Badge>` accepts `variant: default | secondary | destructive | outline` and renders children.

**Step 4: Create `StatusBadge` wrapper**

Create `src/components/ui/status-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  COACH_APPROVED: "default",
  COACH_REJECTED: "destructive",
  ADMIN_APPROVED: "default",
  ADMIN_REJECTED: "destructive",
  PAID: "default",
  QUEUED: "secondary",
  PROCESSING: "outline",
  DONE: "default",
  FAILED: "destructive",
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  APPROVE: "default",
  REJECT: "destructive",
  REOPEN: "outline",
  MARK_PAID: "default",
  SUPER_ADMIN: "default",
  USER: "secondary",
  SCHOOL_ADMIN: "default",
  PROGRAM_ADMIN: "default",
  PARENT_MENTOR: "secondary",
  STUDENT: "secondary",
  COACH: "default",
};

const colorOverride: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  SUBMITTED: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent",
  COACH_APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  COACH_REJECTED: "bg-red-100 text-red-800 hover:bg-red-100",
  ADMIN_APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  ADMIN_REJECTED: "bg-red-100 text-red-800 hover:bg-red-100",
  PAID: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  QUEUED: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  PROCESSING: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent",
  DONE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  FAILED: "bg-red-100 text-red-800 hover:bg-red-100",
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent",
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  REJECTED: "bg-red-100 text-red-800 hover:bg-red-100",
  APPROVE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  REJECT: "bg-red-100 text-red-800 hover:bg-red-100",
  REOPEN: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent",
  MARK_PAID: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  SUPER_ADMIN: "bg-slate-900 text-white hover:bg-slate-900",
  USER: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  SCHOOL_ADMIN: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  PROGRAM_ADMIN: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100",
  PARENT_MENTOR: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  STUDENT: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  COACH: "bg-purple-100 text-purple-800 hover:bg-purple-100",
};

const labelMap: Record<string, string> = {
  SUPER_ADMIN: "SUPER ADMIN",
  USER: "USER",
  SCHOOL_ADMIN: "SCHOOL ADMIN",
  PROGRAM_ADMIN: "PROGRAM ADMIN",
  PARENT_MENTOR: "PARENT / MENTOR",
  STUDENT: "PARENT/MENTOR",
  COACH: "COACH",
  COACH_APPROVED: "COACH APPROVED",
  COACH_REJECTED: "COACH REJECTED",
};

const pulsingStatuses = new Set(["QUEUED", "PROCESSING"]);

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const variant = variantMap[status] ?? "secondary";
  const colorClass = colorOverride[status] ?? "";
  const pulse = pulsingStatuses.has(status) ? "animate-pulse" : "";
  const label = labelMap[status] ?? status.replace(/_/g, " ");

  return (
    <Badge variant={variant} className={cn(colorClass, pulse, className)}>
      {label}
    </Badge>
  );
}
```

The color overrides preserve current hue exactly. (We are not refactoring color semantics in this rewrite — separate audit work.)

**Step 5: Migrate consumers**

For each consumer of the old `<Badge status="...">`:
- Change `import { Badge } from "@/components/ui/badge"` to `import { StatusBadge } from "@/components/ui/status-badge"`.
- Change `<Badge status="..."` to `<StatusBadge status="..."`.

Files to touch (from earlier grep):
- `src/components/ui/status-timeline.tsx`
- `src/components/admin/users-table.tsx`
- `src/components/admin/team-requests-table.tsx`
- `src/components/admin/admin-reimbursements-table.tsx`
- `src/components/reimbursements/team-reimbursements-table.tsx`
- `src/components/reimbursements/extraction-review.tsx`
- `src/components/reimbursements/collapsible-request-card.tsx`
- `src/app/(app)/admin/teams/[teamId]/page.tsx` (uses `<Badge status={team.active ? "APPROVED" : "REJECTED"}>` — keep behavior, just rename component)
- Any other rg hits.

**Step 6: Delete backup, verify, commit**

```bash
git rm src/components/ui/_old-badge.tsx.bak
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): swap to shadcn Badge, introduce StatusBadge wrapper"
```

---

### Task 1.9: Migrate Select (Radix) — UPDATES E2E TESTS

**Files:**
- Add via CLI: `src/components/ui/select.tsx` (overwrites)
- Modify: every consumer of the old native `<Select>`
- Modify: every E2E test that calls `selectOption(`

**Step 1: Find consumers**

```bash
rg -l "from \"@/components/ui/select\"" src
rg -n "selectOption\(" tests/e2e
```

**Step 2: Generate**

```bash
git mv src/components/ui/select.tsx src/components/ui/_old-select.tsx.bak
npx shadcn@latest add select
```

shadcn `<Select>` is Radix-based and exports `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectTrigger`, `SelectValue`, `SelectScrollUpButton`, `SelectScrollDownButton`, `SelectSeparator`.

**Step 3: Migrate each consumer to the Radix API**

Pattern transformation — old:

```tsx
<Select id="districtId" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
</Select>
```

New:

```tsx
<Select value={districtId} onValueChange={setDistrictId}>
  <SelectTrigger id="districtId" aria-label="District">
    <SelectValue placeholder="Select a district" />
  </SelectTrigger>
  <SelectContent>
    {districts.map((d) => (
      <SelectItem key={d.id} value={d.id}>
        {d.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Key API changes:
- `onChange={(e) => set(e.target.value)}` → `onValueChange={set}`.
- The trigger is what carries `id=` and `aria-label=` for accessible names. Place these on `<SelectTrigger>`.
- `<option>` becomes `<SelectItem>`.

Consumers:
- `src/components/onboarding/team-selector.tsx` (4 selects + role select)
- `src/components/admin/users-table.tsx` (role filter — still uses native `<select>` inline; convert to shadcn Select for consistency)
- `src/components/admin/admin-reimbursements-table.tsx` (multiple native selects — convert all)
- `src/components/admin/user-scope-manager.tsx` (native select + Button)
- `src/components/admin/user-role-select.tsx`
- `src/components/admin/create-team-form.tsx` (school + program selects)
- `src/components/admin/edit-team-form.tsx`
- `src/components/onboarding/team-registration-form.tsx`
- `src/components/profile/profile-form.tsx`
- Any others rg finds.

**Step 4: Update E2E tests**

For each rg hit in `tests/e2e/`:

`tests/e2e/sign-up-onboarding.spec.ts` — replace:
```ts
await page.locator("#roleIntent").selectOption("PARENT_MENTOR");
```
with:
```ts
import { selectShadcn } from "./helpers";
// ...
await selectShadcn(page, /role/i, /parent.?mentor/i);
```

`tests/e2e/admin-flow.spec.ts` — replace:
```ts
await page.getByLabel("School").selectOption({ index: 0 });
await page.getByLabel("Program").selectOption({ index: 0 });
```
with:
```ts
await page.getByRole("combobox", { name: /school/i }).click();
await page.getByRole("option").first().click();
await page.getByRole("combobox", { name: /program/i }).click();
await page.getByRole("option").first().click();
```

Audit every other `selectOption(` in the e2e folder and convert similarly.

**Step 5: Delete backup, lint + unit + e2e**

```bash
git rm src/components/ui/_old-select.tsx.bak
npm run lint && npm run test:unit
npm run test:e2e -- tests/e2e/sign-up-onboarding.spec.ts tests/e2e/admin-flow.spec.ts
```

If e2e fails on a converted selector, inspect with `--debug` and fix.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ui): swap to shadcn Select (Radix), update e2e for combobox pattern"
```

---

### Task 1.10: Migrate Skeleton + rebuild CardSkeleton/PageSkeleton

**Files:**
- Add via CLI: `src/components/ui/skeleton.tsx`
- Modify: `src/components/ui/card-skeleton.tsx` → rebuilds using `<Skeleton>`
- Modify: every consumer (`loading.tsx` files mostly)

**Step 1: Generate**

```bash
npx shadcn@latest add skeleton
```

**Step 2: Rewrite `card-skeleton.tsx`** to use `<Skeleton>` blocks instead of hand-rolled `bg-slate-200 animate-pulse` divs. Preserve exported `CardSkeleton({ lines })` and `PageSkeleton({ cardCount, lines })` signatures.

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-20" />
      </CardHeader>
      {lines > 1 && (
        <CardContent className="space-y-2">
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${80 - i * 15}%` }} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function PageSkeleton({
  cardCount = 3,
  lines = 3,
}: {
  cardCount?: number;
  lines?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} lines={lines} />
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Verify, commit**

```bash
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): rebuild CardSkeleton/PageSkeleton on shadcn Skeleton"
```

---

### Task 1.11: Migrate Pagination

**Files:**
- Add via CLI: `src/components/ui/pagination.tsx`
- Modify: `src/components/ui/pagination-controls.tsx` → use shadcn pagination primitives
- Modify: consumers of `pagination-controls.tsx`

**Step 1: Find consumers**

```bash
rg -l "pagination-controls" src
```

**Step 2: Generate**

```bash
npx shadcn@latest add pagination
```

**Step 3: Rebuild `pagination-controls.tsx`**

Edit `src/components/ui/pagination-controls.tsx`:

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type PaginationControlsProps = {
  basePath: string;
  prevCursor: string | null;
  nextCursor: string | null;
};

export function PaginationControls({ basePath, prevCursor, nextCursor }: PaginationControlsProps) {
  if (!prevCursor && !nextCursor) return null;

  return (
    <Pagination className="pt-4">
      <PaginationContent className="w-full justify-between">
        <PaginationItem>
          {prevCursor ? (
            <PaginationPrevious href={`${basePath}?cursor=${prevCursor}&dir=prev`} />
          ) : (
            <span />
          )}
        </PaginationItem>
        <PaginationItem>
          {nextCursor ? (
            <PaginationNext href={`${basePath}?cursor=${nextCursor}`} />
          ) : (
            <span />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
```

`PaginationPrevious` and `PaginationNext` are `<a>` wrappers in shadcn. If the project requires a Next.js `<Link>`, wrap with `asChild` per shadcn docs.

**Step 4: Verify, commit**

```bash
npm run lint && npm run test:unit
git add -A
git commit -m "refactor(ui): rebuild PaginationControls on shadcn Pagination"
```

---

### Task 1.12: Add Table primitive (no consumer migration yet)

**Files:**
- Add via CLI: `src/components/ui/table.tsx`

**Step 1: Generate**

```bash
npx shadcn@latest add table
```

**Step 2: Verify, commit**

```bash
npm run lint && npm run test:unit
git add src/components/ui/table.tsx
git commit -m "feat(ui): add shadcn Table primitive"
```

---

### Task 1.13: Build DataTable on tanstack + retire SortableTable

**Files:**
- Install: `@tanstack/react-table`
- Create: `src/components/ui/data-table.tsx`
- Modify: every consumer of `SortableTable` (sweep)
- Delete: `src/components/ui/sortable-table.tsx`

**Step 1: Install dep**

```bash
npm install @tanstack/react-table
```

**Step 2: Create `src/components/ui/data-table.tsx`**

```tsx
"use client";

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowKey?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  rowClassName?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  rowKey,
  onRowClick,
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: rowKey,
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    className={sortable ? "cursor-pointer select-none" : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {sortable ? (
                      <span className="ml-1 inline-flex">
                        {sortDir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sortDir === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-50" />
                        )}
                      </span>
                    ) : null}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={[onRowClick ? "cursor-pointer" : "", rowClassName ?? ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-muted-foreground text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 3: Migrate consumers — convert old `Column<T>` defs to tanstack `ColumnDef<T>`**

Pattern transformation, one file at a time. Old:

```ts
{
  key: "name",
  label: "Name",
  sortValue: (u) => u.name.toLowerCase(),
  render: (u) => u.name,
}
```

New:

```ts
{
  id: "name",
  accessorFn: (u) => u.name.toLowerCase(),
  header: "Name",
  cell: ({ row }) => row.original.name,
  enableSorting: true,
}
```

For non-sortable columns: `enableSorting: false` (default behavior in tanstack mirrors old `sortValue` absence).

For class-based header/cell hiding (e.g. `hidden sm:table-cell`): tanstack supports `meta.headerClassName` / `meta.cellClassName` accessed in DataTable. Add this to the DataTable to preserve old behavior:

```ts
// in DataTable.tsx, in the header render:
<TableHead
  ...
  className={cn(
    header.column.columnDef.meta?.headerClassName,
    sortable ? "cursor-pointer select-none" : undefined,
  )}
>
// ...and in TableCell:
<TableCell className={cell.column.columnDef.meta?.cellClassName}>
```

Augment the `ColumnMeta` type to include these:

```ts
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}
```

**Step 4: Update each consumer file**

Files (from earlier grep):
- `src/components/admin/users-table.tsx`
- `src/components/admin/admin-reimbursements-table.tsx`
- `src/components/admin/team-requests-table.tsx`
- `src/components/admin/team-members-table.tsx`
- `src/components/coach/coach-team-requests-table.tsx`
- `src/components/coach/coach-team-members-table.tsx`
- `src/components/reimbursements/team-reimbursements-table.tsx`

For each, change `import { type Column, SortableTable } from "@/components/ui/sortable-table"` to `import { type ColumnDef, DataTable } from "@/components/ui/data-table"` (note `ColumnDef` re-export from data-table for consumer convenience; or import directly from `@tanstack/react-table`).

**Step 5: Delete `sortable-table.tsx`**

```bash
git rm src/components/ui/sortable-table.tsx
```

**Step 6: Verify**

```bash
npm run lint && npm run test:unit && npm run test:integration
```

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor(ui): replace SortableTable with shadcn DataTable on @tanstack/react-table"
```

---

### Task 1.14: Add remaining shadcn primitives in one batch (no consumers yet)

**Files:**
- Add via CLI: `popover`, `scroll-area`, `sheet`, `dropdown-menu`, `navigation-menu`, `dialog`, `alert-dialog`, `collapsible`, `tooltip`, `switch`, `checkbox`, `separator`

**Step 1: Generate**

```bash
npx shadcn@latest add popover scroll-area sheet dropdown-menu navigation-menu dialog alert-dialog collapsible tooltip switch checkbox separator
```

Expected: 12 new files in `src/components/ui/`, several Radix packages installed.

**Step 2: Verify build still works**

```bash
npm run build
```

**Step 3: Lint + unit**

```bash
npm run lint && npm run test:unit
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add shadcn Popover, Sheet, Dropdown, Dialog, Collapsible, Switch, Checkbox, etc."
```

---

### Task 1.15: Rebuild PageHeader and EmptyState compositions

**Files:**
- Modify: `src/components/ui/page-header.tsx`
- Modify: `src/components/ui/empty-state.tsx`

**Step 1: Rewrite PageHeader**

Edit `src/components/ui/page-header.tsx`:

```tsx
import { type ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, description, badge, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-foreground text-xl font-bold sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
```

(Theme tokens replace `text-slate-900` / `text-slate-500`.)

**Step 2: Rewrite EmptyState**

Edit `src/components/ui/empty-state.tsx`:

```tsx
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <Inbox className="text-muted-foreground size-6" />
      </div>
      <h3 className="text-foreground text-sm font-medium">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      ) : null}
    </div>
  );
}
```

**Step 3: Verify, commit**

```bash
npm run lint && npm run test:unit
git add src/components/ui/page-header.tsx src/components/ui/empty-state.tsx
git commit -m "refactor(ui): rebuild PageHeader and EmptyState on theme tokens + lucide"
```

---

### Task 1.16: Rebuild StatusTimeline composition

**Files:**
- Modify: `src/components/ui/status-timeline.tsx`

**Step 1: Rewrite**

```tsx
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";

type TimelineEntry = {
  id: string;
  action: string;
  actor: string;
  comment?: string | null;
  createdAt: Date;
};

export function StatusTimeline({ items }: { items: TimelineEntry[] }) {
  if (items.length === 0) return null;

  return (
    <ol className="relative space-y-6 ps-6">
      {items.map((item, idx) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden
            className="bg-muted-foreground/20 absolute -left-3 top-1.5 size-2 rounded-full ring-4 ring-background"
          />
          {idx < items.length - 1 ? (
            <Separator
              orientation="vertical"
              className="absolute left-[-7px] top-4 h-full"
            />
          ) : null}
          <div className="flex items-center gap-2">
            <StatusBadge status={item.action} />
            <span className="text-muted-foreground text-sm">by {item.actor}</span>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {item.createdAt.toLocaleString()}
          </p>
          {item.comment ? (
            <p className="bg-muted text-muted-foreground mt-1 rounded-md px-3 py-2 text-sm">
              {item.comment}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
```

**Step 2: Verify, commit**

```bash
npm run lint && npm run test:unit
git add src/components/ui/status-timeline.tsx
git commit -m "refactor(ui): rebuild StatusTimeline on Separator + StatusBadge"
```

---

## PHASE 2 — Domain components

Each Phase 2 task: rebuild the component(s) using the new primitives, update consumers as needed, lint + unit + (where appropriate) integration tests, commit. E2E runs at end of phase.

### Task 2.1: Rebuild auth components on rhf + zod

**Files:**
- Modify: `src/components/auth/sign-in-form.tsx`
- Modify: `src/components/auth/sign-up-form.tsx`
- Modify: `src/components/auth/sign-out-button.tsx`

**Step 1: Inspect server-side schema**

Read `src/app/api/auth/register/route.ts` to discover the existing zod schema. Mirror it client-side.

**Step 2: Rebuild `sign-in-form.tsx`**

Use `useForm` + `zodResolver` + `<Form>` + `<FormField>`. On submit: existing `signIn(...)` call. On error: `toast.error("Invalid email or password")` plus optionally `setError("password", ...)`. Drop the `<Alert>`-as-state pattern.

Markup skeleton:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInValues) {
    const result = await signIn("credentials", {
      ...values,
      redirect: false,
      callbackUrl: "/",
    });
    if (!result || result.error) {
      toast.error("Invalid email or password");
      return;
    }
    window.location.href = result.url ?? "/";
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
```

**Step 3: Rebuild `sign-up-form.tsx` similarly**

Schema:

```ts
const signUpSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[0-9]/, "Must include a number"),
  policyAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the policy" }),
  }),
});
```

Use `<Checkbox>` for the policy acceptance. Toast on error, redirect on success (preserve current `signIn` flow).

**Step 4: Rebuild `sign-out-button.tsx`**

```tsx
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        void signOut({ callbackUrl: "/" });
      }}
    >
      Sign out
    </Button>
  );
}
```

(Visually the same — already uses the primitive.)

**Step 5: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/auth.test.ts
```

**Step 6: Commit**

```bash
git add src/components/auth/
git commit -m "refactor(auth): rebuild sign-in/sign-up forms on rhf + zod + sonner"
```

---

### Task 2.2: Rebuild onboarding components — UPDATES E2E

**Files:**
- Modify: `src/components/onboarding/team-selector.tsx`
- Modify: `src/components/onboarding/team-registration-form.tsx`
- Modify: `src/components/onboarding/team-request-decision.tsx`

**Step 1: Rebuild `team-selector.tsx`**

Use rhf + zod for the cascading selector. Since shadcn `<Select>` uses `onValueChange`, use `form.watch` to drive cascading clears.

Schema:

```ts
const onboardingSchema = z.object({
  districtId: z.string().min(1),
  schoolId: z.string().min(1),
  programId: z.string().min(1),
  teamId: z.string().min(1),
  roleIntent: z.enum(["PARENT_MENTOR", "COACH"]),
});
```

Each `<Select>` wraps in `<FormField>` + `<SelectTrigger id="…" aria-label="…">` so e2e can find it.

The `id="roleIntent"` previously on the native select must move to `<SelectTrigger id="roleIntent" aria-label="Role">`.

Submit calls existing `/api/onboarding/complete`. Sonner success toast on 200, then `window.location.href = "/"` (preserve current behavior).

**Step 2: Rebuild `team-registration-form.tsx`**

rhf + zod for team name, short code, notes. Mirror server schema.

**Step 3: Rebuild `team-request-decision.tsx`**

Two `<Button>` (default + destructive) with `<Textarea>` for comment. No rhf — it's two buttons with one shared comment field. Sonner toast on result.

**Step 4: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/onboarding.test.ts tests/integration/team-request-decision.test.ts tests/integration/teams.test.ts
npm run test:e2e -- tests/e2e/sign-up-onboarding.spec.ts
```

**Step 5: Commit**

```bash
git add src/components/onboarding/
git commit -m "refactor(onboarding): rebuild team selector, registration, and decision on rhf + shadcn Select"
```

---

### Task 2.3: Rebuild profile form

**Files:**
- Modify: `src/components/profile/profile-form.tsx`

**Step 1: Read the current implementation** to enumerate fields (mailing address, Zelle method, etc.).

**Step 2: Build the zod schema** mirroring the server contract in `src/app/api/me/profile/route.ts`.

**Step 3: Rewrite as `<Form>` + `<FormField>`** with `<Input>`, `<Textarea>`, `<Select>` as needed. Sonner toast on save.

**Step 4: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/profile.test.ts
```

**Step 5: Commit**

```bash
git add src/components/profile/profile-form.tsx
git commit -m "refactor(profile): rebuild profile form on rhf + zod + sonner"
```

---

### Task 2.4: Rebuild navbar, mobile nav, and notification bell

**Files:**
- Modify: `src/components/ui/navbar.tsx`
- Modify: `src/components/ui/mobile-nav-menu.tsx`
- Modify: `src/components/ui/notification-bell.tsx`

**Step 1: Rebuild `navbar.tsx`**

Replace inline links with `<NavigationMenu>` + `<NavigationMenuList>` + `<NavigationMenuItem>`. The Novi logo `<Image>` stays. User email + sign-out button move into a `<DropdownMenu>` triggered by an avatar (or just a Button with the email — pick the simpler avatar-less variant to minimize visual change).

Skeleton:

```tsx
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { getCachedAccessContext } from "@/lib/access";
import { getNavigationLinks } from "@/lib/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/ui/notification-bell";
import { MobileNavMenu } from "@/components/ui/mobile-nav-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export async function NavBar() {
  const session = await auth();
  const access = session?.user
    ? await getCachedAccessContext(session.user.id)
    : null;
  const links = access ? getNavigationLinks(access) : [];

  return (
    <nav className="bg-background sticky top-0 z-50 border-b shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <Image
            src="/novi-logo.png"
            alt="Novi Community School District"
            width={131}
            height={40}
            className="h-10 w-auto"
          />
        </Link>

        {session?.user ? (
          <>
            <NavigationMenu className="hidden sm:flex">
              <NavigationMenuList>
                {links.map((link) => (
                  <NavigationMenuItem key={link.href}>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href={link.href} prefetch={link.prefetch}>
                        {link.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
            <div className="hidden sm:flex items-center gap-3">
              <NotificationBell />
              <span className="text-muted-foreground hidden text-sm md:inline">
                {session.user.email}
              </span>
              <SignOutButton />
            </div>
            <MobileNavMenu links={links} userEmail={session.user.email!} />
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-muted-foreground hover:text-primary text-sm font-medium transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
```

**Step 2: Rebuild `mobile-nav-menu.tsx`** with shadcn `<Sheet>` triggered by lucide `<Menu>` icon button. Sheet content shows `<NavigationMenu>` vertical + email + sign-out. Closes on link click via `Sheet`'s `onOpenChange`.

Skeleton:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/ui/notification-bell";

type Link = { href: string; label: string; prefetch?: boolean };

export function MobileNavMenu({ links, userEmail }: { links: Link[]; userEmail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-4 pb-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.prefetch}
              onClick={() => setOpen(false)}
              className="hover:bg-accent rounded-md px-3 py-2 text-sm font-medium transition"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Separator />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-muted-foreground text-sm truncate mr-3">{userEmail}</span>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <SignOutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 3: Rebuild `notification-bell.tsx`**

Replace manual click-outside + open state with `<Popover>`. Replace inline SVG with lucide `<Bell>`. Use `<ScrollArea>` for the list. Polling `useEffect` stays exactly as-is (open-state still drives polling).

Skeleton:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ... preserve existing types and helpers verbatim ...

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // ... existing polling effect, unchanged ...
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              No notifications yet
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "hover:bg-accent w-full border-b px-4 py-3 text-left transition",
                  n.read && "opacity-60"
                )}
              >
                {/* ... preserve existing markup with theme tokens ... */}
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 4: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/notification-api.test.ts
npm run test:e2e
```

**Step 5: Commit**

```bash
git add src/components/ui/navbar.tsx src/components/ui/mobile-nav-menu.tsx src/components/ui/notification-bell.tsx
git commit -m "refactor(navigation): rebuild NavBar, MobileNavMenu, NotificationBell on shadcn primitives"
```

---

### Task 2.5: Rebuild admin tables on DataTable

**Files:**
- Modify: `src/components/admin/users-table.tsx`
- Modify: `src/components/admin/admin-reimbursements-table.tsx`
- Modify: `src/components/admin/team-requests-table.tsx`
- Modify: `src/components/admin/team-members-table.tsx`

**Step 1:** For each file, replace `SortableTable` import with `DataTable`. Convert each `Column<T>[]` array to `ColumnDef<T>[]` per the pattern from Task 1.13. Replace inline native `<select>` filter elements with shadcn `<Select>`. Replace inline `<Input>` if it was the old custom input — already shadcn now.

**Step 2: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration
```

**Step 3: Commit**

```bash
git add src/components/admin/
git commit -m "refactor(admin): rebuild tables on DataTable + shadcn Select filters"
```

---

### Task 2.6: Rebuild admin forms in Dialogs

**Files:**
- Modify: `src/components/admin/create-team-form.tsx`
- Modify: `src/components/admin/edit-team-form.tsx`

**Step 1:** Wrap each form in `<Dialog>` + `<DialogTrigger asChild><Button>...</Button></DialogTrigger>` + `<DialogContent>`. The form body uses `<Form>` + `<FormField>` (rhf + zod). Schemas mirror server contracts in `src/app/api/admin/teams/route.ts` and `src/app/api/admin/teams/[teamId]/route.ts`.

**Step 2: Update consumers** — pages that render `<EditTeamForm />` or `<CreateTeamForm />` may have rendered them inline or as buttons. Check `src/app/(app)/admin/teams/page.tsx` and `[teamId]/page.tsx` to confirm the call sites work with the new Dialog-wrapped components.

**Step 3: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/teams.test.ts
npm run test:e2e -- tests/e2e/admin-flow.spec.ts
```

**Step 4: Commit**

```bash
git add src/components/admin/create-team-form.tsx src/components/admin/edit-team-form.tsx src/app/\(app\)/admin/teams/
git commit -m "refactor(admin): wrap create/edit team forms in shadcn Dialog with rhf + zod"
```

---

### Task 2.7: Rebuild admin action components

**Files:**
- Modify: `src/components/admin/team-active-toggle.tsx`
- Modify: `src/components/admin/remove-member-button.tsx`
- Modify: `src/components/admin/user-role-select.tsx`
- Modify: `src/components/admin/user-scope-manager.tsx`

**Step 1: `team-active-toggle.tsx`** — replace toggle button with shadcn `<Switch>`. `onCheckedChange` calls existing PATCH endpoint. Sonner toast on success/error. Preserve current label "Active" / "Inactive" rendered next to the switch.

**Step 2: `remove-member-button.tsx`** — wrap in `<AlertDialog>` with destructive confirm. `<AlertDialogAction>` calls the existing DELETE endpoint.

**Step 3: `user-role-select.tsx`** — convert to shadcn `<Select>`. Disabled state when changing self stays.

**Step 4: `user-scope-manager.tsx`** — convert the inline native `<select>` to shadcn `<Select>`. Wrap the "Remove" buttons in `<AlertDialog>` for destructive confirm.

**Step 5: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/admin-users.test.ts tests/integration/teams.test.ts
```

**Step 6: Commit**

```bash
git add src/components/admin/
git commit -m "refactor(admin): rebuild action components (Switch, AlertDialog, Select)"
```

---

### Task 2.8: Rebuild coach tables on DataTable

**Files:**
- Modify: `src/components/coach/coach-team-requests-table.tsx`
- Modify: `src/components/coach/coach-team-members-table.tsx`

**Step 1:** Convert per pattern from Task 1.13.

**Step 2: Verify**

```bash
npm run lint && npm run test:unit
```

**Step 3: Commit**

```bash
git add src/components/coach/
git commit -m "refactor(coach): rebuild tables on DataTable"
```

---

### Task 2.9: Rebuild reimbursement basic forms and actions

**Files:**
- Modify: `src/components/reimbursements/request-form.tsx`
- Modify: `src/components/reimbursements/editable-request-header.tsx`
- Modify: `src/components/reimbursements/request-actions.tsx`
- Modify: `src/components/reimbursements/approval-decision.tsx`
- Modify: `src/components/reimbursements/download-pdf-link.tsx`
- Modify: `src/components/reimbursements/request-timeline.tsx`

**Step 1:** `request-form.tsx` → rhf + zod (`title`, `description`, `teamId`). Sonner toast on draft creation success.

**Step 2:** `editable-request-header.tsx` → keep debounced inline-edit pattern, but use shadcn `<Input>` and theme tokens.

**Step 3:** `request-actions.tsx` → wrap destructive actions in `<AlertDialog>` ("Reopen this request?"). Submit/Approve buttons stay as plain `<Button>`. Sonner toast on result.

**Step 4:** `approval-decision.tsx` → shadcn `<Textarea>` + two `<Button>` (default + destructive). Sonner toast on submit.

**Step 5:** `download-pdf-link.tsx` → shadcn `<Button asChild variant="ghost" size="icon">` wrapping `<a href=…>` with `<Download />` lucide icon.

**Step 6:** `request-timeline.tsx` → import + render rebuilt `<StatusTimeline>`. No code change.

**Step 7: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/requests-crud.test.ts tests/integration/submit.test.ts tests/integration/coach-decision.test.ts tests/integration/admin-decision.test.ts
```

**Step 8: Commit**

```bash
git add src/components/reimbursements/
git commit -m "refactor(reimbursements): rebuild forms and action components on shadcn primitives"
```

---

### Task 2.10: Rebuild reimbursement complex components

**Files:**
- Modify: `src/components/reimbursements/receipt-uploader.tsx`
- Modify: `src/components/reimbursements/extraction-review.tsx`
- Modify: `src/components/reimbursements/editable-line-items.tsx`
- Modify: `src/components/reimbursements/line-item-comments.tsx`
- Modify: `src/components/reimbursements/collapsible-request-card.tsx`
- Modify: `src/components/reimbursements/live-total-context.tsx` (no UI change; verify imports)
- Modify: `src/components/reimbursements/receipt-polling-wrapper.tsx` (no UI change)

**Step 1:** `receipt-uploader.tsx` — keep drag/drop logic. Replace inline SVG with lucide (`Upload`, `File`, `Check`, `X`, `AlertCircle`). Replace inline `<Alert>` with `toast.error(...)` for failed uploads. Drop zone uses theme tokens (`border-border hover:border-primary hover:bg-primary/5`).

**Step 2:** `extraction-review.tsx` — wrap in shadcn `<Card>`, table uses shadcn `<Table>` (read-only, no DataTable). Comment expansion uses shadcn `<Collapsible>`. lucide `<MessageCircle>` for comment icon.

**Step 3:** `editable-line-items.tsx` — DO NOT introduce rhf. Keep controlled-input + debounced PATCH model verbatim. Swap markup:
- `<Card>` → shadcn `<Card>`
- `<button>` → shadcn `<Button>` for action buttons
- `<input>` cells → shadcn `<Input>` (use `className="h-8"` for compact rows)
- `<table>` → shadcn `<Table>`
- Inline SVG → lucide (`Plus`, `Trash2`, `MessageCircle`)
- Comment popover for new comment → shadcn `<Popover>` containing `<Textarea>` + `<Button>`

**Step 4:** `line-item-comments.tsx` — `CommentIcon` becomes a `<Button variant="ghost" size="icon">` wrapping lucide `<MessageCircle>` plus a count badge. Comment compose form moves into a `<Popover>`.

**Step 5:** `collapsible-request-card.tsx` — wrap in shadcn `<Card>` + `<Collapsible>`. Replace inline SVGs with lucide (`ChevronRight`, `ChevronDown`, `Download`, `ExternalLink`, `Trash2`, `RotateCcw`). Inline delete-confirm strip rebuilt with shadcn `<Button variant="destructive" size="sm">` + ghost cancel button — kept inline per design.

**Step 6: Verify**

```bash
npm run lint && npm run test:unit
npm run test:integration -- tests/integration/line-items.test.ts tests/integration/line-item-comments.test.ts tests/integration/receipts.test.ts tests/integration/parse.test.ts
```

**Step 7: Commit**

```bash
git add src/components/reimbursements/
git commit -m "refactor(reimbursements): rebuild receipt uploader, extraction review, editable line items, comments, and collapsible card on shadcn primitives + lucide"
```

---

### Phase 2 closing — full e2e

**Step 1: Run full e2e**

```bash
npm run test:e2e
```

If failures: stash uncommitted, debug each in turn, commit fixes individually with `fix(test): ...` messages.

---

## PHASE 3 — Pages and loaders

### Task 3.1: Rebuild auth pages

**Files:**
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Modify: `src/app/(auth)/sign-up/page.tsx`
- Modify: `src/app/(auth)/admin-sign-up/page.tsx`
- Modify: `src/app/(auth)/layout.tsx`

**Step 1:** Layout uses `bg-background` instead of `bg-slate-50`. Pages use shadcn `<Card>` (already do via the migrated primitive). Heading text-color uses `text-primary` instead of `text-emerald-600`.

**Step 2: Verify**

```bash
npm run lint && npm run test:unit
```

**Step 3: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "refactor(auth pages): use theme tokens and rebuilt forms"
```

---

### Task 3.2: Rebuild app shell and dashboard

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(app)/page.tsx` (dashboard)
- Modify: `src/app/(app)/loading.tsx`
- Modify: `src/app/unauthorized.tsx`, `error.tsx`, `forbidden.tsx`, `global-error.tsx`, `not-found.tsx`

**Step 1:** Layout uses theme-token utility names. Dashboard cards use shadcn `<Card>` + lucide icons (`Building2`, `LayoutDashboard`, `ClipboardList`, `Users`, `UserCog`).

**Step 2:** Loading uses `<PageSkeleton>` (already updated in Task 1.10).

**Step 3:** Error/forbidden/not-found pages: shadcn `<Card>` + lucide icon + `<Button>` for "Go home" link.

**Step 4: Verify**

```bash
npm run lint && npm run test:unit
```

**Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/app/\(app\)/page.tsx src/app/\(app\)/loading.tsx src/app/unauthorized.tsx src/app/error.tsx src/app/forbidden.tsx src/app/global-error.tsx src/app/not-found.tsx
git commit -m "refactor(pages): rebuild app shell, dashboard, error pages on shadcn"
```

---

### Task 3.3: Rebuild admin pages

**Files:**
- Modify: `src/app/(app)/admin/inbox/page.tsx`, `loading.tsx`
- Modify: `src/app/(app)/admin/requests/page.tsx`, `[requestId]/page.tsx`
- Modify: `src/app/(app)/admin/team-requests/page.tsx`, `loading.tsx`
- Modify: `src/app/(app)/admin/teams/page.tsx`, `[teamId]/page.tsx`, `loading.tsx`, `[teamId]/loading.tsx`
- Modify: `src/app/(app)/admin/users/page.tsx`

**Step 1:** Each page composes `<PageHeader>` + rebuilt domain components. Sweep hardcoded `text-slate-*` / `bg-slate-*` to theme tokens (`text-muted-foreground`, `bg-card`, `text-foreground`).

**Step 2: Verify**

```bash
npm run lint && npm run test:unit
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/admin/
git commit -m "refactor(admin pages): use theme tokens and rebuilt domain components"
```

---

### Task 3.4: Rebuild coach pages

**Files:**
- Modify: `src/app/(app)/coach/inbox/page.tsx`, `loading.tsx`
- Modify: `src/app/(app)/coach/team-overview/page.tsx`
- Modify: `src/app/(app)/coach/team-reimbursements/page.tsx`

**Step 1:** Same treatment as admin pages.

**Step 2: Verify, commit**

```bash
npm run lint && npm run test:unit
git add src/app/\(app\)/coach/
git commit -m "refactor(coach pages): use theme tokens and rebuilt domain components"
```

---

### Task 3.5: Rebuild user / onboarding / policy / team / profile pages

**Files:**
- Modify: `src/app/(app)/user/requests/page.tsx`, `[requestId]/page.tsx`, `new/page.tsx`, `loading.tsx`
- Modify: `src/app/(app)/onboarding/page.tsx`
- Modify: `src/app/(app)/policy/page.tsx`
- Modify: `src/app/(app)/team/page.tsx`
- Modify: `src/app/(app)/profile/page.tsx`

**Step 1:** Compose using rebuilt primitives + domain components. Swap hardcoded `slate-*` / `emerald-*` to theme tokens. Policy page uses headings + `<Separator>` for sections.

**Step 2: Verify, commit**

```bash
npm run lint && npm run test:unit
git add src/app/\(app\)/
git commit -m "refactor(user/onboarding/policy/team/profile pages): use theme tokens and rebuilt components"
```

---

## PHASE 4 — Cleanup and full verification

### Task 4.1: Audit residual old icons and hardcoded color classes

**Step 1: Find remaining inline SVGs in pages**

```bash
rg "<svg" src/app src/components --type-add 'tsx:*.tsx' -t tsx
```

For each hit not inside a shadcn-generated file, replace with the appropriate lucide icon.

**Step 2: Find hardcoded `bg-slate-*`, `text-slate-*`, `bg-emerald-*`, `text-emerald-*` in pages**

```bash
rg "(bg|text|border|ring)-(slate|emerald)-\d+" src/app src/components --type-add 'tsx:*.tsx' -t tsx
```

For each hit, decide:
- Inside the `StatusBadge` `colorOverride` map → keep (intentional preservation).
- Anywhere else → swap to theme tokens (`bg-muted`, `text-muted-foreground`, `bg-primary`, `text-primary`, `border-border`, etc.).

**Step 3: Verify**

```bash
npm run lint && npm run test:unit
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore(ui): replace residual inline SVGs and hardcoded color classes"
```

---

### Task 4.2: Verify `src/components/ui/` end state

**Step 1: List the folder**

```bash
ls src/components/ui/
```

Expected files (exact list):
- `alert.tsx` (shadcn)
- `badge.tsx` (shadcn)
- `button.tsx` (shadcn + loading)
- `card.tsx` (shadcn)
- `card-skeleton.tsx` (composition)
- `checkbox.tsx` (shadcn)
- `collapsible.tsx` (shadcn)
- `data-table.tsx` (composition)
- `dialog.tsx` (shadcn)
- `alert-dialog.tsx` (shadcn)
- `dropdown-menu.tsx` (shadcn)
- `empty-state.tsx` (composition)
- `field-group.tsx` (composition)
- `form.tsx` (shadcn)
- `input.tsx` (shadcn)
- `label.tsx` (shadcn)
- `mobile-nav-menu.tsx` (composition)
- `navbar.tsx` (composition)
- `navigation-menu.tsx` (shadcn)
- `notification-bell.tsx` (composition)
- `page-header.tsx` (composition)
- `pagination.tsx` (shadcn)
- `pagination-controls.tsx` (composition)
- `popover.tsx` (shadcn)
- `scroll-area.tsx` (shadcn)
- `select.tsx` (shadcn)
- `separator.tsx` (shadcn)
- `sheet.tsx` (shadcn)
- `skeleton.tsx` (shadcn)
- `sonner.tsx` (shadcn)
- `status-badge.tsx` (composition)
- `status-timeline.tsx` (composition)
- `switch.tsx` (shadcn)
- `table.tsx` (shadcn)
- `textarea.tsx` (shadcn)
- `tooltip.tsx` (shadcn)

If anything else is present (`form-field.tsx`, `select.tsx` old, `sortable-table.tsx`, etc.), delete it.

**Step 2: Verify nothing imports from deleted files**

```bash
rg "from \"@/components/ui/(form-field|sortable-table)\"" src
```

Expected: zero hits.

**Step 3: Commit any cleanup**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore(ui): final cleanup of components/ui directory"
```

---

### Task 4.3: Full test suite

**Step 1: Lint**

```bash
npm run lint
```

**Step 2: Unit + integration**

```bash
npm test
```

**Step 3: E2E**

```bash
npm run test:e2e
```

If any failure: triage individually. Common likely failures:
- An e2e selector still using `selectOption(` somewhere — convert to combobox pattern.
- A test asserting on `text-emerald-*` color classes — update to look for theme classes or accessible text.
- A test asserting on the old `<Alert>` text after a fetch — that text now goes to sonner. Tests should look for the sonner toast instead: `await expect(page.getByText("Onboarding complete...")).toBeVisible()` works if sonner shows the same string.

**Step 4: Build**

```bash
npm run build
```

**Step 5: If everything passes, commit any final fixes**

```bash
git add -A
git diff --cached --quiet || git commit -m "fix(tests): finalize selectors after shadcn migration"
```

---

### Task 4.4: Manual smoke

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: For each seeded user, sign in and exercise their primary flows:**

| User | Steps |
|---|---|
| `admin@school.org` / `Admin1234` | Dashboard renders. NavBar shows admin links + dropdown user menu. Open Manage Users, Manage Teams, Admin Inbox, Reimbursements, Team Registrations. Open a team detail. Try Active toggle (Switch). Try removing a member (AlertDialog). |
| `schooladmin@school.org` / `SchoolAdmin1234` | Same admin surfaces, scoped. |
| `programadmin@school.org` / `ProgramAdmin1234` | Admin Inbox + Reimbursements + Manage Teams + Team Registrations. |
| `coach@team.org` / `Coach1234` | Team Overview, Team Reimbursements. Open a submitted request, approve / reject. |
| `user@team.org` / `User1234` | Onboarding (already complete in seed), New Request, upload a receipt, edit a line item, submit. Notification bell shows. Profile page edits. |

For each step, watch for: layout regression, missing copy, broken interactions, console errors.

**Step 3: If any issues, file as TODO comments in the relevant component and fix in a follow-up commit. Do not skip.**

**Step 4: Final commit if any fixes**

```bash
git add -A
git diff --cached --quiet || git commit -m "fix(ui): manual smoke pass adjustments"
```

---

## Done

End state:
- `src/components/ui/` contains only shadcn-generated primitives + named compositions (per Task 4.2).
- All forms use react-hook-form + zod and shadcn `<Form>`.
- All list tables use `@tanstack/react-table` + shadcn DataTable.
- Toasts go through sonner; persistent banners go through `<Alert>`.
- Theme tokens drive the color palette; `slate-*` / `emerald-*` are gone except inside `StatusBadge`'s intentional overrides.
- Lint, unit, integration, and e2e suites all pass.
- All seeded user flows verified manually.

No application functionality changed.
