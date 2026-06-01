import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { NavBar } from "@/components/ui/navbar";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getCachedAccessContext } from "@/lib/access";
import { POLICY_PATH } from "@/lib/policy";

// Paths under (app) that an un-onboarded user must still be able to reach,
// otherwise the onboarding redirect would loop or trap the user.
const ONBOARDING_EXEMPT_PREFIXES = ["/onboarding", POLICY_PATH, "/profile"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Centralized onboarding/role gate: a signed-in user with no admin scope, no
  // team membership, and incomplete onboarding has nothing to do anywhere in
  // the app, so funnel them to /onboarding. Enforced once here rather than
  // re-implemented per page (a forgotten per-page guard is a footgun). The
  // unauthenticated case is handled by middleware + each page's own checks.
  if (session?.user) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const isExempt = ONBOARDING_EXEMPT_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

    if (!isExempt) {
      const [user, access] = await Promise.all([
        db.query.users.findFirst({
          where: eq(users.id, session.user.id),
          columns: { onboardingDone: true },
        }),
        getCachedAccessContext(session.user.id),
      ]);

      const needsOnboarding =
        !user?.onboardingDone &&
        !access.isAdmin &&
        !access.isCoach &&
        !access.isParentMentor;
      if (needsOnboarding) {
        redirect("/onboarding");
      }
    }
  }

  return (
    <>
      <NavBar />
      <main className="bg-background mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </>
  );
}
