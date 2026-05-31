import type { GlobalRole } from "@/db/schema";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

export async function requireRole(...allowed: GlobalRole[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function requireSuperAdmin() {
  return requireRole("SUPER_ADMIN");
}
