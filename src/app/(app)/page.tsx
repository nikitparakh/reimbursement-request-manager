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
        <img src="/frogforce-shield.jpg" alt="Frog Force 503" className="h-24 w-auto mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-slate-900">Frog Force 503</h1>
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
            <Card className="hover:border-emerald-300 transition">
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
            <Card className="hover:border-emerald-300 transition">
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
              <Card className="hover:border-emerald-300 transition">
                <CardContent>
                  <div className="text-sm font-medium text-slate-500">Admin</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Admin Inbox</div>
                  <p className="mt-1 text-sm text-slate-500">Review manager-approved requests</p>
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
            <Link href="/manager/inbox" className="block">
              <Card className="hover:border-emerald-300 transition">
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
          <Card className="hover:border-emerald-300 transition">
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
