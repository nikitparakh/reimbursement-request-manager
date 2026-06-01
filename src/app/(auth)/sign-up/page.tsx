import Image from "next/image";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
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
      <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </div>
  );
}
