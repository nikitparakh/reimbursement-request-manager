# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul all 9 pages of the VelTest robotics tournament expense app from bare HTML to a polished, consistent Tailwind CSS design with shared UI components and a role-adaptive navigation bar.

**Architecture:** Install Tailwind CSS, build a library of reusable UI components in `src/components/ui/`, restructure the root layout with route groups to support NavBar on app pages and a minimal layout on auth pages, then restyle every page using the new components. No functional/business logic changes — only markup and styling.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS 4, React 19, TypeScript

---

## Task 1: Install and Configure Tailwind CSS

**Files:**
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `tsconfig.json` (no changes needed, paths already configured)

**Step 1: Install Tailwind CSS v4**

Run:
```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

**Step 2: Create PostCSS config**

Create `postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

**Step 3: Replace globals.css with Tailwind directives**

Replace the entire contents of `src/app/globals.css` with:
```css
@import "tailwindcss";
```

**Step 4: Verify Tailwind works**

Run:
```bash
npm run build
```
Expected: Build succeeds. Pages will lose all styling (expected — we'll add Tailwind classes next).

**Step 5: Commit**

```bash
git add package.json package-lock.json postcss.config.mjs src/app/globals.css
git commit -m "chore: install Tailwind CSS v4 and replace globals.css"
```

---

## Task 2: Build Button Component

**Files:**
- Create: `src/components/ui/button.tsx`

**Step 1: Create the Button component**

Create `src/components/ui/button.tsx`:
```tsx
import { type ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-indigo-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:ring-indigo-500",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium rounded-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
```

**Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: add Button UI component with variants"
```

---

## Task 3: Build Card Component

**Files:**
- Create: `src/components/ui/card.tsx`

**Step 1: Create the Card component**

Create `src/components/ui/card.tsx`:
```tsx
import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return (
    <div className={`px-6 py-4 border-b border-slate-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: CardProps) {
  return (
    <div className={`px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-lg ${className}`}>
      {children}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat: add Card UI component with header/content/footer"
```

---

## Task 4: Build Badge Component

**Files:**
- Create: `src/components/ui/badge.tsx`

**Step 1: Create the Badge component**

Create `src/components/ui/badge.tsx`:
```tsx
const colorMap: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-amber-100 text-amber-800",
  MANAGER_APPROVED: "bg-emerald-100 text-emerald-800",
  MANAGER_REJECTED: "bg-red-100 text-red-800",
  ADMIN_APPROVED: "bg-emerald-100 text-emerald-800",
  ADMIN_REJECTED: "bg-red-100 text-red-800",
  PAID: "bg-indigo-100 text-indigo-800",
  QUEUED: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-red-100 text-red-800",
  REOPEN: "bg-amber-100 text-amber-800",
  MARK_PAID: "bg-indigo-100 text-indigo-800",
};

type BadgeProps = {
  status: string;
  className?: string;
};

export function Badge({ status, className = "" }: BadgeProps) {
  const colors = colorMap[status] ?? "bg-slate-100 text-slate-700";
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors} ${className}`}
    >
      {label}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: add Badge UI component with status color mapping"
```

---

## Task 5: Build Form Field Components (Input, Textarea, Select, FormField)

**Files:**
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/form-field.tsx`

**Step 1: Create Input component**

Create `src/components/ui/input.tsx`:
```tsx
import { type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export function Input({ error, className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-md border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
        error ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-slate-300"
      } ${className}`}
      {...props}
    />
  );
}
```

**Step 2: Create Textarea component**

Create `src/components/ui/textarea.tsx`:
```tsx
import { type TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

export function Textarea({ error, className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full rounded-md border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
        error ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-slate-300"
      } ${className}`}
      {...props}
    />
  );
}
```

**Step 3: Create Select component**

Create `src/components/ui/select.tsx`:
```tsx
import { type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
```

**Step 4: Create FormField component**

Create `src/components/ui/form-field.tsx`:
```tsx
import { type ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  helpText?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, helpText, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {helpText && !error ? (
        <p className="text-xs text-slate-500">{helpText}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
```

**Step 5: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 6: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx src/components/ui/form-field.tsx
git commit -m "feat: add form field UI components (Input, Textarea, Select, FormField)"
```

---

## Task 6: Build Alert, PageHeader, and EmptyState Components

**Files:**
- Create: `src/components/ui/alert.tsx`
- Create: `src/components/ui/page-header.tsx`
- Create: `src/components/ui/empty-state.tsx`

**Step 1: Create Alert component**

Create `src/components/ui/alert.tsx`:
```tsx
import { type ReactNode } from "react";

const alertVariants = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  error: "bg-red-50 text-red-800 border-red-200",
  info: "bg-indigo-50 text-indigo-800 border-indigo-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
} as const;

type AlertProps = {
  variant: keyof typeof alertVariants;
  children: ReactNode;
  className?: string;
};

export function Alert({ variant, children, className = "" }: AlertProps) {
  return (
    <div className={`rounded-md border p-4 text-sm ${alertVariants[variant]} ${className}`}>
      {children}
    </div>
  );
}
```

**Step 2: Create PageHeader component**

Create `src/components/ui/page-header.tsx`:
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
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
```

**Step 3: Create EmptyState component**

Create `src/components/ui/empty-state.tsx`:
```tsx
type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/ui/alert.tsx src/components/ui/page-header.tsx src/components/ui/empty-state.tsx
git commit -m "feat: add Alert, PageHeader, and EmptyState UI components"
```

---

## Task 7: Build StatusTimeline Component

**Files:**
- Create: `src/components/ui/status-timeline.tsx`

**Step 1: Create the StatusTimeline component**

Create `src/components/ui/status-timeline.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";

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
    <div className="flow-root">
      <ul className="-mb-8">
        {items.map((item, idx) => (
          <li key={item.id}>
            <div className="relative pb-8">
              {idx < items.length - 1 ? (
                <span className="absolute left-3 top-6 -ml-px h-full w-0.5 bg-slate-200" />
              ) : null}
              <div className="relative flex items-start space-x-3">
                <div className="relative">
                  <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white ring-2 ring-slate-200 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge status={item.action} />
                    <span className="text-sm text-slate-500">by {item.actor}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.createdAt.toLocaleString()}
                  </p>
                  {item.comment ? (
                    <p className="mt-1 text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2">
                      {item.comment}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/status-timeline.tsx
git commit -m "feat: add StatusTimeline UI component"
```

---

## Task 8: Build NavBar Component

**Files:**
- Create: `src/components/ui/navbar.tsx`

**Step 1: Create the NavBar component**

The NavBar is a server component that reads the session and renders role-appropriate links.

Create `src/components/ui/navbar.tsx`:
```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

type NavLink = { href: string; label: string };

const studentLinks: NavLink[] = [
  { href: "/student/requests/new", label: "New Request" },
];

const managerLinks: NavLink[] = [
  { href: "/student/requests/new", label: "New Request" },
  { href: "/manager/inbox", label: "Manager Inbox" },
];

const adminLinks: NavLink[] = [
  { href: "/manager/inbox", label: "Manager Inbox" },
  { href: "/admin/inbox", label: "Admin Inbox" },
  { href: "/admin/team-requests", label: "Team Requests" },
];

function getLinksForRole(role: string): NavLink[] {
  switch (role) {
    case "ADMIN":
      return adminLinks;
    case "MANAGER":
      return managerLinks;
    default:
      return studentLinks;
  }
}

export async function NavBar() {
  const session = await auth();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-indigo-600 hover:text-indigo-700 transition">
          VelTest
        </Link>

        {session?.user ? (
          <>
            <div className="flex items-center gap-6">
              {getLinksForRole(session.user.role).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">{session.user.email}</span>
              <SignOutButton />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
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

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/ui/navbar.tsx
git commit -m "feat: add NavBar component with role-adaptive links"
```

---

## Task 9: Restructure Layouts with Route Groups

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/(app)/layout.tsx`
- Move: All app pages into `src/app/(app)/` route group
- Create: `src/app/(auth)/layout.tsx`
- Move: Sign-in and sign-up into `src/app/(auth)/` route group

This task restructures the app so that:
- `(app)` pages get the NavBar + main container
- `(auth)` pages get a minimal centered layout without NavBar

**Step 1: Create the (auth) route group layout**

Create `src/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      {children}
    </div>
  );
}
```

**Step 2: Move auth pages into (auth) group**

Run:
```bash
mkdir -p src/app/\(auth\)/sign-in
mkdir -p src/app/\(auth\)/sign-up
mv src/app/sign-in/page.tsx src/app/\(auth\)/sign-in/page.tsx
mv src/app/sign-up/page.tsx src/app/\(auth\)/sign-up/page.tsx
rmdir src/app/sign-in src/app/sign-up
```

**Step 3: Create the (app) route group layout**

Create `src/app/(app)/layout.tsx`:
```tsx
import { NavBar } from "@/components/ui/navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </>
  );
}
```

**Step 4: Move all app pages into (app) group**

Run:
```bash
mkdir -p src/app/\(app\)/onboarding
mkdir -p src/app/\(app\)/student/requests/new
mkdir -p src/app/\(app\)/student/requests/\[requestId\]
mkdir -p src/app/\(app\)/manager/inbox
mkdir -p src/app/\(app\)/admin/inbox
mkdir -p src/app/\(app\)/admin/team-requests

