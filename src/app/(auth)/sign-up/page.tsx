import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <section>
      <h1>Create account</h1>
      <p>Register with email and password to submit reimbursement requests.</p>
      <SignUpForm />
      <p>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </section>
  );
}
