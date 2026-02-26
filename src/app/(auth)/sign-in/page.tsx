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