mv src/app/page.tsx src/app/\(app\)/page.tsx
mv src/app/onboarding/page.tsx src/app/\(app\)/onboarding/page.tsx
mv src/app/student/requests/new/page.tsx src/app/\(app\)/student/requests/new/page.tsx
mv src/app/student/requests/\[requestId\]/page.tsx src/app/\(app\)/student/requests/\[requestId\]/page.tsx
mv src/app/manager/inbox/page.tsx src/app/\(app\)/manager/inbox/page.tsx
mv src/app/admin/inbox/page.tsx src/app/\(app\)/admin/inbox/page.tsx
mv src/app/admin/team-requests/page.tsx src/app/\(app\)/admin/team-requests/page.tsx
```

Then clean up the now-empty old directories:
```bash
rmdir src/app/onboarding
rmdir src/app/student/requests/\[requestId\] src/app/student/requests/new src/app/student/requests src/app/student
rmdir src/app/manager/inbox src/app/manager
rmdir src/app/admin/inbox src/app/admin/team-requests src/app/admin
```

**Step 5: Update root layout**

Modify `src/app/layout.tsx` to be a minimal shell:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VelTest",
  description: "Robotics tournament reimbursement workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 6: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds. All routes still resolve correctly — route groups don't affect URLs.

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: restructure layouts with (auth) and (app) route groups, add NavBar"
```

