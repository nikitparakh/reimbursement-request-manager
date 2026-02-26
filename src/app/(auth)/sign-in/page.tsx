import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <section>
      <h1>Sign in</h1>
      <p>Use your email and password to access the reimbursement system.</p>
      <SignInForm />
      <p>
        New here? <Link href="/sign-up">Create an account</Link>
      </p>
    </section>
  );
}
