import Image from "next/image";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function SignUpPage() {
  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="flex flex-col items-center gap-4 border-border border-b pb-6 text-center">
        <Image
          src="/novi-logo.png"
          alt="Novi Community School District"
          width={131}
          height={40}
          className="h-12 w-auto"
          priority
        />
        <div className="w-full [&_[data-slot=card-header]]:flex-col [&_[data-slot=card-header]]:items-center [&_[data-slot=card-header]]:text-center [&_[data-slot=card-header]]:sm:flex-col [&_[data-slot=card-header]]:sm:items-center">
          <PageHeader
            title="Reimbursement Request Manager"
            description="Create an account to submit team reimbursements"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6 pb-4">
        <SignUpForm />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-center gap-1 border-border">
        <p className="text-center text-muted-foreground text-sm">
          Already have an account?{" "}
          <Button variant="link" className="h-auto px-0.5 py-0 text-sm font-medium" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
}
