import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Image src="/novi-logo.png" alt="Novi Community School District" width={131} height={40} className="h-14 w-auto mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-slate-900">Reimbursement Request Manager</h1>
        <p className="mt-3 text-lg text-slate-500 max-w-md">
          Submit team reimbursements, route approvals to your coach, then admin.
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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingDone: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? session.user.email}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(role === "STUDENT" || role === "COACH") ? (
          <>
            <Link href="/team" className="block">
              <Card className="hover:border-emerald-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Team</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">My Team</div>
                  <p className="mt-1 text-sm text-slate-500">View your team members and coach</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/user/requests/new" className="block">
              <Card className="hover:border-emerald-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Quick Action</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">New Request</div>
                  <p className="mt-1 text-sm text-slate-500">Create a new reimbursement request</p>
                </CardContent>
              </Card>
            </Link>
          </>
        ) : null}

        {role === "COACH" ? (
          <Link href="/coach/team-reimbursements" className="block">
            <Card className="hover:border-emerald-300 transition">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Coach</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Team Reimbursements</div>
                <p className="mt-1 text-sm text-slate-500">Review, approve, and track team requests</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {role === "ADMIN" ? (
          <>
            <Link href="/admin/inbox" className="block">
              <Card className="hover:border-emerald-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Admin</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Admin Inbox</div>
                  <p className="mt-1 text-sm text-slate-500">Review, approve, and process requests</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/team-requests" className="block">
              <Card className="hover:border-emerald-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Admin</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Team Registrations</div>
                  <p className="mt-1 text-sm text-slate-500">Approve or reject new team requests</p>
                </CardContent>
              </Card>
            </Link>
          </>
        ) : null}

        {role !== "ADMIN" && !user?.onboardingDone ? (
          <Link href="/onboarding" className="block">
            <Card className="hover:border-emerald-300 transition">
              <CardContent>
                <div className="text-sm font-medium text-slate-500">Setup</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Onboarding</div>
                <p className="mt-1 text-sm text-slate-500">Join a team or register a new one</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
