import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { getCachedAccessContext } from "@/lib/access";
import { getNavigationLinks } from "@/lib/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/ui/notification-bell";
import { MobileNavMenu } from "@/components/ui/mobile-nav-menu";

export async function NavBar() {
  const session = await auth();
  const access = session?.user
    ? await getCachedAccessContext(session.user.id)
    : null;
  const links = access ? getNavigationLinks(access) : [];

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <Image src="/novi-logo.png" alt="Novi Community School District" width={131} height={40} className="h-10 w-auto" />
        </Link>

        {session?.user ? (
          <>
            <div className="hidden sm:flex items-center gap-6">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={link.prefetch}
                  className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <NotificationBell />
              <span className="hidden md:inline text-sm text-slate-500">{session.user.email}</span>
              <SignOutButton />
            </div>
            <MobileNavMenu
              links={links}
              userEmail={session.user.email!}
            />
          </>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
