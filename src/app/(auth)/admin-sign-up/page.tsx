import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminSignUpPage() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <Image
        src="/novi-logo.png"
        alt="Novi Community School District"
        width={131}
        height={40}
        className="h-12 w-auto"
        priority
      />
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Admin accounts are provisioned</h1>
        <p className="text-muted-foreground text-sm">
          There is no self-service admin sign-up. Administrator access is set up
          by a super admin. If you need an admin account, contact your district
          super admin. Otherwise, create a standard account to get started.
        </p>
      </div>
      <Button asChild>
        <Link href="/sign-up">Create a standard account</Link>
      </Button>
    </div>
  );
}
