import Image from "next/image";
import { SignIn } from "@clerk/nextjs";

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
      <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </div>
  );
}
