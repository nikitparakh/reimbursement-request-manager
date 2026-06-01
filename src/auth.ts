import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import type { GlobalRole } from "@/db/schema";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/log";

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
 * with the Clerk user's *verified* email already exists (e.g. a seeded account
 * that has not yet been linked), bind it by setting `clerkUserId` — but only
 * when that row is not already linked to some other Clerk identity. Otherwise
 * create a fresh standard USER.
 */
async function getOrProvisionAppUser(clerkUserId: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });
  if (existing) return existing;

  const clerk = await currentUser();

  // Only consider email-based linking when the primary email is *verified*.
  // An unverified email (e.g. asserted by an SSO/social/enterprise connection)
  // must never be allowed to claim a pre-seeded row by email alone.
  const primaryEmail = clerk?.primaryEmailAddress;
  const isVerifiedPrimary =
    primaryEmail?.verification?.status === "verified";
  const verifiedEmail = isVerifiedPrimary
    ? primaryEmail?.emailAddress?.toLowerCase()
    : undefined;

  // The email used for display/creation falls back to the primary even when
  // unverified, but linking is gated on `verifiedEmail` only.
  const email =
    primaryEmail?.emailAddress?.toLowerCase() ??
    clerk?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
  if (!email) return null;

  const name =
    [clerk?.firstName, clerk?.lastName].filter(Boolean).join(" ") || null;

  // Attempt a one-way, idempotent link to a pre-seeded row only when we have a
  // verified email and that row is not yet bound to any Clerk identity. The
  // conditional UPDATE (`clerkUserId IS NULL`) guarantees we never overwrite an
  // already-linked id, even under a race.
  if (verifiedEmail) {
    const [linked] = await db
      .update(users)
      .set({ clerkUserId })
      .where(and(eq(users.email, verifiedEmail), isNull(users.clerkUserId)))
      .returning();

    if (linked) {
      // Best-effort, non-fatal audit of the first-time relink.
      try {
        await logAuditEvent({
          actorId: linked.id,
          eventType: "USER_CLERK_LINKED",
          message: `Linked Clerk identity to user ${linked.email}`,
          metadata: { clerkUserId, email: linked.email },
        });
      } catch {
        // Auditing must never block authentication.
      }
      return linked;
    }

    // A row with this verified email exists but is already linked to a
    // *different* Clerk id: the bare-insert path below fails closed on the email
    // unique index rather than silently rebinding it.
  }

  // No linkable pre-seeded row: create a fresh standard USER bound to this
  // Clerk id. (When `verifiedEmail` is undefined we never claim by email.) If a
  // row already holds this email — e.g. a seeded row reachable only by an
  // *unverified* email — fail closed rather than throw on the unique index or
  // claim a row we are not allowed to bind.
  const emailOwner = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (emailOwner) return null;

  try {
    const [user] = await db
      .insert(users)
      .values({ clerkUserId, email, name, role: "USER" })
      .returning();
    return user;
  } catch {
    // Two concurrent first authenticated requests for the same brand-new Clerk
    // user can both reach this insert; one wins and the other hits the unique
    // email/clerkUserId index. Re-read the row the winner created instead of
    // failing authentication.
    const winnerByClerk = await db.query.users.findFirst({
      where: eq(users.clerkUserId, clerkUserId),
    });
    if (winnerByClerk) return winnerByClerk;
    const winnerByEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    // A row now holds this email but is bound to a different Clerk id: fail
    // closed rather than hand back an account we are not allowed to bind.
    return winnerByEmail && winnerByEmail.clerkUserId === clerkUserId
      ? winnerByEmail
      : null;
  }
}