---

## Task 10: Restyle SignOutButton Component

**Files:**
- Modify: `src/components/auth/sign-out-button.tsx`

**Step 1: Update SignOutButton to use Button component**

Replace `src/components/auth/sign-out-button.tsx` with:
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

**Step 2: Commit**

```bash
git add src/components/auth/sign-out-button.tsx
git commit -m "style: restyle SignOutButton with Button component"
```

---

## Task 11: Restyle Sign In Page

**Files:**
- Modify: `src/app/(auth)/sign-in/page.tsx`
- Modify: `src/components/auth/sign-in-form.tsx`

**Step 1: Update the Sign In page**

Replace `src/app/(auth)/sign-in/page.tsx` with:
```tsx
import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-indigo-600">VelTest</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to the reimbursement system</p>
      </div>
      <Card>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-indigo-600 hover:text-indigo-500">
          Create an account
        </Link>
      </p>
    </div>
  );
}
```

**Step 2: Update the SignInForm component**

Replace `src/components/auth/sign-in-form.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setError("Invalid email or password");
      return;
    }

    window.location.href = result.url ?? "/";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <FormField label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </FormField>

      <FormField label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
```

**Step 3: Verify build**

Run:
```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/\(auth\)/sign-in/page.tsx src/components/auth/sign-in-form.tsx
git commit -m "style: restyle Sign In page with Card, FormField, and Button"
```

---

## Task 12: Restyle Sign Up Page

**Files:**
- Modify: `src/app/(auth)/sign-up/page.tsx`
- Modify: `src/components/auth/sign-up-form.tsx`

**Step 1: Update the Sign Up page**

Replace `src/app/(auth)/sign-up/page.tsx` with:
```tsx
import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Card, CardContent } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-indigo-600">VelTest</h1>
        <p className="mt-2 text-sm text-slate-500">Create an account to submit reimbursements</p>
      </div>
      <Card>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

**Step 2: Update the SignUpForm component**

Replace `src/components/auth/sign-up-form.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
    } catch {
      setMessage("Network error while creating account.");
      setIsSubmitting(false);
      return;
    }

    if (!response.ok) {
      setMessage(await getErrorMessage(response));
      setIsSubmitting(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/onboarding",
    });

    setIsSubmitting(false);

    if (!signInResult || signInResult.error) {
      setMessage("Account created. Please sign in manually.");
      return;
    }

    window.location.href = signInResult.url ?? "/onboarding";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message ? <Alert variant="error">{message}</Alert> : null}

      <FormField label="Name" htmlFor="name">
        <Input
          id="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your full name"
        />
      </FormField>

      <FormField label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </FormField>

      <FormField
        label="Password"
        htmlFor="password"
        helpText="Must include at least one uppercase letter, one lowercase letter, and one number."
      >
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

