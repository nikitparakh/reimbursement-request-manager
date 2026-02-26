import type { DefaultSession } from "next-auth";
import type { GlobalRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: GlobalRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: GlobalRole;
  }
}
