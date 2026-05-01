import { describe, expect, it } from "vitest";
import { authOptions } from "@/auth";
import {
  buildGetTokenOptions,
  sessionTokenCookieName,
  sessionTokenCookieOptions,
} from "@/lib/auth-cookies";

describe("auth cookie configuration", () => {
  it("uses the same app-scoped session cookie across NextAuth and the proxy", () => {
    expect(sessionTokenCookieName).toContain("veltest");
    expect(authOptions.cookies?.sessionToken).toEqual({
      name: sessionTokenCookieName,
      options: sessionTokenCookieOptions,
    });
    expect(buildGetTokenOptions("secret")).toEqual({
      secret: "secret",
      cookieName: sessionTokenCookieName,
    });
  });
});