async function getErrorMessage(response: Response) {
  const fallback = "Unable to create account";
  const bodyText = await response.text();
  if (!bodyText) return fallback;

  try {
    const payload = JSON.parse(bodyText) as {
      error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    };
    if (typeof payload.error === "string") return payload.error;
    if (payload.error?.formErrors?.[0]) return payload.error.formErrors[0];
    const firstFieldError = payload.error?.fieldErrors
      ? Object.values(payload.error.fieldErrors).flat().find(Boolean)
      : undefined;
    return firstFieldError ?? fallback;
  } catch {
    return fallback;
  }
}
```

**Step 3: Commit**

```bash
git add src/app/\(auth\)/sign-up/page.tsx src/components/auth/sign-up-form.tsx
git commit -m "style: restyle Sign Up page with Card, FormField, and Button"
```

---

## Task 13: Restyle Home Page (Dashboard)

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Step 1: Update the Home/Dashboard page**

Replace `src/app/(app)/page.tsx` with:
```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-4xl font-bold text-slate-900">VelTest</h1>
        <p className="mt-3 text-lg text-slate-500 max-w-md">
          Submit team reimbursements, route approvals to your manager, then admin.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/sign-in">
            <Button variant="primary">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="secondary">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  const role = session.user.role;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? session.user.email}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(role === "STUDENT" || role === "MANAGER") ? (
          <Link href="/student/requests/new" className="block">
            <Card className="hover:border-indigo-300 transition">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Quick Action</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">New Request</div>
                <p className="mt-1 text-sm text-slate-500">Create a new reimbursement request</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {role === "MANAGER" ? (
          <Link href="/manager/inbox" className="block">
            <Card className="hover:border-indigo-300 transition">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Manager</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Review Inbox</div>
                <p className="mt-1 text-sm text-slate-500">Review submitted reimbursement requests</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {role === "ADMIN" ? (
          <>
            <Link href="/admin/inbox" className="block">
              <Card className="hover:border-indigo-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Admin</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Admin Inbox</div>
                  <p className="mt-1 text-sm text-slate-500">Review manager-approved requests</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/team-requests" className="block">
              <Card className="hover:border-indigo-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Admin</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Team Registrations</div>
                  <p className="mt-1 text-sm text-slate-500">Approve or reject new team requests</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/manager/inbox" className="block">
              <Card className="hover:border-indigo-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Admin</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Manager Inbox</div>
                  <p className="mt-1 text-sm text-slate-500">View manager review queue</p>
                </CardContent>
              </Card>
            </Link>
          </>
        ) : null}

        <Link href="/onboarding" className="block">
          <Card className="hover:border-indigo-300 transition">
            <CardContent>
              <div className="text-sm font-medium text-slate-500">Setup</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Onboarding</div>
              <p className="mt-1 text-sm text-slate-500">Join a team or register a new one</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/page.tsx
git commit -m "style: restyle Home page as role-based dashboard with cards"
```

---

## Task 14: Restyle Onboarding Page

**Files:**
- Modify: `src/app/(app)/onboarding/page.tsx`
- Modify: `src/components/onboarding/team-selector.tsx`
- Modify: `src/components/onboarding/team-registration-form.tsx`

**Step 1: Update the Onboarding page**

Replace `src/app/(app)/onboarding/page.tsx` with:
```tsx
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamSelector } from "@/components/onboarding/team-selector";
import { TeamRegistrationForm } from "@/components/onboarding/team-registration-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    unauthorized();
  }

  const teams = await db.team.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortCode: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Get Started"
        description="Select your team and role before submitting reimbursements."
      />
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Join a Team</h2>
        </CardHeader>
        <CardContent>
          <TeamSelector teams={teams} />
        </CardContent>
      </Card>
      <Card className="border-dashed">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Team Not Listed?</h2>
          <p className="text-sm text-slate-500">Managers can propose a team for admin approval.</p>
        </CardHeader>
        <CardContent>
          <TeamRegistrationForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Update TeamSelector component**

Replace `src/components/onboarding/team-selector.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type Team = {
  id: string;
  name: string;
  shortCode: string | null;
};

export function TeamSelector({ teams }: { teams: Team[] }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [roleIntent, setRoleIntent] = useState<"STUDENT" | "MANAGER">("STUDENT");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function submit() {
    setMessage("");
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, roleIntent }),
    });
    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      setMessage(errorMessage);
      setIsSuccess(false);
      if (response.status === 401) {
        window.location.href = "/sign-in";
      }
      return;
    }
    setIsSuccess(true);
    setMessage("Onboarding complete. You can now create reimbursement requests.");
  }

  return (
    <div className="space-y-4">
      <FormField label="Team" htmlFor="teamId">
        <Select id="teamId" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Role" htmlFor="roleIntent">
        <Select
          id="roleIntent"
          value={roleIntent}
          onChange={(event) => setRoleIntent(event.target.value as "STUDENT" | "MANAGER")}
        >
          <option value="STUDENT">Student</option>
          <option value="MANAGER">Manager</option>
        </Select>
      </FormField>

      <Button onClick={submit}>Save</Button>

      {message ? (
        <Alert variant={isSuccess ? "success" : "error"}>{message}</Alert>
      ) : null}
    </div>
  );
}

async function readErrorMessage(response: Response) {
  const fallback = "Unable to complete onboarding.";
  const body = await response.text();
  if (!body) return fallback;
  try {
    const payload = JSON.parse(body) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
```

**Step 3: Update TeamRegistrationForm component**

Replace `src/components/onboarding/team-registration-form.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

export function TeamRegistrationForm() {
  const [teamName, setTeamName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function submit() {
    setMessage("");
    const response = await fetch("/api/teams/registration-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName, shortCode: shortCode || undefined, notes }),
    });

    if (!response.ok) {
      setMessage("Unable to send team registration request.");
      setIsSuccess(false);
      return;
    }

    setIsSuccess(true);
    setMessage("Team request sent for admin approval.");
    setTeamName("");
    setShortCode("");
    setNotes("");
  }

  return (
    <div className="space-y-4">
      <FormField label="Team Name" htmlFor="teamName">
        <Input
          id="teamName"
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="e.g. Robotics Team Alpha"
        />
      </FormField>

      <FormField label="Short Code" htmlFor="shortCode" helpText="Optional team abbreviation">
        <Input
          id="shortCode"
          value={shortCode}
          onChange={(event) => setShortCode(event.target.value)}
          placeholder="e.g. RTA"
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any additional details about the team..."
          rows={3}
        />
      </FormField>

      <Button variant="secondary" onClick={submit}>Submit Request</Button>

      {message ? (
        <Alert variant={isSuccess ? "success" : "error"}>{message}</Alert>
      ) : null}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/\(app\)/onboarding/page.tsx src/components/onboarding/team-selector.tsx src/components/onboarding/team-registration-form.tsx
git commit -m "style: restyle Onboarding page with Card layout and styled form components"
```

---

## Task 15: Restyle New Request Page

**Files:**
- Modify: `src/app/(app)/student/requests/new/page.tsx`
- Modify: `src/components/reimbursements/request-form.tsx`

**Step 1: Update the New Request page**

Replace `src/app/(app)/student/requests/new/page.tsx` with:
```tsx
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RequestForm } from "@/components/reimbursements/request-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default async function NewRequestPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const memberships = await db.teamMembership.findMany({
    where: { userId: session.user.id, approved: true },
    include: { team: true },
  });

  const teams = memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Reimbursement Request"
        description="Create a draft request, then upload receipts and submit for approval."
      />
      {teams.length === 0 ? (
        <Alert variant="warning">
          Complete onboarding and team membership before creating requests.
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <RequestForm teams={teams} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Update RequestForm component**

Replace `src/components/reimbursements/request-form.tsx` with:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type TeamOption = { id: string; name: string };

export function RequestForm({ teams }: { teams: TeamOption[] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [requestId, setRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function createDraft() {
    setMessage("");
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, teamId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Failed to create request");
      setIsError(true);
      return;
    }
    setRequestId(payload.id);
    setMessage("Draft created successfully.");
    setIsError(false);
  }

  return (
    <div className="space-y-4">
      <FormField label="Title" htmlFor="title">
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Competition Travel Expenses"
        />
      </FormField>

      <FormField label="Description" htmlFor="description">
        <Textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe what this reimbursement is for..."
          rows={3}
        />
      </FormField>

      <FormField label="Team" htmlFor="team">
        <Select id="team" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          {teams.map((team) => (
            <option value={team.id} key={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </FormField>

      <Button onClick={createDraft}>Create Draft</Button>

      {message ? (
        <Alert variant={isError ? "error" : "success"}>
          {message}
          {requestId ? (
            <Link
              href={`/student/requests/${requestId}`}
              className="ml-2 font-medium underline"
            >
              Open request to upload receipts
            </Link>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/student/requests/new/page.tsx src/components/reimbursements/request-form.tsx
git commit -m "style: restyle New Request page with Card and styled form"
```

---

## Task 16: Restyle Receipt Uploader and Request Actions

**Files:**
- Modify: `src/components/reimbursements/receipt-uploader.tsx`
- Modify: `src/components/reimbursements/request-actions.tsx`

**Step 1: Update ReceiptUploader component**

Replace `src/components/reimbursements/receipt-uploader.tsx` with:
```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function ReceiptUploader({ requestId }: { requestId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function readErrorMessage(response: Response) {
    const text = await response.text();
    if (!text) return "Failed to upload receipts.";
    try {
      const payload = JSON.parse(text) as { error?: string };
      return payload.error ?? "Failed to upload receipts.";
    } catch {
      return text;
    }
  }

  async function waitForParsingCompletion() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const statusResponse = await fetch(`/api/requests/${requestId}`, { cache: "no-store" });
      if (!statusResponse.ok) continue;

      const payload = (await statusResponse.json()) as {
        receiptFiles?: Array<{ parseStatus: string }>;
      };
      const statuses = payload.receiptFiles?.map((item) => item.parseStatus) ?? [];
      if (statuses.length === 0) return;

      const hasPending = statuses.some(
        (status) => status === "QUEUED" || status === "PROCESSING"
      );
      if (hasPending) continue;

      router.refresh();
      if (statuses.some((status) => status === "FAILED")) {
        setMessage("Receipts processed, but at least one parse failed.");
        setIsError(true);
      } else {
        setMessage("Receipts parsed and totals recalculated.");
        setIsError(false);
      }
      return;
    }

    setMessage("Receipts uploaded. Parsing is still running, refresh shortly.");
    setIsError(false);
  }

  async function upload() {
    if (files.length === 0) {
      setMessage("Please select one or more files.");
      setIsError(true);
      return;
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    const response = await fetch(`/api/requests/${requestId}/receipts`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      setMessage(await readErrorMessage(response));
      setIsError(true);
      return;
    }
    setMessage("Receipts uploaded and queued for parsing.");
    setIsError(false);
    router.refresh();
    void waitForParsingCompletion();
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition cursor-pointer"
      >
        <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p className="mt-2 text-sm font-medium text-slate-700">
          Click to upload receipts
        </p>
        <p className="mt-1 text-xs text-slate-500">PDF or images accepted</p>
        {files.length > 0 ? (
          <p className="mt-2 text-sm text-indigo-600 font-medium">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
      </div>
      {files.length > 0 ? (
        <Button onClick={upload}>Upload {files.length} file{files.length > 1 ? "s" : ""}</Button>
      ) : null}
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
```

**Step 2: Update RequestActions component**

Replace `src/components/reimbursements/request-actions.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiptUploader } from "@/components/reimbursements/receipt-uploader";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function RequestActions({ requestId }: { requestId: string }) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  async function readErrorMessage(response: Response) {
    const text = await response.text();
    if (!text) return "Request failed.";
    try {
      const payload = JSON.parse(text) as { error?: string };
      return payload.error ?? "Request failed.";
    } catch {
      return text;
    }
  }

  async function autofill() {
    const response = await fetch(`/api/requests/${requestId}/autofill`, { method: "POST" });
    if (!response.ok) {
      setMessage(await readErrorMessage(response));
      setIsError(true);
      return;
    }
    const payload = (await response.json()) as { requestedTotal: number; extractionCount: number };
    router.refresh();
    setMessage(
      `Auto-fill updated totals from ${payload.extractionCount} parsed receipt(s). New total: $${payload.requestedTotal.toFixed(2)}`
    );
    setIsError(false);
  }

  async function submit() {
    const response = await fetch(`/api/requests/${requestId}/submit`, { method: "POST" });
    if (!response.ok) {
      setMessage(await readErrorMessage(response));
      setIsError(true);
      return;
    }
    router.refresh();
    setMessage("Request submitted to manager.");
    setIsError(false);
  }

  return (
    <div className="space-y-6">
      <ReceiptUploader requestId={requestId} />
      <div className="flex gap-3">
        <Button variant="secondary" onClick={autofill}>
          Auto-fill Totals
        </Button>
        <Button onClick={submit}>
          Submit to Manager
        </Button>
      </div>
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/reimbursements/receipt-uploader.tsx src/components/reimbursements/request-actions.tsx
git commit -m "style: restyle ReceiptUploader with drag-drop zone and RequestActions with buttons"
```

---

## Task 17: Restyle ExtractionReview and RequestTimeline

**Files:**
- Modify: `src/components/reimbursements/extraction-review.tsx`
- Modify: `src/components/reimbursements/request-timeline.tsx`

**Step 1: Update ExtractionReview component**

Replace `src/components/reimbursements/extraction-review.tsx` with:
```tsx
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

type ReceiptWithExtraction = Prisma.ReceiptFileGetPayload<{
  include: {
    extraction: {
      include: {
        lineItems: true;
      };
    };
  };
}>;

function formatMoney(value: Prisma.Decimal | null, currency: string) {
  if (!value) return "N/A";
  return `${currency} ${value.toString()}`;
}

export function ExtractionReview({ receipts }: { receipts: ReceiptWithExtraction[] }) {
  if (receipts.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Receipts</h3>
      {receipts.map((receipt) => (
        <Card key={receipt.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-sm font-medium text-slate-900">{receipt.fileName}</span>
            <Badge status={receipt.parseStatus} />
          </CardHeader>
          {receipt.extraction ? (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">Type</div>
                  <div className="font-medium text-slate-900">{receipt.extraction.documentType}</div>
                </div>
                <div>
                  <div className="text-slate-500">Merchant</div>
                  <div className="font-medium text-slate-900">{receipt.extraction.merchant ?? "N/A"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Total</div>
                  <div className="font-medium text-slate-900">
                    {formatMoney(receipt.extraction.total, receipt.extraction.currency ?? "USD")}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Confidence</div>
                  <div className="font-medium text-slate-900">{receipt.extraction.confidence ?? "N/A"}</div>
                </div>
              </div>

              {Array.isArray(receipt.extraction.flags) &&
              receipt.extraction.flags.every((flag) => typeof flag === "string") &&
              receipt.extraction.flags.length > 0 ? (
                <Alert variant="warning">
                  Flags: {(receipt.extraction.flags as string[]).join(", ")}
                </Alert>
              ) : null}

              {receipt.extraction.lineItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Description</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Qty</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Unit Price</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Line Total</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.extraction.lineItems.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-700">{item.description}</td>
                          <td className="py-2 px-3 text-right text-slate-700">{item.quantity?.toString() ?? "-"}</td>
                          <td className="py-2 px-3 text-right text-slate-700">
                            {item.unitPrice
                              ? `${receipt.extraction?.currency ?? "USD"} ${item.unitPrice.toString()}`
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700">
                            {item.lineTotal
                              ? `${receipt.extraction?.currency ?? "USD"} ${item.lineTotal.toString()}`
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-slate-700">{item.category ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No itemized expenses detected.</p>
              )}
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Update RequestTimeline component**

Replace `src/components/reimbursements/request-timeline.tsx` with:
```tsx
import { StatusTimeline } from "@/components/ui/status-timeline";

type TimelineItem = {
  id: string;
  action: string;
  actor: string;
  comment?: string | null;
  createdAt: Date;
};

export function RequestTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Approval History</h3>
      <StatusTimeline items={items} />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/reimbursements/extraction-review.tsx src/components/reimbursements/request-timeline.tsx
git commit -m "style: restyle ExtractionReview with cards/tables and RequestTimeline with StatusTimeline"
```

---

## Task 18: Restyle Student Request Detail Page

**Files:**
- Modify: `src/app/(app)/student/requests/[requestId]/page.tsx`

**Step 1: Update the Request Detail page**

Replace `src/app/(app)/student/requests/[requestId]/page.tsx` with:
```tsx
import { notFound, unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { RequestActions } from "@/components/reimbursements/request-actions";
import { RequestTimeline } from "@/components/reimbursements/request-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudentRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await auth();
  if (!session?.user) unauthorized();

  const { requestId } = await params;
  const requestRecord = await db.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      team: true,
      receiptFiles: { include: { extraction: { include: { lineItems: { orderBy: { position: "asc" } } } } } },
      approvals: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!requestRecord || requestRecord.createdById !== session.user.id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={requestRecord.title}
        badge={<Badge status={requestRecord.status} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Requested Total</div>
            <div className="text-2xl font-bold text-slate-900">
              ${requestRecord.requestedTotal.toString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Team</div>
            <div className="text-lg font-semibold text-slate-900">{requestRecord.team.name}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-slate-500">Created</div>
            <div className="text-lg font-semibold text-slate-900">
              {requestRecord.createdAt.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {requestRecord.status === "DRAFT" ? (
        <Card>
          <CardContent>
            <RequestActions requestId={requestRecord.id} />
          </CardContent>
        </Card>
      ) : null}

      <ExtractionReview receipts={requestRecord.receiptFiles} />

      <RequestTimeline
        items={requestRecord.approvals.map((approval) => ({
          id: approval.id,
          action: approval.action,
          actor: approval.actor.email,
          comment: approval.comment,
          createdAt: approval.createdAt,
        }))}
      />
    </div>
  );
}
```

**Step 2: Verify build**

Run:
```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/student/requests/\[requestId\]/page.tsx
git commit -m "style: restyle Student Request Detail page with stats cards and structured layout"
```

---

## Task 19: Restyle ApprovalDecision Component

**Files:**
- Modify: `src/components/reimbursements/approval-decision.tsx`

**Step 1: Update ApprovalDecision component**

Replace `src/components/reimbursements/approval-decision.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type Decision = "APPROVE" | "REJECT" | "MARK_PAID";

export function ApprovalDecision({
  requestId,
  endpoint,
  allowMarkPaid = false,
}: {
  requestId: string;
  endpoint: string;
  allowMarkPaid?: boolean;
}) {
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleDecision(decision: Decision) {
    setMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });

    if (!response.ok) {
      setMessage("Decision failed.");
      setIsError(true);
      return;
    }
    setMessage(`Decision recorded: ${decision.replace("_", " ")}`);
    setIsError(false);
  }

  return (
    <div className="space-y-3">
      <FormField label="Comment" htmlFor={`comment-${requestId}`} helpText="Required for rejection">
        <Textarea
          id={`comment-${requestId}`}
          value={comment}
          placeholder="Add a comment..."
          onChange={(event) => setComment(event.target.value)}
          rows={2}
        />
      </FormField>
      <div className="flex gap-2">
        <Button variant="success" size="sm" onClick={() => handleDecision("APPROVE")}>
          Approve
        </Button>
        <Button variant="danger" size="sm" onClick={() => handleDecision("REJECT")}>
          Reject
        </Button>
        {allowMarkPaid ? (
          <Button variant="primary" size="sm" onClick={() => handleDecision("MARK_PAID")}>
            Mark Paid
          </Button>
        ) : null}
      </div>
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reimbursements/approval-decision.tsx
git commit -m "style: restyle ApprovalDecision with inline buttons and styled comment field"
```

---

## Task 20: Restyle Manager Inbox Page

**Files:**
- Modify: `src/app/(app)/manager/inbox/page.tsx`

**Step 1: Update the Manager Inbox page**

Replace `src/app/(app)/manager/inbox/page.tsx` with:
```tsx
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { ExtractionReview } from "@/components/reimbursements/extraction-review";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ManagerInboxPage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const managedTeamIds = (
    await db.teamMembership.findMany({
      where: { userId: session.user.id, roleInTeam: "MANAGER", approved: true },
      select: { teamId: true },
    })
  ).map((item) => item.teamId);

  const requests = await db.reimbursementRequest.findMany({
    where: {
      teamId: { in: managedTeamIds },
      status: "SUBMITTED",
    },
    include: {
      createdBy: true,
      team: true,
      receiptFiles: {
        include: {
          extraction: {
            include: {
              lineItems: {
                orderBy: { position: "asc" },
              },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager Inbox"
        badge={requests.length > 0 ? <Badge status={`${requests.length} pending`} /> : undefined}
        description="Review and approve submitted reimbursement requests."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="All submitted requests have been reviewed."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{request.title}</h3>
                    <p className="text-sm text-slate-500">
                      {request.team.name} &middot; {request.createdBy.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-slate-900">
                      ${request.requestedTotal.toString()}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ExtractionReview receipts={request.receiptFiles} />
              </CardContent>
              <CardFooter>
                <ApprovalDecision
                  requestId={request.id}
                  endpoint={`/api/requests/${request.id}/manager-decision`}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/manager/inbox/page.tsx
git commit -m "style: restyle Manager Inbox with request cards and empty state"
```

---

## Task 21: Restyle Admin Inbox Page

**Files:**
- Modify: `src/app/(app)/admin/inbox/page.tsx`

**Step 1: Update the Admin Inbox page**

Replace `src/app/(app)/admin/inbox/page.tsx` with:
```tsx
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApprovalDecision } from "@/components/reimbursements/approval-decision";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminInboxPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const requests = await db.reimbursementRequest.findMany({
    where: {
      status: { in: ["MANAGER_APPROVED", "ADMIN_APPROVED"] },
    },
    include: { createdBy: true, team: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Inbox"
        badge={requests.length > 0 ? <Badge status={`${requests.length} pending`} /> : undefined}
        description="Final approval and payment processing for reimbursement requests."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="All requests have been processed."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{request.title}</h3>
                      <Badge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.team.name} &middot; {request.createdBy.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-slate-900">
                      ${request.requestedTotal.toString()}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardFooter>
                <ApprovalDecision
                  requestId={request.id}
                  endpoint={`/api/requests/${request.id}/admin-decision`}
                  allowMarkPaid
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/admin/inbox/page.tsx
git commit -m "style: restyle Admin Inbox with cards, badges, and empty state"
```

---

## Task 22: Restyle Admin Team Requests Page

**Files:**
- Modify: `src/app/(app)/admin/team-requests/page.tsx`
- Modify: `src/components/onboarding/team-request-decision.tsx`

**Step 1: Update the Admin Team Requests page**

Replace `src/app/(app)/admin/team-requests/page.tsx` with:
```tsx
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRequestDecision } from "@/components/onboarding/team-request-decision";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminTeamRequestsPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const requests = await db.teamRegistrationRequest.findMany({
    where: { status: "PENDING" },
    include: { requestedBy: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Registrations"
        badge={requests.length > 0 ? <Badge status={`${requests.length} pending`} /> : undefined}
        description="Review and approve new team registration requests."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No pending registrations"
          description="All team registration requests have been reviewed."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <h3 className="text-base font-semibold text-slate-900">{request.teamName}</h3>
                <p className="text-sm text-slate-500">
                  Requested by {request.requestedBy.email}
                </p>
              </CardHeader>
              {request.notes ? (
                <CardContent>
                  <p className="text-sm text-slate-700">{request.notes}</p>
                </CardContent>
              ) : null}
              <CardFooter>
                <TeamRequestDecision requestId={request.id} />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update TeamRequestDecision component**

Replace `src/components/onboarding/team-request-decision.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

export function TeamRequestDecision({ requestId }: { requestId: string }) {
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleDecision(decision: "APPROVE" | "REJECT") {
    setMessage("");
    const response = await fetch(`/api/admin/team-requests/${requestId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });
    if (!response.ok) {
      setMessage("Decision failed.");
      setIsError(true);
      return;
    }
    setMessage("Decision saved.");
    setIsError(false);
  }

  return (
    <div className="space-y-3">
      <FormField label="Comment" htmlFor={`comment-${requestId}`}>
        <Textarea
          id={`comment-${requestId}`}
          value={comment}
          placeholder="Add a comment..."
          onChange={(event) => setComment(event.target.value)}
          rows={2}
        />
      </FormField>
      <div className="flex gap-2">
        <Button variant="success" size="sm" onClick={() => handleDecision("APPROVE")}>
          Approve
        </Button>
        <Button variant="danger" size="sm" onClick={() => handleDecision("REJECT")}>
          Reject
        </Button>
      </div>
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/admin/team-requests/page.tsx src/components/onboarding/team-request-decision.tsx
git commit -m "style: restyle Admin Team Requests with cards and inline decision buttons"
```

---

## Task 23: Final Build Verification and Cleanup

**Step 1: Run the type checker**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 2: Run the linter**

Run:
```bash
npm run lint
```
Expected: No errors (or fix any that appear).

**Step 3: Run the build**

Run:
```bash
npm run build
```
Expected: Build succeeds with all pages compiling.

**Step 4: Run existing tests**

Run:
```bash
npm test
```
Expected: All existing tests pass (we only changed markup, not logic).

**Step 5: Visual smoke test**

Run:
```bash
npm run dev
```
Then manually check each page in the browser:
- `/` (signed out — hero page)
- `/sign-in` (centered card form)
- `/sign-up` (centered card form)
- `/` (signed in — dashboard cards)
- `/onboarding` (two-card layout)
- `/student/requests/new` (form card)
- `/student/requests/[id]` (stats + receipts + timeline)
- `/manager/inbox` (request cards with approval)
- `/admin/inbox` (request cards with mark paid)
- `/admin/team-requests` (team cards with approval)

**Step 6: Commit any fixes**

If any fixes were needed during verification:
```bash
git add -A
git commit -m "fix: address build/lint issues from UI redesign"
```
