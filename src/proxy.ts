import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { POLICY_PATH } from "@/lib/policy";

// Public routes that do not require an authenticated session.
const isPublicRoute = createRouteMatcher([
  "/",
  POLICY_PATH,
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/admin-sign-up(.*)",
]);

// Clerk runs on the Edge runtime, which OpenNext supports (unlike Next's Node
// middleware). This is the minimal gate; route/layout guards (requireUser,
// requireRole, requireAccessContext) remain the authoritative enforcement.
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
