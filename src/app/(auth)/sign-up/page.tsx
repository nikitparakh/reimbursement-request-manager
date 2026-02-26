import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Card, CardContent } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <img src="/frogforce-shield.jpg" alt="Frog Force 503" className="h-16 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-emerald-600">Frog Force 503</h1>
        <p className="mt-2 text-sm text-slate-500">Create an account to submit team reimbursements</p>
      </div>
      <Card>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-emerald-600 hover:text-emerald-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
