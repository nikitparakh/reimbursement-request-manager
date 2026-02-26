import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function HomePage() {
  const session = await auth();

  return (
    <section>
      <h1>Reimbursement Workflow</h1>
      <p>Submit team reimbursements, route approvals to manager, then admin.</p>
      {!session?.user ? (
        <div>
          <Link href="/sign-in">Sign in</Link>
          <p>
            Need an account? <Link href="/sign-up">Create account</Link>
          </p>
        </div>
      ) : (
        <div>
          <p>Signed in as {session.user.email}</p>
          <ul>
            <li>
              <Link href="/onboarding">Onboarding</Link>
            </li>
            <li>
              <Link href="/student/requests/new">Create reimbursement</Link>
            </li>
            <li>
              <Link href="/manager/inbox">Manager inbox</Link>
            </li>
            <li>
              <Link href="/admin/inbox">Admin inbox</Link>
            </li>
          </ul>
          <SignOutButton />
        </div>
      )}
    </section>
  );
}
