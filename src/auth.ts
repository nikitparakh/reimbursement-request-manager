import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import type { GlobalRole } from "@prisma/client";
import { db } from "@/lib/db";

export type AppSessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: GlobalRole;
};

/**
 * App-level auth wrapper, reimplemented on top of Clerk.
 *
 * Returns the same `{ user }` shape the rest of the app already consumes, so
 * every `const session = await auth()` callsite keeps working unchanged. The
 * app's own `User` table remains the source of truth for roles/scopes; Clerk
 * owns identity. The two are linked by `User.clerkUserId`.
 */
export async function auth(): Promise<{ user: AppSessionUser } | null> {
  const { userId: clerkUserId } = await clerkAuth();
  if (!clerkUserId) return null;

  const user = await getOrProvisionAppUser(clerkUserId);
  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

/**
 * Lazy-provision the app `User` row on first authenticated request. If a row
 * with the Clerk user's email already exists (e.g. a seeded account), link it
 * by setting `clerkUserId`; otherwise create a fresh standard USER.
 */
async function getOrProvisionAppUser(clerkUserId: string) {
  const existing = await db.user.findUnique({ where: { clerkUserId } });
  if (existing) return existing;

  const clerk = await currentUser();
  const email =
    clerk?.primaryEmailAddress?.emailAddress?.toLowerCase() ??
    clerk?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
  if (!email) return null;

  const name =
    [clerk?.firstName, clerk?.lastName].filter(Boolean).join(" ") || null;

  return db.user.upsert({
    where: { email },
    update: { clerkUserId },
    create: { clerkUserId, email, name, role: "USER" },
  });
}
