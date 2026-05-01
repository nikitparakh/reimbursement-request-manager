import { env } from "@/lib/env";

const authBaseUrl = env.NEXTAUTH_URL ?? env.APP_URL;
const useSecureCookies = new URL(authBaseUrl).protocol === "https:";

export const sessionTokenCookieName = `${
  useSecureCookies ? "__Secure-" : ""
}veltest.session-token`;

export const sessionTokenCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: useSecureCookies,
};

export function buildGetTokenOptions(secret: string) {
  return {
    secret,
    cookieName: sessionTokenCookieName,
  };
}
