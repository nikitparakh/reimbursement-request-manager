import Image from "next/image";
import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignInPage() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <Image
        src="/novi-logo.png"
        alt="Novi Community School District"
        width={131}
        height={40}
        className="h-12 w-auto"
        priority
      />
      <Card className="w-full shadow-sm">
        <CardHeader className="text-center">
          <CardTitle>Reimbursement Request Manager</CardTitle>
          <CardDescription>Sign in to manage reimbursement requests</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 pt-6">
          <SignInForm />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-1 border-t border-border bg-muted/30 px-6 py-4">
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Button variant="link" className="h-auto px-0.5 py-0 text-sm font-medium" asChild>
              <Link href="/sign-up">Create an account</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
