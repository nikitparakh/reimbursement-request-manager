import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/ui/notification-bell";
import { MobileNavMenu } from "@/components/ui/mobile-nav-menu";

type NavLink = { href: string; label: string };

const userLinks: NavLink[] = [
  { href: "/team", label: "My Team" },
  { href: "/user/requests/new", label: "New Request" },
  { href: "/user/requests", label: "My Requests" },
];

const coachLinks: NavLink[] = [
  { href: "/team", label: "My Team" },
  { href: "/user/requests/new", label: "New Request" },
  { href: "/coach/team-reimbursements", label: "Team Reimbursements" },
];

const adminLinks: NavLink[] = [
  { href: "/admin/inbox", label: "Admin Inbox" },
  { href: "/admin/requests", label: "Reimbursements" },
  { href: "/admin/teams", label: "Manage Teams" },
  { href: "/admin/users", label: "Manage Users" },
];

function getLinksForRole(role: string): NavLink[] {
  switch (role) {
    case "ADMIN":
      return adminLinks;
    case "COACH":
      return coachLinks;
    default:
      return userLinks;
  }
}

export async function NavBar() {
  const session = await auth();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <Image src="/novi-logo.png" alt="Novi Community School District" width={131} height={40} className="h-10 w-auto" />
        </Link>

        {session?.user ? (
          <>
            <div className="hidden sm:flex items-center gap-6">
              {getLinksForRole(session.user.role).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <NotificationBell userRole={session.user.role} />
              <span className="hidden md:inline text-sm text-slate-500">{session.user.email}</span>
              <SignOutButton />
            </div>
            <MobileNavMenu
              links={getLinksForRole(session.user.role)}
              userEmail={session.user.email!}
              userRole={session.user.role}
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
